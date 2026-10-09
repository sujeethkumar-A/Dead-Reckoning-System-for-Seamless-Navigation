from __future__ import annotations

from pathlib import Path
from typing import Optional, Sequence

import joblib
import numpy as np

MODEL_FEATURES = [
    "accel_x",
    "accel_y",
    "gyro_z",
    "speed",
    "heading_sin",
    "heading_cos",
    "dr_speed",
    "time_since_last_gps",
    "path_since_fix",
    "heading_change_since_fix",
    "dr_dx_from_fix",
    "dr_dy_from_fix",
    "dr_dist_from_fix",
    "gyro_z_mean_1s",
    "gyro_z_std_5s",
    "accel_x_mean_1s",
    "accel_y_mean_1s",
    "accel_x_std_5s",
    "speed_delta_1s",
    "gyro_bias_est",
    "accel_bias_est",
    "speed_bias_est",
]

MODEL_PATH = Path(__file__).resolve().parent / "models" / "velocity_error_model.pkl"


class MLModel:
    def __init__(self, model_path: Path | str = MODEL_PATH):
        self.model_path = Path(model_path)
        self.model = None
        self.load_error: Optional[str] = None
        self.ml_enabled = False
        self.ml_status = "missing_model"
        self.load()

    def load(self) -> None:
        if not self.model_path.exists():
            self.model = None
            self.ml_enabled = False
            self.ml_status = "missing_model"
            self.load_error = "Model file not found."
            return

        try:
            self.model = joblib.load(self.model_path)
            self.ml_enabled = True
            self.ml_status = "loaded"
            self.load_error = None
        except Exception as exc:  # pragma: no cover - defensive only
            self.model = None
            self.ml_enabled = False
            self.ml_status = "load_error"
            self.load_error = str(exc)

    def predict(self, features: Sequence[float]) -> Optional[float]:
        if not self.ml_enabled or self.model is None:
            return None

        try:
            feature_array = np.asarray(features, dtype=float)
            if feature_array.shape[0] != len(MODEL_FEATURES):
                raise ValueError(
                    f"Expected {len(MODEL_FEATURES)} features, got {feature_array.shape[0]}."
                )

            prediction = self.model.predict(feature_array.reshape(1, -1))
            value = float(np.asarray(prediction).reshape(-1)[0])
            return value
        except Exception as exc:  # pragma: no cover - defensive only
            self.ml_status = "prediction_error"
            self.load_error = str(exc)
            return None
