import math
from collections import deque
from typing import Deque, Optional

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


navigation_state: DeadReckoningState = initialize_navigation_state()
ml_model = MLModel()
ml_enabled = False
sensor_history: Deque[dict] = deque(maxlen=600)
latest_sensor_sample: Optional[dict] = None



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
    navigation_state.is_running = True
    navigation_state.status = "Navigation started"
    return navigation_state.to_response()


@app.post("/navigation/reset")
def reset_navigation() -> NavigationStateResponse:
    global navigation_state
    navigation_state = initialize_navigation_state()
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
    return NavigationStateResponse(
        latitude=navigation_state.estimated_latitude,
        longitude=navigation_state.estimated_longitude,
        speed=navigation_state.last_speed,
        heading=navigation_state.last_heading,
        dr_speed=navigation_state.last_speed,
        gps_available=navigation_state.gps_available,
        time_since_last_gps=navigation_state.time_since_last_gps,
        distance_since_last_gps=navigation_state.distance_since_last_gps,
        navigation_mode=navigation_state.navigation_mode,
        ml_enabled=bool(ml_enabled and ml_model.ml_enabled),
        ml_prediction_available=False,
        predicted_velocity_error=None,
        ml_corrected_speed=None,
        status=navigation_state.status,
    )


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
    latest_sensor_sample = payload.model_dump()
    return {
        "status": "success",
        "message": "Sensor sample stored",
        "sample": latest_sensor_sample,
    }


@app.get("/sensor-data/latest")
def get_latest_sensor_data() -> Optional[dict]:
    return latest_sensor_sample


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

