import math
import unittest
from unittest.mock import patch

import main
from schemas import SensorDataPayload


class DemoNavigationTests(unittest.TestCase):
    def setUp(self):
        main.navigation_state = main.initialize_navigation_state()
        main.latest_sensor_sample = None
        main._reset_sensor_navigation_tracking()
        self.clock_patch = patch("main.time.monotonic", return_value=100.0)
        self.clock = self.clock_patch.start()
        main.reset_demo_navigation()

    def tearDown(self):
        self.clock_patch.stop()

    def post_demo_sample(
        self,
        *,
        timestamp,
        gps_timestamp,
        latitude=12.0,
        longitude=77.0,
        gps_available=True,
        gps_speed=4.0,
        gps_heading=0.0,
    ):
        return main.receive_demo_sensor_data(
            SensorDataPayload(
                timestamp=timestamp,
                source="demo",
                gps_timestamp=gps_timestamp,
                latitude=latitude,
                longitude=longitude,
                gps_speed=gps_speed,
                gps_heading=gps_heading,
                gps_available=gps_available,
                accel_x=0.1,
                accel_y=0.2,
                accel_z=9.8,
                gyro_alpha=0.01,
                gyro_beta=0.02,
                gyro_gamma=0.03,
            )
        )

    def test_demo_reset_waits_for_a_gps_sample(self):
        response = main.get_real_time_navigation(source="demo")
        self.assertFalse(response.gps_available)
        self.assertEqual(response.navigation_mode, "WAITING_FOR_GPS")
        self.assertEqual(response.status, "Waiting for a demo GPS fix")

    def test_demo_route_speed_can_exceed_walking_speed_for_simulated_drive(self):
        response = self.post_demo_sample(
            timestamp=1000.0,
            gps_timestamp=1000.0,
            latitude=12.0,
            longitude=77.0,
            gps_speed=18.0,
            gps_heading=90.0,
            gps_available=True,
        )

        self.assertEqual(response["status"], "success")
        navigation = main.get_real_time_navigation(source="demo")
        self.assertTrue(navigation.gps_available)
        self.assertEqual(navigation.navigation_mode, "GPS")
        self.assertAlmostEqual(navigation.heading, 0.0)

    def test_demo_feed_does_not_replace_real_sample_or_navigation(self):
        real_sample = SensorDataPayload(
            timestamp=1000.0,
            latitude=10.5,
            longitude=70.5,
            gps_speed=1.0,
            gps_heading=45.0,
            gps_available=True,
        )
        main.receive_sensor_data(real_sample)
        stored_real_sample = main.latest_sensor_sample.copy()

        self.post_demo_sample(timestamp=2000.0, gps_timestamp=2000.0)

        self.assertEqual(main.get_latest_sensor_data(), stored_real_sample)
        self.assertEqual(main.get_real_time_navigation().latitude, 10.5)
        demo_navigation = main.get_real_time_navigation(source="demo")
        self.assertEqual(demo_navigation.latitude, 12.0)
        self.assertEqual(demo_navigation.navigation_mode, "GPS")

    def test_demo_gps_timeout_dead_reckoning_and_recovery(self):
        self.post_demo_sample(timestamp=1000.0, gps_timestamp=1000.0)

        self.clock.return_value = 103.2
        self.post_demo_sample(
            timestamp=1003.2,
            gps_timestamp=1000.0,
            gps_available=False,
        )
        timed_out = main.get_real_time_navigation(source="demo")

        self.assertFalse(timed_out.gps_available)
        self.assertEqual(timed_out.navigation_mode, "DEAD_RECKONING")
        self.assertGreater(timed_out.latitude, 12.0)
        self.assertAlmostEqual(timed_out.heading, math.pi / 2.0)

        self.clock.return_value = 103.3
        self.post_demo_sample(
            timestamp=1003.3,
            gps_timestamp=1003.3,
            latitude=12.5,
            longitude=77.5,
            gps_speed=2.0,
            gps_heading=90.0,
        )
        recovered = main.get_real_time_navigation(source="demo")

        self.assertTrue(recovered.gps_available)
        self.assertEqual(recovered.navigation_mode, "GPS")
        self.assertEqual(recovered.latitude, 12.5)
        self.assertEqual(recovered.longitude, 77.5)
        self.assertAlmostEqual(recovered.heading, 0.0)

    def test_demo_motion_continues_from_measurements_without_sending_gps_position(self):
        self.post_demo_sample(timestamp=1000.0, gps_timestamp=1000.0)

        self.clock.return_value = 103.2
        self.post_demo_sample(
            timestamp=1003.2,
            gps_timestamp=1000.0,
            latitude=None,
            longitude=None,
            gps_available=False,
            gps_speed=4.0,
            gps_heading=0.0,
        )
        first_estimate = main.get_real_time_navigation(source="demo")
        self.assertEqual(first_estimate.navigation_mode, "DEAD_RECKONING")

        self.clock.return_value = 104.0
        self.post_demo_sample(
            timestamp=1004.0,
            gps_timestamp=1000.0,
            latitude=None,
            longitude=None,
            gps_available=False,
            gps_speed=4.0,
            gps_heading=0.0,
        )
        continued_estimate = main.get_real_time_navigation(source="demo")

        self.assertEqual(continued_estimate.navigation_mode, "DEAD_RECKONING")
        self.assertGreater(continued_estimate.latitude, first_estimate.latitude)
        self.assertIsNone(main.demo_sensor_sample["latitude"])
        self.assertIsNone(main.demo_sensor_sample["longitude"])

    def test_demo_missing_motion_stops_integration_and_marks_position_unavailable(self):
        self.post_demo_sample(timestamp=1000.0, gps_timestamp=1000.0)

        self.clock.return_value = 103.2
        self.post_demo_sample(
            timestamp=1003.2,
            gps_timestamp=1000.0,
            latitude=None,
            longitude=None,
            gps_available=False,
            gps_speed=None,
            gps_heading=None,
        )
        unavailable = main.get_real_time_navigation(source="demo")
        held_position = (unavailable.latitude, unavailable.longitude)

        self.clock.return_value = 104.0
        self.post_demo_sample(
            timestamp=1004.0,
            gps_timestamp=1000.0,
            latitude=None,
            longitude=None,
            gps_available=False,
            gps_speed=None,
            gps_heading=None,
        )
        still_unavailable = main.get_real_time_navigation(source="demo")

        self.assertEqual(still_unavailable.navigation_mode, "DEAD_RECKONING_UNAVAILABLE")
        self.assertEqual((still_unavailable.latitude, still_unavailable.longitude), held_position)

    def test_demo_long_outage_uses_bounded_steps_and_recovers_to_new_gps_fix(self):
        self.post_demo_sample(timestamp=1000.0, gps_timestamp=1000.0)

        self.clock.return_value = 103.2
        self.post_demo_sample(
            timestamp=1003.2,
            gps_timestamp=1000.0,
            latitude=None,
            longitude=None,
            gps_available=False,
            gps_speed=4.0,
            gps_heading=90.0,
        )
        previous = main.get_real_time_navigation(source="demo")
        for index in range(1, 9):
            self.clock.return_value = 103.2 + index * 0.8
            self.post_demo_sample(
                timestamp=1003.2 + index * 0.8,
                gps_timestamp=1000.0,
                latitude=None,
                longitude=None,
                gps_available=False,
                gps_speed=4.0,
                gps_heading=90.0,
            )
            current = main.get_real_time_navigation(source="demo")
            self.assertEqual(current.navigation_mode, "DEAD_RECKONING")
            self.assertLessEqual(current.distance_since_last_gps, 60.0)
            previous = current

        self.assertGreater(previous.distance_since_last_gps, 20.0)
        self.clock.return_value = 110.0
        self.post_demo_sample(
            timestamp=1010.0,
            gps_timestamp=1010.0,
            latitude=12.5,
            longitude=77.5,
            gps_available=True,
            gps_speed=2.0,
            gps_heading=90.0,
        )
        recovered = main.get_real_time_navigation(source="demo")
        self.assertEqual(recovered.navigation_mode, "GPS")
        self.assertEqual((recovered.latitude, recovered.longitude), (12.5, 77.5))


if __name__ == "__main__":
    unittest.main()
