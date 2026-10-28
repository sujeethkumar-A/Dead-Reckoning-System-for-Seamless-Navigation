import math
import time
from collections import deque
from typing import Deque, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from dead_reckoning import (
    DeadReckoningState,
    initialize_navigation_state,
    propagate_dead_reckoning,
    sync_gps_update,
)
from ml_model import MODEL_FEATURES, MLModel
from schemas import (
    MLToggleRequest,
    NavigationStateResponse,
    NavigationUpdateRequest,
    SensorDataPayload,
)

EARTH_RADIUS_METERS = 6371000.0
GPS_TIMEOUT_SECONDS = 3.0
MAX_MOVEMENT_ESTIMATE_AGE_SECONDS = 5.0
MAX_DEAD_RECKONING_SECONDS = 5.0
MAX_DEAD_RECKONING_DISTANCE_METERS = 20.0
MAX_WALKING_SPEED_METERS_PER_SECOND = 8.0
MAX_DEMO_SPEED_METERS_PER_SECOND = 25.0
MAX_GPS_ACCURACY_METERS = 50.0
MAX_DERIVED_GPS_ACCURACY_METERS = 15.0

app = FastAPI(
    title="AI Dead Reckoning System",
    description="Dead reckoning with optional experimental ML speed correction.",
    version="0.4.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _initialize_demo_navigation_state() -> DeadReckoningState:
    state = initialize_navigation_state()
    state.gps_available = False
    state.navigation_mode = "WAITING_FOR_GPS"
    state.status = "Waiting for a demo GPS fix"
    return state


navigation_state: DeadReckoningState = initialize_navigation_state()
demo_navigation_state: DeadReckoningState = _initialize_demo_navigation_state()
ml_model = MLModel()
ml_enabled = False
sensor_history: Deque[dict] = deque(maxlen=600)
latest_sensor_sample: Optional[dict] = None
demo_sensor_sample: Optional[dict] = None
_last_valid_gps_timestamp: Optional[float] = None
_last_valid_gps_received_at: Optional[float] = None
_last_real_gps_speed: Optional[float] = None
_last_real_gps_heading: Optional[float] = None
_last_real_motion_received_at: Optional[float] = None
_last_real_gps_position_reference: Optional[dict] = None
_demo_last_valid_gps_timestamp: Optional[float] = None
_demo_last_valid_gps_received_at: Optional[float] = None
_demo_gps_speed: Optional[float] = None
_demo_gps_heading: Optional[float] = None
_demo_motion_received_at: Optional[float] = None
_demo_gps_position_reference: Optional[dict] = None


def _reset_sensor_navigation_tracking() -> None:
    global _last_valid_gps_timestamp
    global _last_valid_gps_received_at
    global _last_real_gps_speed
    global _last_real_gps_heading
    global _last_real_motion_received_at
    global _last_real_gps_position_reference

    _last_valid_gps_timestamp = None
    _last_valid_gps_received_at = None
    _last_real_gps_speed = None
    _last_real_gps_heading = None
    _last_real_motion_received_at = None
    _last_real_gps_position_reference = None


def _speed_limit_for_payload(payload: SensorDataPayload) -> float:
    return (
        MAX_DEMO_SPEED_METERS_PER_SECOND
        if payload.source == "demo"
        else MAX_WALKING_SPEED_METERS_PER_SECOND
    )


def _is_valid_gps_sample(payload: SensorDataPayload) -> bool:
    gps_fix_is_recent = (
        payload.gps_timestamp is None
        or -1.0 <= payload.timestamp - payload.gps_timestamp <= GPS_TIMEOUT_SECONDS
    )
    max_speed = _speed_limit_for_payload(payload)
    return (
        payload.gps_available
        and payload.latitude is not None
        and payload.longitude is not None
        and math.isfinite(payload.latitude)
        and math.isfinite(payload.longitude)
        and -90.0 <= payload.latitude <= 90.0
        and -180.0 <= payload.longitude <= 180.0
        and (
            payload.gps_accuracy is None
            or payload.gps_accuracy <= MAX_GPS_ACCURACY_METERS
        )
        and (payload.gps_speed is None or payload.gps_speed <= max_speed)
        and gps_fix_is_recent
    )


def _gps_heading_to_radians(heading_degrees: float) -> float:
    return math.radians((90.0 - heading_degrees) % 360.0)


def _gps_motion_estimate(
    payload: SensorDataPayload,
    previous_fix: Optional[dict],
) -> tuple[Optional[tuple[float, Optional[float]]], Optional[dict]]:
    """Prefer GPS speed/course; otherwise derive net speed and bearing from two fixes.

    GPS-delta estimates require accurate fixes, sufficient displacement above
    reported uncertainty, a short baseline, and plausible walking speed. Raw
    accelerometer/gyroscope data is not integrated into position.
    """
    timestamp = (
        float(payload.gps_timestamp)
        if payload.gps_timestamp is not None
        else float(payload.timestamp)
    )
    accuracy = payload.gps_accuracy
    current_fix = {
        "timestamp": timestamp,
        "latitude": float(payload.latitude),
        "longitude": float(payload.longitude),
        "accuracy": accuracy,
    }

    accuracy_is_acceptable = (
        accuracy is None or accuracy <= MAX_GPS_ACCURACY_METERS
    )
    max_speed = _speed_limit_for_payload(payload)
    if (
        accuracy_is_acceptable
        and payload.gps_speed is not None
        and payload.gps_heading is not None
        and 0.0 <= payload.gps_speed <= max_speed
        and 0.0 <= payload.gps_heading <= 360.0
    ):
        return (
            (float(payload.gps_speed), _gps_heading_to_radians(float(payload.gps_heading))),
            current_fix,
        )

    if payload.gps_speed == 0 and accuracy_is_acceptable:
        return (0.0, None), current_fix

    if previous_fix is None or accuracy is None or accuracy > MAX_DERIVED_GPS_ACCURACY_METERS:
        return None, current_fix

    previous_accuracy = previous_fix["accuracy"]
    elapsed = timestamp - previous_fix["timestamp"]
    if (
        previous_accuracy is None
        or previous_accuracy > MAX_DERIVED_GPS_ACCURACY_METERS
        or not 0.5 <= elapsed <= MAX_MOVEMENT_ESTIMATE_AGE_SECONDS
    ):
        return None, current_fix

    latitude_1 = math.radians(previous_fix["latitude"])
    latitude_2 = math.radians(current_fix["latitude"])
    longitude_delta = math.radians(current_fix["longitude"] - previous_fix["longitude"])
    latitude_delta = latitude_2 - latitude_1
    haversine = (
        math.sin(latitude_delta / 2.0) ** 2
        + math.cos(latitude_1) * math.cos(latitude_2)
        * math.sin(longitude_delta / 2.0) ** 2
    )
    distance = 2.0 * EARTH_RADIUS_METERS * math.asin(min(1.0, math.sqrt(haversine)))
    minimum_displacement = max(3.0, (float(accuracy) + float(previous_accuracy)) / 2.0)
    speed = distance / elapsed
    if (
        distance < minimum_displacement
        or speed < 0.3
        or speed > max_speed
    ):
        # Keep the reference fix so small increments can accumulate without
        # treating each noisy GPS sample as real movement.
        return None, previous_fix

    bearing = math.atan2(
        math.sin(longitude_delta) * math.cos(latitude_2),
        math.cos(latitude_1) * math.sin(latitude_2)
        - math.sin(latitude_1) * math.cos(latitude_2) * math.cos(longitude_delta),
    )
    compass_heading = (math.degrees(bearing) + 360.0) % 360.0
    return (speed, _gps_heading_to_radians(compass_heading)), current_fix


def _refresh_navigation_state(
    state: DeadReckoningState,
    last_gps_received_at: Optional[float],
    last_gps_timestamp: Optional[float],
    gps_speed: Optional[float],
    gps_heading: Optional[float],
    motion_received_at: Optional[float],
    now: float,
    waiting_status: str = "Waiting for a valid GPS fix",
) -> DeadReckoningState:
    gps_is_fresh = (
        last_gps_received_at is not None
        and now - last_gps_received_at < GPS_TIMEOUT_SECONDS
    )
    if gps_is_fresh:
        state.gps_available = True
        state.navigation_mode = "GPS"
        return state

    state.gps_available = False
    if last_gps_received_at is None:
        state.navigation_mode = "WAITING_FOR_GPS"
        state.status = waiting_status
        return state

    state.navigation_mode = "DEAD_RECKONING_UNAVAILABLE"
    state.time_since_last_gps = max(0.0, now - last_gps_received_at)
    if (
        last_gps_timestamp is None
        or gps_speed is None
        or gps_heading is None
        or motion_received_at is None
    ):
        state.status = "GPS unavailable; dead-reckoning position unavailable (no valid GPS speed and heading)"
        return state

    motion_age = max(0.0, now - motion_received_at)
    gps_age = max(0.0, now - last_gps_received_at)
    if motion_age > MAX_MOVEMENT_ESTIMATE_AGE_SECONDS:
        state.status = "GPS unavailable; dead-reckoning position unavailable (movement estimate is stale)"
        return state

    if gps_age > MAX_DEAD_RECKONING_SECONDS:
        state.status = "GPS unavailable; dead-reckoning estimate reached its safe time limit"
        return state

    elapsed = min(gps_age, MAX_DEAD_RECKONING_SECONDS)
    if gps_speed > 0.0:
        elapsed = min(elapsed, MAX_DEAD_RECKONING_DISTANCE_METERS / gps_speed)

    # Recompute from the last GPS fix on every refresh. This avoids integrating
    # stale motion into an unbounded, cumulative position drift.
    state.estimated_latitude = state.last_gps_latitude
    state.estimated_longitude = state.last_gps_longitude
    state.last_timestamp = last_gps_timestamp
    state.time_since_last_gps = 0.0
    state.distance_since_last_gps = 0.0
    propagate_dead_reckoning(
        state,
        speed=gps_speed,
        heading=gps_heading,
        timestamp=last_gps_timestamp + elapsed,
    )
    state.time_since_last_gps = gps_age
    return state


def _refresh_real_time_navigation(now: float) -> None:
    global navigation_state
    navigation_state = _refresh_navigation_state(
        navigation_state,
        _last_valid_gps_received_at,
        _last_valid_gps_timestamp,
        _last_real_gps_speed,
        _last_real_gps_heading,
        _last_real_motion_received_at,
        now,
    )


def _refresh_demo_navigation(now: float) -> None:
    global demo_navigation_state
    if (
        _demo_last_valid_gps_received_at is not None
        and now - _demo_last_valid_gps_received_at >= GPS_TIMEOUT_SECONDS
        and demo_navigation_state.navigation_mode
        in ("DEAD_RECKONING", "DEAD_RECKONING_UNAVAILABLE")
    ):
        demo_navigation_state.gps_available = False
        demo_navigation_state.time_since_last_gps = max(
            0.0,
            now - _demo_last_valid_gps_received_at,
        )
        motion_age = (
            math.inf
            if _demo_motion_received_at is None
            else max(0.0, now - _demo_motion_received_at)
        )
        if motion_age > MAX_MOVEMENT_ESTIMATE_AGE_SECONDS:
            demo_navigation_state.navigation_mode = "DEAD_RECKONING_UNAVAILABLE"
            demo_navigation_state.status = (
                "GPS unavailable; demo position estimate unavailable "
                "(simulated movement input is stale)"
            )
        return

    demo_navigation_state = _refresh_navigation_state(
        demo_navigation_state,
        _demo_last_valid_gps_received_at,
        _demo_last_valid_gps_timestamp,
        _demo_gps_speed,
        _demo_gps_heading,
        _demo_motion_received_at,
        now,
        waiting_status="Waiting for a demo GPS fix",
    )


def _angle_delta_degrees(current_heading: float, reference_heading: float) -> float:
    delta = (current_heading - reference_heading + 180.0) % 360.0 - 180.0
    return abs(delta)


def _safe_mean(values):
    values = [float(v) for v in values if v is not None]
    return sum(values) / len(values) if values else 0.0


def _safe_std(values):
    values = [float(v) for v in values if v is not None]
    if len(values) < 2:
        return 0.0
    mean_value = _safe_mean(values)
    variance = sum((v - mean_value) ** 2 for v in values) / len(values)
    return math.sqrt(variance)


def _record_sensor_sample(request: NavigationUpdateRequest) -> None:
    sensor_history.append(
        {
            "timestamp": float(request.timestamp),
            "accel_x": float(request.accel_x),
            "accel_y": float(request.accel_y),
            "gyro_z": float(request.gyro_z),
            "speed": float(request.speed),
            "heading": float(request.heading),
        }
    )


def _get_recent_window(window_seconds: float):
    if not sensor_history:
        return []
    current_time = max(item["timestamp"] for item in sensor_history)
    return [item for item in sensor_history if (current_time - item["timestamp"]) <= window_seconds]


def _compute_ml_features(request: NavigationUpdateRequest) -> Optional[list[float]]:
    try:
        heading_rad = math.radians(float(request.heading))
        heading_sin = math.sin(heading_rad)
        heading_cos = math.cos(heading_rad)

        dr_speed = navigation_state.last_speed
        if navigation_state.time_since_last_gps > 0:
            dr_speed = navigation_state.distance_since_last_gps / max(navigation_state.time_since_last_gps, 1e-6)

        recent_1s = _get_recent_window(1.0)
        recent_5s = _get_recent_window(5.0)
        gyro_z_mean_1s = _safe_mean([item["gyro_z"] for item in recent_1s])
        gyro_z_std_5s = _safe_std([item["gyro_z"] for item in recent_5s])
        accel_x_mean_1s = _safe_mean([item["accel_x"] for item in recent_1s])
        accel_y_mean_1s = _safe_mean([item["accel_y"] for item in recent_1s])
        accel_x_std_5s = _safe_std([item["accel_x"] for item in recent_5s])

        speed_values = [item["speed"] for item in recent_1s]
        speed_delta_1s = 0.0
        if len(speed_values) >= 2:
            speed_delta_1s = speed_values[-1] - speed_values[0]

        path_since_fix = float(navigation_state.distance_since_last_gps)
        heading_change_since_fix = _angle_delta_degrees(float(request.heading), float(navigation_state.last_gps_heading))

        lat_diff = math.radians(navigation_state.estimated_latitude) - math.radians(navigation_state.last_gps_latitude)
        lon_diff = math.radians(navigation_state.estimated_longitude) - math.radians(navigation_state.last_gps_longitude)
        mid_lat = (math.radians(navigation_state.estimated_latitude) + math.radians(navigation_state.last_gps_latitude)) / 2.0
        dr_dx_from_fix = EARTH_RADIUS_METERS * lon_diff * math.cos(mid_lat)
        dr_dy_from_fix = EARTH_RADIUS_METERS * lat_diff
        dr_dist_from_fix = math.hypot(dr_dx_from_fix, dr_dy_from_fix)

        # These are runtime approximations only. They are not true sensor-bias calibrations.
        gyro_bias_est = abs(gyro_z_mean_1s)
        accel_bias_est = abs((accel_x_mean_1s + accel_y_mean_1s) / 2.0)
        speed_bias_est = abs(speed_delta_1s)

        feature_vector = [
            float(request.accel_x),
            float(request.accel_y),
            float(request.gyro_z),
            float(request.speed),
            float(heading_sin),
            float(heading_cos),
            float(dr_speed),
            float(navigation_state.time_since_last_gps),
            float(path_since_fix),
            float(heading_change_since_fix),
            float(dr_dx_from_fix),
            float(dr_dy_from_fix),
            float(dr_dist_from_fix),
            float(gyro_z_mean_1s),
            float(gyro_z_std_5s),
            float(accel_x_mean_1s),
            float(accel_y_mean_1s),
            float(accel_x_std_5s),
            float(speed_delta_1s),
            float(gyro_bias_est),
            float(accel_bias_est),
            float(speed_bias_est),
        ]

        if len(feature_vector) != len(MODEL_FEATURES):
            return None
        return feature_vector
    except Exception:
        return None


@app.get("/")
def read_root() -> dict:
    return {
        "project": "AI Dead Reckoning System",
        "status": "running",
        "backend": "FastAPI",
        "stage": "Stage 4 - ML Integration",
    }


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "AI Dead Reckoning System",
        "backend_connected": True,
        "ml_enabled": bool(ml_enabled and ml_model.ml_enabled),
        "ml_status": ml_model.ml_status,
    }


