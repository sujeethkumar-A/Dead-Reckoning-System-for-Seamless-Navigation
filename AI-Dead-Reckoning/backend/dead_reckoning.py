import math
from dataclasses import dataclass
from typing import Optional

from schemas import NavigationStateResponse

EARTH_RADIUS_METERS = 6371000.0


@dataclass
class DeadReckoningState:
    estimated_latitude: float = 11.0
    estimated_longitude: float = 77.0
    last_gps_latitude: float = 11.0
    last_gps_longitude: float = 77.0
    last_gps_heading: float = 0.0
    last_timestamp: Optional[float] = None
    last_speed: float = 0.0
    last_heading: float = 0.0
    time_since_last_gps: float = 0.0
    distance_since_last_gps: float = 0.0
    gps_available: bool = True
    navigation_mode: str = "GPS"
    is_running: bool = False
    status: str = "Idle"

    def to_response(self) -> NavigationStateResponse:
        return NavigationStateResponse(
            latitude=self.estimated_latitude,
            longitude=self.estimated_longitude,
            speed=self.last_speed,
            heading=self.last_heading,
            dr_speed=self.last_speed,
            gps_available=self.gps_available,
            time_since_last_gps=self.time_since_last_gps,
            distance_since_last_gps=self.distance_since_last_gps,
            navigation_mode=self.navigation_mode,
            ml_enabled=False,
            ml_prediction_available=False,
            predicted_velocity_error=None,
            ml_corrected_speed=None,
            status=self.status,
        )


def initialize_navigation_state() -> DeadReckoningState:
    return DeadReckoningState(
        estimated_latitude=11.0,
        estimated_longitude=77.0,
        last_gps_latitude=11.0,
        last_gps_longitude=77.0,
        last_gps_heading=0.0,
        last_timestamp=None,
        last_speed=0.0,
        last_heading=0.0,
        time_since_last_gps=0.0,
        distance_since_last_gps=0.0,
        gps_available=True,
        navigation_mode="GPS",
        is_running=False,
        status="Initial state",
    )


def _clamp_speed(speed: float) -> float:
    value = float(speed)
    if not math.isfinite(value):
        raise ValueError("Speed must be finite.")
    return max(0.0, value)


def _normalize_longitude(value: float) -> float:
    while value > 180.0:
        value -= 360.0
    while value < -180.0:
        value += 360.0
    return value


def _normalize_latitude(value: float) -> float:
    return max(-90.0, min(90.0, value))


def sync_gps_update(
    state: DeadReckoningState,
    latitude: float,
    longitude: float,
    speed: float,
    heading: float,
    timestamp: float,
) -> DeadReckoningState:
    state.estimated_latitude = float(latitude)
    state.estimated_longitude = float(longitude)
    state.last_gps_latitude = float(latitude)
    state.last_gps_longitude = float(longitude)
    state.last_gps_heading = float(heading)
    state.last_speed = _clamp_speed(speed)
    state.last_heading = float(heading)
    state.last_timestamp = float(timestamp)
    state.time_since_last_gps = 0.0
    state.distance_since_last_gps = 0.0
    state.gps_available = True
    state.navigation_mode = "GPS"
    state.status = "GPS fix received"
    return state


def propagate_dead_reckoning(
    state: DeadReckoningState,
    speed: float,
    heading: float,
    timestamp: float,
) -> DeadReckoningState:
    speed = _clamp_speed(speed)
    heading_rad = float(heading)
    current_time = float(timestamp)
    if not math.isfinite(heading_rad):
        raise ValueError("Heading must be finite.")
    if not math.isfinite(current_time):
        raise ValueError("Timestamp must be finite.")

    if state.last_timestamp is None:
        state.last_timestamp = current_time
        state.last_speed = speed
        state.last_heading = heading_rad
        state.status = "First sensor update received"
        return state

    dt = current_time - state.last_timestamp

    if dt <= 0:
        state.last_speed = speed
        state.last_heading = heading_rad
        state.status = "Timestamp not advanced; keeping last state"
        return state

    dt = min(dt, 60.0)
    distance = speed * dt
    if distance > 0:
        # Internal heading uses east=0 and north=pi/2. Convert it to a
        # geodesic bearing measured clockwise from true north.
        bearing = (math.pi / 2.0 - heading_rad) % (2.0 * math.pi)
        latitude_1 = math.radians(state.estimated_latitude)
        longitude_1 = math.radians(state.estimated_longitude)
        angular_distance = distance / EARTH_RADIUS_METERS
        latitude_2 = math.asin(
            math.sin(latitude_1) * math.cos(angular_distance)
            + math.cos(latitude_1) * math.sin(angular_distance) * math.cos(bearing)
        )
        longitude_2 = longitude_1 + math.atan2(
            math.sin(bearing) * math.sin(angular_distance) * math.cos(latitude_1),
            math.cos(angular_distance) - math.sin(latitude_1) * math.sin(latitude_2),
        )
        state.estimated_latitude = _normalize_latitude(math.degrees(latitude_2))
        state.estimated_longitude = _normalize_longitude(math.degrees(longitude_2))
    state.last_speed = speed
    state.last_heading = heading_rad
    state.last_timestamp = current_time
    state.time_since_last_gps += dt
    state.distance_since_last_gps += distance
    state.gps_available = False
    state.navigation_mode = "DEAD_RECKONING"
    state.status = "GPS unavailable, dead reckoning active"
    return state
