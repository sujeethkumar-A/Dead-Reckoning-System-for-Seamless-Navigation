from typing import Literal, Optional

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
    timestamp: float = Field(
        ...,
        ge=0.0,
        allow_inf_nan=False,
        description="Sensor timestamp (seconds)",
    )
    source: Literal["real", "demo"] = Field(
        default="real",
        description="Origin of this sensor sample",
    )
    gps_timestamp: Optional[float] = Field(
        default=None,
        ge=0.0,
        allow_inf_nan=False,
        description="Timestamp of the last browser GPS fix (seconds since epoch)",
    )
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0, allow_inf_nan=False)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0, allow_inf_nan=False)
    gps_accuracy: Optional[float] = Field(default=None, ge=0.0, allow_inf_nan=False)
    gps_speed: Optional[float] = Field(default=None, ge=0.0, allow_inf_nan=False)
    gps_heading: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=360.0,
        allow_inf_nan=False,
        description="GPS course over ground in degrees clockwise from north",
    )
    gps_available: bool = False
    accel_x: Optional[float] = Field(default=None, allow_inf_nan=False)
    accel_y: Optional[float] = Field(default=None, allow_inf_nan=False)
    accel_z: Optional[float] = Field(default=None, allow_inf_nan=False)
    gyro_alpha: Optional[float] = Field(default=None, allow_inf_nan=False)
    gyro_beta: Optional[float] = Field(default=None, allow_inf_nan=False)
    gyro_gamma: Optional[float] = Field(default=None, allow_inf_nan=False)