@app.post("/navigation/ml")
def set_ml_mode(request: MLToggleRequest) -> dict:
    global ml_enabled
    if not ml_model.ml_enabled:
        ml_enabled = False
        return {
            "ml_enabled": False,
            "model_available": False,
            "message": "ML model is not available",
        }

    ml_enabled = bool(request.enabled)
    return {
        "ml_enabled": ml_enabled,
        "model_available": True,
        "message": "ML mode updated",
    }


@app.post("/navigation/start")
def start_navigation() -> NavigationStateResponse:
    global navigation_state
    navigation_state = initialize_navigation_state()
    _reset_sensor_navigation_tracking()
    navigation_state.is_running = True
    navigation_state.status = "Navigation started"
    return navigation_state.to_response()


@app.post("/navigation/reset")
def reset_navigation() -> NavigationStateResponse:
    global navigation_state
    navigation_state = initialize_navigation_state()
    _reset_sensor_navigation_tracking()
    navigation_state.status = "System reset"
    return navigation_state.to_response()


@app.post("/navigation/update")
def update_navigation(request: NavigationUpdateRequest) -> NavigationStateResponse:
    global navigation_state

    if not navigation_state.is_running:
        raise HTTPException(status_code=400, detail="Navigation has not started. Call /navigation/start first.")

    if request.timestamp < 0:
        raise HTTPException(status_code=400, detail="Timestamp must be non-negative.")

    if not (-90.0 <= request.latitude <= 90.0):
        raise HTTPException(status_code=400, detail="Latitude must be between -90 and 90 degrees.")

    if not (-180.0 <= request.longitude <= 180.0):
        raise HTTPException(status_code=400, detail="Longitude must be between -180 and 180 degrees.")

    if request.speed < 0:
        request.speed = 0.0

    _record_sensor_sample(request)

    if request.gps_available:
        navigation_state = sync_gps_update(
            navigation_state,
            latitude=request.latitude,
            longitude=request.longitude,
            speed=request.speed,
            heading=request.heading,
            timestamp=request.timestamp,
        )
        return NavigationStateResponse(
            latitude=navigation_state.estimated_latitude,
            longitude=navigation_state.estimated_longitude,
            speed=navigation_state.last_speed,
            heading=navigation_state.last_heading,
            dr_speed=navigation_state.last_speed,
            gps_available=True,
            time_since_last_gps=0.0,
            distance_since_last_gps=0.0,
            navigation_mode="GPS",
            ml_enabled=bool(ml_enabled and ml_model.ml_enabled),
            ml_prediction_available=False,
            predicted_velocity_error=None,
            ml_corrected_speed=None,
            status="GPS fix received",
        )

    navigation_state = propagate_dead_reckoning(
        navigation_state,
        speed=request.speed,
        heading=request.heading,
        timestamp=request.timestamp,
    )

    dr_speed = navigation_state.last_speed
    ml_prediction_available = False
    predicted_velocity_error = None
    ml_corrected_speed = None

    if bool(ml_enabled and ml_model.ml_enabled):
        feature_vector = _compute_ml_features(request)
        if feature_vector is not None:
            prediction = ml_model.predict(feature_vector)
            if prediction is not None and math.isfinite(float(prediction)):
                predicted_velocity_error = float(prediction)
                ml_corrected_speed = max(float(request.speed) - predicted_velocity_error, 0.0)
                ml_prediction_available = True

    return NavigationStateResponse(
        latitude=navigation_state.estimated_latitude,
        longitude=navigation_state.estimated_longitude,
        speed=navigation_state.last_speed,
        heading=navigation_state.last_heading,
        dr_speed=dr_speed,
        gps_available=False,
        time_since_last_gps=navigation_state.time_since_last_gps,
        distance_since_last_gps=navigation_state.distance_since_last_gps,
        navigation_mode="DEAD_RECKONING",
        ml_enabled=bool(ml_enabled and ml_model.ml_enabled),
        ml_prediction_available=ml_prediction_available,
        predicted_velocity_error=predicted_velocity_error,
        ml_corrected_speed=ml_corrected_speed,
        status=navigation_state.status,
    )


