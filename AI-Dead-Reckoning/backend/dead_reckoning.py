import math
from dataclasses import dataclass, field
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
    return max(0.0, float(speed))


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

    if state.last_timestamp is None:
        state.last_timestamp = float(timestamp)
        state.last_speed = speed
        state.last_heading = float(heading)
        state.status = "First sensor update received"
        return state

    current_time = float(timestamp)
    dt = current_time - state.last_timestamp

    if dt <= 0:
        state.last_speed = speed
        state.last_heading = float(heading)
        state.status = "Timestamp not advanced; keeping last state"
        return state

    dt = min(dt, 60.0)
    distance = speed * dt

    heading_rad = float(heading)
    dx = distance * math.cos(heading_rad)
    dy = distance * math.sin(heading_rad)

    lat_radians = math.radians(state.estimated_latitude)
    cos_lat = math.cos(lat_radians)
    if abs(cos_lat) < 1e-9:
        cos_lat = 1e-9

    latitude_change = math.degrees(dy / EARTH_RADIUS_METERS)
    longitude_change = math.degrees(dx / (EARTH_RADIUS_METERS * cos_lat))

    state.estimated_latitude = _normalize_latitude(state.estimated_latitude + latitude_change)
    state.estimated_longitude = _normalize_longitude(state.estimated_longitude + longitude_change)
    state.last_speed = speed
    state.last_heading = float(heading)
    state.last_timestamp = current_time
    state.time_since_last_gps += dt
    state.distance_since_last_gps += distance
    state.gps_available = False
    state.navigation_mode = "DEAD_RECKONING"
    state.status = "GPS unavailable, dead reckoning active"
    return state
