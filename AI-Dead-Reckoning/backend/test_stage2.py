import math
import unittest
from unittest.mock import patch

from fastapi import HTTPException

import main
from schemas import SensorDataPayload


class RealTimeNavigationTests(unittest.TestCase):
    def setUp(self):
        main.navigation_state = main.initialize_navigation_state()
        main.latest_sensor_sample = None
        main._reset_sensor_navigation_tracking()
        self.clock_patch = patch("main.time.monotonic", return_value=100.0)
        self.clock = self.clock_patch.start()

    def tearDown(self):
        self.clock_patch.stop()

    def post_sample(
        self,
        *,
        timestamp,
        gps_timestamp,
        latitude=12.0,
        longitude=77.0,
        gps_speed=4.0,
        gps_heading=0.0,
        gps_available=True,
        gps_accuracy=2.0,
    ):
        return main.receive_sensor_data(
            SensorDataPayload(
                timestamp=timestamp,
                gps_timestamp=gps_timestamp,
                latitude=latitude,
                longitude=longitude,
                gps_speed=gps_speed,
                gps_heading=gps_heading,
                gps_accuracy=gps_accuracy,
                gps_available=gps_available,
                accel_x=0.1,
                accel_y=0.2,
                accel_z=9.8,
                gyro_alpha=0.01,
                gyro_beta=0.02,
                gyro_gamma=0.03,
            )
        )

    def test_gps_timeout_uses_last_real_motion_measurements(self):
        self.post_sample(timestamp=1000.0, gps_timestamp=1000.0)

        self.clock.return_value = 103.2
        # The page keeps sending the last fix, but its GPS timestamp does not advance.
        self.post_sample(
            timestamp=1003.2,
            gps_timestamp=1000.0,
            gps_available=True,
        )
        response = main.get_real_time_navigation()

        self.assertFalse(response.gps_available)
        self.assertEqual(response.navigation_mode, "DEAD_RECKONING")
        self.assertGreater(response.latitude, 12.0)
        self.assertAlmostEqual(response.heading, math.pi / 2.0)

    def test_new_gps_fix_recovers_and_synchronizes_position(self):
        self.post_sample(timestamp=1000.0, gps_timestamp=1000.0)
        self.clock.return_value = 103.1
        timed_out = main.get_real_time_navigation()
        self.assertFalse(timed_out.gps_available)

        self.clock.return_value = 103.2
        self.post_sample(
            timestamp=1003.2,
            gps_timestamp=1003.2,
            latitude=12.5,
            longitude=77.5,
            gps_speed=2.0,
            gps_heading=90.0,
        )
        recovered = main.get_real_time_navigation()

        self.assertTrue(recovered.gps_available)
        self.assertEqual(recovered.navigation_mode, "GPS")
        self.assertEqual(recovered.latitude, 12.5)
        self.assertEqual(recovered.longitude, 77.5)
        self.assertAlmostEqual(recovered.heading, 0.0)

    def test_missing_motion_measurements_do_not_create_movement(self):
        self.post_sample(
            timestamp=1000.0,
            gps_timestamp=1000.0,
            gps_speed=None,
            gps_heading=None,
        )
        self.clock.return_value = 103.1
        response = main.get_real_time_navigation()

        self.assertFalse(response.gps_available)
        self.assertEqual(response.navigation_mode, "DEAD_RECKONING_UNAVAILABLE")
        self.assertEqual(response.latitude, 12.0)
        self.assertEqual(response.longitude, 77.0)
        self.assertIn("position unavailable", response.status)

    def test_imu_values_are_not_used_as_speed_or_heading(self):
        self.post_sample(
            timestamp=1000.0,
            gps_timestamp=1000.0,
            gps_speed=None,
            gps_heading=None,
        )
        main.latest_sensor_sample["accel_x"] = 1000.0
        main.latest_sensor_sample["gyro_gamma"] = 360.0
        self.clock.return_value = 103.1

        response = main.get_real_time_navigation()

        self.assertEqual(response.navigation_mode, "DEAD_RECKONING_UNAVAILABLE")
        self.assertEqual(response.latitude, 12.0)
        self.assertEqual(response.longitude, 77.0)

    def test_stale_gps_motion_estimate_expires_without_further_movement(self):
        self.post_sample(timestamp=1000.0, gps_timestamp=1000.0)
        self.clock.return_value = 103.1
        bounded_estimate = main.get_real_time_navigation()
        self.assertEqual(bounded_estimate.navigation_mode, "DEAD_RECKONING")
        self.assertGreater(bounded_estimate.latitude, 12.0)

        self.clock.return_value = 105.1

        response = main.get_real_time_navigation()

        self.assertEqual(response.navigation_mode, "DEAD_RECKONING_UNAVAILABLE")
        self.assertEqual(response.latitude, bounded_estimate.latitude)
        self.assertEqual(response.longitude, bounded_estimate.longitude)
        self.assertIn("stale", response.status)

    def test_repeated_gps_fixes_without_motion_do_not_refresh_old_estimate(self):
        self.post_sample(timestamp=1000.0, gps_timestamp=1000.0)
        self.clock.return_value = 102.0
        self.post_sample(
            timestamp=1002.0,
            gps_timestamp=1002.0,
            gps_speed=None,
            gps_heading=None,
        )
        self.clock.return_value = 105.1

        response = main.get_real_time_navigation()

        self.assertEqual(response.navigation_mode, "DEAD_RECKONING_UNAVAILABLE")
        self.assertIn("stale", response.status)
        self.assertEqual(response.latitude, 12.0)
        self.assertEqual(response.longitude, 77.0)

    def test_implausible_gps_speed_is_not_propagated(self):
        self.post_sample(
            timestamp=1000.0,
            gps_timestamp=1000.0,
            gps_speed=80.0,
            gps_heading=0.0,
        )
        self.clock.return_value = 103.1

        response = main.get_real_time_navigation()

        self.assertEqual(response.navigation_mode, "DEAD_RECKONING_UNAVAILABLE")
        self.assertEqual(response.latitude, 12.0)
        self.assertEqual(response.longitude, 77.0)

    def test_stale_gps_timestamp_is_not_treated_as_a_fresh_fix(self):
        self.post_sample(
            timestamp=1005.0,
            gps_timestamp=1000.0,
        )

        response = main.get_real_time_navigation()

        self.assertFalse(response.gps_available)
        self.assertEqual(response.navigation_mode, "WAITING_FOR_GPS")
        self.assertEqual(response.latitude, 11.0)
        self.assertEqual(response.longitude, 77.0)

    def test_delayed_fix_uses_its_actual_age_for_gps_timeout(self):
        self.post_sample(
            timestamp=1002.0,
            gps_timestamp=1000.0,
        )
        self.assertTrue(main.get_real_time_navigation().gps_available)

        self.clock.return_value = 101.1
        response = main.get_real_time_navigation()

        self.assertFalse(response.gps_available)
        self.assertEqual(response.navigation_mode, "DEAD_RECKONING")
        self.assertAlmostEqual(response.time_since_last_gps, 3.1)

    def test_gps_position_deltas_estimate_bounded_speed_and_course(self):
        self.post_sample(
            timestamp=1000.0,
            gps_timestamp=1000.0,
            gps_speed=None,
            gps_heading=None,
            gps_accuracy=1.0,
        )
        self.clock.return_value = 102.0
        northward_latitude = 12.00009
        self.post_sample(
            timestamp=1002.0,
            gps_timestamp=1002.0,
            latitude=northward_latitude,
            gps_speed=None,
            gps_heading=None,
            gps_accuracy=1.0,
        )
        self.clock.return_value = 105.2

        response = main.get_real_time_navigation()

        self.assertEqual(response.navigation_mode, "DEAD_RECKONING")
        self.assertGreater(response.latitude, northward_latitude)
        self.assertAlmostEqual(response.heading, math.pi / 2.0, places=3)
        self.assertLessEqual(response.distance_since_last_gps, 20.0)

    def test_real_sensor_source_defaults_to_real_and_rejects_demo_samples(self):
        real_sample = SensorDataPayload(timestamp=1000.0)
        self.assertEqual(real_sample.source, "real")

        main.receive_sensor_data(
            SensorDataPayload(timestamp=1001.0, source="real")
        )
        self.assertEqual(main.latest_sensor_sample["source"], "real")

        with self.assertRaises(HTTPException) as error:
            main.receive_sensor_data(
                SensorDataPayload(timestamp=1002.0, source="demo")
            )

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(main.latest_sensor_sample["timestamp"], 1001.0)


if __name__ == "__main__":
    unittest.main()