@app.get("/navigation/state")
def get_navigation_state() -> NavigationStateResponse:
    return _navigation_state_response(navigation_state)


def _navigation_state_response(state: DeadReckoningState) -> NavigationStateResponse:
    return NavigationStateResponse(
        latitude=state.estimated_latitude,
        longitude=state.estimated_longitude,
        speed=state.last_speed,
        heading=state.last_heading,
        dr_speed=state.last_speed,
        gps_available=state.gps_available,
        time_since_last_gps=state.time_since_last_gps,
        distance_since_last_gps=state.distance_since_last_gps,
        navigation_mode=state.navigation_mode,
        ml_enabled=bool(ml_enabled and ml_model.ml_enabled),
        ml_prediction_available=False,
        predicted_velocity_error=None,
        ml_corrected_speed=None,
        status=state.status,
    )


@app.get("/navigation/real-time")
def get_real_time_navigation(
    source: Literal["real", "demo"] = "real",
) -> NavigationStateResponse:
    now = time.monotonic()
    if source == "demo":
        _refresh_demo_navigation(now)
        return _navigation_state_response(demo_navigation_state)
    _refresh_real_time_navigation(now)
    return get_navigation_state()


@app.post("/ml/test")
def ml_test() -> dict:
    if not ml_model.ml_enabled or ml_model.model is None:
        return {
            "ml_enabled": False,
            "prediction": None,
            "message": "ML model is not available",
        }

    sample = [
        0.10,
        0.05,
        0.01,
        8.5,
        0.75,
        0.66,
        8.4,
        0.5,
        12.0,
        0.03,
        1.1,
        0.8,
        1.5,
        0.01,
        0.02,
        0.08,
        0.06,
        0.03,
        0.10,
        0.00,
        0.01,
        0.02,
    ]

    if len(sample) != len(MODEL_FEATURES):
        return {
            "ml_enabled": False,
            "prediction": None,
            "message": "ML feature set is invalid",
        }

    prediction = ml_model.predict(sample)
    if prediction is None:
        return {
            "ml_enabled": False,
            "prediction": None,
            "message": "ML model prediction failed",
        }

    return {
        "ml_enabled": True,
        "prediction": float(prediction),
    }


