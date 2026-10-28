import math
import unittest

from dead_reckoning import (
    EARTH_RADIUS_METERS,
    initialize_navigation_state,
    propagate_dead_reckoning,
)


class DeadReckoningMathTests(unittest.TestCase):
    def setUp(self):
        self.state = initialize_navigation_state()
        self.state.estimated_latitude = 0.0
        self.state.estimated_longitude = 0.0
        self.state.last_timestamp = 100.0

    def test_northbound_geodesic_uses_meters_and_elapsed_seconds(self):
        propagate_dead_reckoning(
            self.state,
            speed=5.0,
            heading=math.pi / 2.0,
            timestamp=102.0,
        )

        expected_latitude = math.degrees(10.0 / EARTH_RADIUS_METERS)
        self.assertAlmostEqual(self.state.estimated_latitude, expected_latitude, places=9)
        self.assertAlmostEqual(self.state.estimated_longitude, 0.0, places=9)
        self.assertAlmostEqual(self.state.distance_since_last_gps, 10.0)

    def test_eastbound_motion_and_turn_use_updated_heading(self):
        propagate_dead_reckoning(self.state, 2.0, math.pi / 2.0, 101.0)
        northbound_latitude = self.state.estimated_latitude

        propagate_dead_reckoning(self.state, 2.0, 0.0, 102.0)

        self.assertAlmostEqual(self.state.estimated_latitude, northbound_latitude, places=9)
        self.assertGreater(self.state.estimated_longitude, 0.0)

    def test_stationary_and_zero_speed_do_not_move_position(self):
        original_position = (self.state.estimated_latitude, self.state.estimated_longitude)

        propagate_dead_reckoning(self.state, 0.0, math.pi / 2.0, 101.0)

        self.assertEqual(
            (self.state.estimated_latitude, self.state.estimated_longitude),
            original_position,
        )
        self.assertEqual(self.state.distance_since_last_gps, 0.0)

    def test_non_advanced_timestamp_does_not_double_count_distance(self):
        original_position = (self.state.estimated_latitude, self.state.estimated_longitude)

        propagate_dead_reckoning(self.state, 5.0, 0.0, 100.0)

        self.assertEqual(
            (self.state.estimated_latitude, self.state.estimated_longitude),
            original_position,
        )
        self.assertEqual(self.state.distance_since_last_gps, 0.0)

    def test_long_elapsed_interval_is_bounded(self):
        propagate_dead_reckoning(self.state, 1.0, math.pi / 2.0, 1000.0)

        self.assertAlmostEqual(
            self.state.distance_since_last_gps,
            60.0,
        )

    def test_non_finite_motion_is_rejected(self):
        with self.assertRaises(ValueError):
            propagate_dead_reckoning(self.state, math.nan, 0.0, 101.0)
        with self.assertRaises(ValueError):
            propagate_dead_reckoning(self.state, 1.0, math.inf, 101.0)
        with self.assertRaises(ValueError):
            propagate_dead_reckoning(self.state, 1.0, 0.0, math.nan)


if __name__ == "__main__":
    unittest.main()
