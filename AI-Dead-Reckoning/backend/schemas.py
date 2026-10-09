from typing import Optional

from pydantic import BaseModel, Field


class NavigationUpdateRequest(BaseModel):
    latitude: float = Field(default=11.0, ge=-90.0, le=90.0)
    longitude: float = Field(default=77.0, ge=-180.0, le=180.0)
    gps_available: bool = True
    speed: float = Field(default=0.0, ge=0.0)
    heading: float = Field(default=0.0)
    accel_x: float = 0.0
    accel_y: float = 0.0
    gyro_z: float = 0.0
    timestamp: float = Field(default=0.0, ge=0.0)


class MLToggleRequest(BaseModel):
    enabled: bool = False


class NavigationStateResponse(BaseModel):
    latitude: float
    longitude: float
    speed: float
    heading: float
    dr_speed: float = 0.0
    gps_available: bool
    time_since_last_gps: float
    distance_since_last_gps: float
    navigation_mode: str
    ml_enabled: bool = False
    ml_prediction_available: bool = False
    predicted_velocity_error: Optional[float] = None
    ml_corrected_speed: Optional[float] = None
    status: str


class SensorDataPayload(BaseModel):
    timestamp: float = Field(..., description="Sensor timestamp (seconds)")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    gps_accuracy: Optional[float] = None
    gps_speed: Optional[float] = None
    gps_heading: Optional[float] = None
    gps_available: bool = False
    accel_x: Optional[float] = None
    accel_y: Optional[float] = None
    accel_z: Optional[float] = None
    gyro_alpha: Optional[float] = None
    gyro_beta: Optional[float] = None
    gyro_gamma: Optional[float] = None