@app.post("/sensor-data")
def receive_sensor_data(payload: SensorDataPayload) -> dict:
    global latest_sensor_sample
    global navigation_state
    global _last_valid_gps_timestamp
    global _last_valid_gps_received_at
    global _last_real_gps_speed
    global _last_real_gps_heading
    global _last_real_motion_received_at
    global _last_real_gps_position_reference

    if payload.source != "real":
        raise HTTPException(
            status_code=400,
            detail="Demo samples must use /navigation/demo/sensor-data.",
        )

    received_at = time.monotonic()
    latest_sensor_sample = payload.model_dump()

    if _is_valid_gps_sample(payload):
        gps_timestamp = (
            float(payload.gps_timestamp)
            if payload.gps_timestamp is not None
            else float(payload.timestamp)
        )
        is_new_gps_fix = (
            _last_valid_gps_timestamp is None
            or gps_timestamp > _last_valid_gps_timestamp
        )
        if is_new_gps_fix:
            _last_valid_gps_timestamp = gps_timestamp
            fix_received_at = received_at - max(
                0.0,
                float(payload.timestamp) - gps_timestamp,
            )
            _last_valid_gps_received_at = fix_received_at

            motion, _last_real_gps_position_reference = _gps_motion_estimate(
                payload,
                _last_real_gps_position_reference,
            )
            if motion is None:
                if (
                    (payload.gps_accuracy is not None and payload.gps_accuracy > MAX_GPS_ACCURACY_METERS)
                    or (
                        payload.gps_speed is not None
                        and payload.gps_speed > MAX_WALKING_SPEED_METERS_PER_SECOND
                    )
                ):
                    _last_real_gps_speed = None
                    _last_real_gps_heading = None
                    _last_real_motion_received_at = None
            else:
                _last_real_gps_speed, _last_real_gps_heading = motion
                _last_real_motion_received_at = fix_received_at

            navigation_state = sync_gps_update(
                navigation_state,
                latitude=float(payload.latitude),
                longitude=float(payload.longitude),
                speed=_last_real_gps_speed or 0.0,
                heading=(
                    _last_real_gps_heading
                    if _last_real_gps_heading is not None
                    else navigation_state.last_heading
                ),
                timestamp=gps_timestamp,
            )

    _refresh_real_time_navigation(received_at)
    return {
        "status": "success",
        "message": "Sensor sample stored",
        "sample": latest_sensor_sample,
    }


@app.get("/sensor-data/latest")
def get_latest_sensor_data() -> Optional[dict]:
    return latest_sensor_sample


@app.post("/navigation/demo/reset")
def reset_demo_navigation() -> NavigationStateResponse:
    global demo_navigation_state
    global demo_sensor_sample
    global _demo_last_valid_gps_timestamp
    global _demo_last_valid_gps_received_at
    global _demo_gps_speed
    global _demo_gps_heading
    global _demo_motion_received_at
    global _demo_gps_position_reference

    demo_navigation_state = _initialize_demo_navigation_state()
    demo_sensor_sample = None
    _demo_last_valid_gps_timestamp = None
    _demo_last_valid_gps_received_at = None
    _demo_gps_speed = None
    _demo_gps_heading = None
    _demo_motion_received_at = None
    _demo_gps_position_reference = None
    return _navigation_state_response(demo_navigation_state)


@app.post("/navigation/demo/sensor-data")
def receive_demo_sensor_data(payload: SensorDataPayload) -> dict:
    global demo_navigation_state
    global demo_sensor_sample
    global _demo_last_valid_gps_timestamp
    global _demo_last_valid_gps_received_at
    global _demo_gps_speed
    global _demo_gps_heading
    global _demo_motion_received_at
    global _demo_gps_position_reference

    if payload.source != "demo":
        raise HTTPException(status_code=400, detail="Demo samples must use source 'demo'.")

    received_at = time.monotonic()
    demo_sensor_sample = payload.model_dump()

    if _is_valid_gps_sample(payload):
        gps_timestamp = (
            float(payload.gps_timestamp)
            if payload.gps_timestamp is not None
            else float(payload.timestamp)
        )
        is_new_gps_fix = (
            _demo_last_valid_gps_timestamp is None
            or gps_timestamp > _demo_last_valid_gps_timestamp
        )
        if is_new_gps_fix:
            _demo_last_valid_gps_timestamp = gps_timestamp
            fix_received_at = received_at - max(
                0.0,
                float(payload.timestamp) - gps_timestamp,
            )
            _demo_last_valid_gps_received_at = fix_received_at

            motion, _demo_gps_position_reference = _gps_motion_estimate(
                payload,
                _demo_gps_position_reference,
            )
            if motion is None:
                max_speed = _speed_limit_for_payload(payload)
                if (
                    (payload.gps_accuracy is not None and payload.gps_accuracy > MAX_GPS_ACCURACY_METERS)
                    or (
                        payload.gps_speed is not None
                        and payload.gps_speed > max_speed
                    )
                ):
                    _demo_gps_speed = None
                    _demo_gps_heading = None
                    _demo_motion_received_at = None
            else:
                _demo_gps_speed, _demo_gps_heading = motion
                _demo_motion_received_at = fix_received_at

            demo_navigation_state = sync_gps_update(
                demo_navigation_state,
                latitude=float(payload.latitude),
                longitude=float(payload.longitude),
                speed=_demo_gps_speed or 0.0,
                heading=(
                    _demo_gps_heading
                    if _demo_gps_heading is not None
                    else demo_navigation_state.last_heading
                ),
                timestamp=gps_timestamp,
            )
    elif (
        _demo_last_valid_gps_received_at is not None
        and received_at - _demo_last_valid_gps_received_at >= GPS_TIMEOUT_SECONDS
    ):
        _refresh_demo_navigation(received_at)
        simulated_speed = payload.gps_speed
        simulated_heading = payload.gps_heading
        demo_speed_limit = _speed_limit_for_payload(payload)
        movement_is_valid = (
            simulated_speed is not None
            and simulated_heading is not None
            and 0.0 <= simulated_speed <= demo_speed_limit
            and 0.0 <= simulated_heading <= 360.0
        )
        elapsed = (
            None
            if demo_navigation_state.last_timestamp is None
            else float(payload.timestamp) - demo_navigation_state.last_timestamp
        )
        if not movement_is_valid:
            demo_navigation_state.navigation_mode = "DEAD_RECKONING_UNAVAILABLE"
            demo_navigation_state.gps_available = False
            demo_navigation_state.last_timestamp = float(payload.timestamp)
            demo_navigation_state.status = (
                "GPS unavailable; demo position estimate unavailable "
                "(simulated speed or heading is missing)"
            )
        elif elapsed is not None and elapsed == 0.0:
            demo_navigation_state.gps_available = False
            _demo_motion_received_at = received_at
        elif elapsed is not None and 0.0 < elapsed <= MAX_MOVEMENT_ESTIMATE_AGE_SECONDS:
            propagate_dead_reckoning(
                demo_navigation_state,
                speed=float(simulated_speed),
                heading=_gps_heading_to_radians(float(simulated_heading)),
                timestamp=float(payload.timestamp),
            )
            demo_navigation_state.time_since_last_gps = max(
                0.0,
                received_at - _demo_last_valid_gps_received_at,
            )
            demo_navigation_state.status = "GPS unavailable; demo dead reckoning active"
            _demo_motion_received_at = received_at
        else:
            demo_navigation_state.navigation_mode = "DEAD_RECKONING_UNAVAILABLE"
            demo_navigation_state.gps_available = False
            demo_navigation_state.last_timestamp = float(payload.timestamp)
            demo_navigation_state.status = (
                "GPS unavailable; demo position estimate unavailable "
                "(simulated movement interval is invalid)"
            )

    _refresh_demo_navigation(received_at)
    return {
        "status": "success",
        "message": "Demo sensor sample stored in isolated demo state",
        "sample": demo_sensor_sample,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
