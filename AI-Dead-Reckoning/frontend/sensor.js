// =============================================================================
// BACKEND CONFIGURATION
// Replace LAPTOP_IP with the Windows laptop's LAN IPv4 address
// (e.g., "http://192.168.1.15:8000" or "http://10.0.0.5:8000")
// Find your laptop IPv4 address by running 'ipconfig' in PowerShell/Command Prompt.
// =============================================================================
const BACKEND_URL = "http://LAPTOP_IP:8000";

// Telemetry state - Stores REAL sensor measurements only.
// NO random or fake sensor values are ever generated.
const sensorState = {
  active: false,
  watchId: null,
  sendTimerId: null,
  samplesSent: 0,
  lastUpdateTime: null,

  // GPS
  latitude: null,
  longitude: null,
  gps_accuracy: null,
  gps_speed: null,
  gps_heading: null,
  gps_available: false,

  // IMU
  accel_x: null,
  accel_y: null,
  accel_z: null,
  gyro_alpha: null,
  gyro_beta: null,
  gyro_gamma: null,
};

// Configurable backend URL runtime override
let activeBackendUrl = BACKEND_URL;

// DOM Elements
const elements = {
  secureBadge: document.getElementById("secure-context-badge"),
  secureNotice: document.getElementById("secure-context-notice"),
  backendUrlInput: document.getElementById("backend-url-input"),
  applyBackendUrlBtn: document.getElementById("apply-backend-url-btn"),
  backendStatusPill: document.getElementById("backend-status-pill"),
  backendStatusLabel: document.getElementById("backend-status-label"),
  headerStatusPill: document.getElementById("header-status-pill"),
  headerStatusText: document.getElementById("header-status-text"),
  connectBtn: document.getElementById("connect-btn"),
  connectBtnText: document.getElementById("connect-btn-text"),
  disconnectBtn: document.getElementById("disconnect-btn"),
  alertBanner: document.getElementById("sensor-alert-banner"),

  // GPS Values
  gpsStatusPill: document.getElementById("gps-status-pill"),
  gpsStatusText: document.getElementById("gps-status-text"),
  valLatitude: document.getElementById("val-latitude"),
  valLongitude: document.getElementById("val-longitude"),
  valGpsAccuracy: document.getElementById("val-gps-accuracy"),
  valGpsSpeed: document.getElementById("val-gps-speed"),
  valGpsHeading: document.getElementById("val-gps-heading"),
  valGpsAvailable: document.getElementById("val-gps-available"),

  // Accelerometer Values
  accelStatusPill: document.getElementById("accel-status-pill"),
  accelStatusText: document.getElementById("accel-status-text"),
  valAccelX: document.getElementById("val-accel-x"),
  valAccelY: document.getElementById("val-accel-y"),
  valAccelZ: document.getElementById("val-accel-z"),

  // Gyroscope Values
  gyroStatusPill: document.getElementById("gyro-status-pill"),
  gyroStatusText: document.getElementById("gyro-status-text"),
  valGyroAlpha: document.getElementById("val-gyro-alpha"),
  valGyroBeta: document.getElementById("val-gyro-beta"),
  valGyroGamma: document.getElementById("val-gyro-gamma"),
  valGyroAlphaUnit: document.getElementById("val-gyro-alpha-unit"),
  valGyroBetaUnit: document.getElementById("val-gyro-beta-unit"),
  valGyroGammaUnit: document.getElementById("val-gyro-gamma-unit"),

  // Stream Stats
  streamStatusPill: document.getElementById("stream-status-pill"),
  streamStatusText: document.getElementById("stream-status-text"),
  valSamplesSent: document.getElementById("val-samples-sent"),
  valLastUpdate: document.getElementById("val-last-update"),
  valBackendHttp: document.getElementById("val-backend-http"),
  rawPayloadJson: document.getElementById("raw-payload-json"),
};

// -----------------------------------------------------------------------------
// SECURE CONTEXT VERIFICATION
// -----------------------------------------------------------------------------
function evaluateSecureContext() {
  const isSecure = Boolean(window.isSecureContext);

  if (isSecure) {
    elements.secureBadge.textContent = "Secure context: YES";
    elements.secureBadge.className = "badge badge-yes";
    elements.secureNotice.hidden = true;
  } else {
    elements.secureBadge.textContent = "Secure context: NO";
    elements.secureBadge.className = "badge badge-no";
    elements.secureNotice.hidden = false;
  }
  return isSecure;
}

// -----------------------------------------------------------------------------
// ALERT NOTIFICATIONS
// -----------------------------------------------------------------------------
function showAlert(message, isError = true) {
  if (!elements.alertBanner) return;
  elements.alertBanner.textContent = message;
  elements.alertBanner.className = isError ? "alert-banner" : "alert-banner alert-info";
  elements.alertBanner.hidden = false;
}

function clearAlert() {
  if (!elements.alertBanner) return;
  elements.alertBanner.textContent = "";
  elements.alertBanner.hidden = true;
}

// -----------------------------------------------------------------------------
// SENSOR EVENT HANDLERS (REAL HARDWARE SENSORS ONLY)
// -----------------------------------------------------------------------------

function handleDeviceMotion(event) {
  // Real Accelerometer (prefer accelerationIncludingGravity or acceleration)
  const accel = event.accelerationIncludingGravity || event.acceleration;
  if (accel && (accel.x !== null || accel.y !== null || accel.z !== null)) {
    sensorState.accel_x = accel.x !== null ? Number(accel.x) : null;
    sensorState.accel_y = accel.y !== null ? Number(accel.y) : null;
    sensorState.accel_z = accel.z !== null ? Number(accel.z) : null;

    elements.accelStatusPill.className = "status-indicator is-active";
    elements.accelStatusText.textContent = "ACTIVE";
    elements.valAccelX.textContent = sensorState.accel_x !== null ? sensorState.accel_x.toFixed(3) : "--";
    elements.valAccelY.textContent = sensorState.accel_y !== null ? sensorState.accel_y.toFixed(3) : "--";
    elements.valAccelZ.textContent = sensorState.accel_z !== null ? sensorState.accel_z.toFixed(3) : "--";
  }

  // Real Gyroscope rotation rate (deg/s)
  if (event.rotationRate) {
    const rr = event.rotationRate;
    if (rr.alpha !== null || rr.beta !== null || rr.gamma !== null) {
      sensorState.gyro_alpha = rr.alpha !== null ? Number(rr.alpha) : sensorState.gyro_alpha;
      sensorState.gyro_beta = rr.beta !== null ? Number(rr.beta) : sensorState.gyro_beta;
      sensorState.gyro_gamma = rr.gamma !== null ? Number(rr.gamma) : sensorState.gyro_gamma;

      elements.gyroStatusPill.className = "status-indicator is-active";
      elements.gyroStatusText.textContent = "RATE (deg/s)";
      elements.valGyroAlphaUnit.textContent = "deg/s";
      elements.valGyroBetaUnit.textContent = "deg/s";
      elements.valGyroGammaUnit.textContent = "deg/s";

      elements.valGyroAlpha.textContent = sensorState.gyro_alpha !== null ? sensorState.gyro_alpha.toFixed(2) : "--";
      elements.valGyroBeta.textContent = sensorState.gyro_beta !== null ? sensorState.gyro_beta.toFixed(2) : "--";
      elements.valGyroGamma.textContent = sensorState.gyro_gamma !== null ? sensorState.gyro_gamma.toFixed(2) : "--";
    }
  }
}

function handleDeviceOrientation(event) {
  // If rotationRate is not supported by device, fallback to real orientation Euler angles
  if (sensorState.gyro_alpha === null && sensorState.gyro_beta === null && sensorState.gyro_gamma === null) {
    if (event.alpha !== null || event.beta !== null || event.gamma !== null) {
      sensorState.gyro_alpha = event.alpha !== null ? Number(event.alpha) : null;
      sensorState.gyro_beta = event.beta !== null ? Number(event.beta) : null;
      sensorState.gyro_gamma = event.gamma !== null ? Number(event.gamma) : null;

      elements.gyroStatusPill.className = "status-indicator is-active";
      elements.gyroStatusText.textContent = "ORIENT (deg)";
      elements.valGyroAlphaUnit.textContent = "deg";
      elements.valGyroBetaUnit.textContent = "deg";
      elements.valGyroGammaUnit.textContent = "deg";

      elements.valGyroAlpha.textContent = sensorState.gyro_alpha !== null ? sensorState.gyro_alpha.toFixed(1) : "--";
      elements.valGyroBeta.textContent = sensorState.gyro_beta !== null ? sensorState.gyro_beta.toFixed(1) : "--";
      elements.valGyroGamma.textContent = sensorState.gyro_gamma !== null ? sensorState.gyro_gamma.toFixed(1) : "--";
    }
  }
}

function handleGpsSuccess(position) {
  const coords = position.coords;

  sensorState.latitude = coords.latitude !== null && !isNaN(coords.latitude) ? Number(coords.latitude) : null;
  sensorState.longitude = coords.longitude !== null && !isNaN(coords.longitude) ? Number(coords.longitude) : null;
  sensorState.gps_accuracy = coords.accuracy !== null && !isNaN(coords.accuracy) ? Number(coords.accuracy) : null;
  sensorState.gps_speed = coords.speed !== null && !isNaN(coords.speed) ? Number(coords.speed) : null;
  sensorState.gps_heading = coords.heading !== null && !isNaN(coords.heading) ? Number(coords.heading) : null;
  sensorState.gps_available = sensorState.latitude !== null && sensorState.longitude !== null;

  elements.gpsStatusPill.className = "status-indicator is-active";
  elements.gpsStatusText.textContent = "FIX ACQUIRED";

  elements.valLatitude.textContent = sensorState.latitude !== null ? sensorState.latitude.toFixed(6) : "--";
  elements.valLongitude.textContent = sensorState.longitude !== null ? sensorState.longitude.toFixed(6) : "--";
  elements.valGpsAccuracy.textContent = sensorState.gps_accuracy !== null ? `±${sensorState.gps_accuracy.toFixed(1)} m` : "--";
  elements.valGpsSpeed.textContent = sensorState.gps_speed !== null ? `${sensorState.gps_speed.toFixed(2)} m/s` : "0.00 m/s";
  elements.valGpsHeading.textContent = sensorState.gps_heading !== null ? `${sensorState.gps_heading.toFixed(1)}°` : "--";
  elements.valGpsAvailable.textContent = sensorState.gps_available ? "TRUE" : "FALSE";
  elements.valGpsAvailable.style.color = sensorState.gps_available ? "var(--lime)" : "var(--faint)";
}

function handleGpsError(error) {
  sensorState.gps_available = false;
  elements.valGpsAvailable.textContent = "FALSE";
  elements.valGpsAvailable.style.color = "var(--red)";

  let errorMsg = "GPS Error";
  switch (error.code) {
    case error.PERMISSION_DENIED:
      errorMsg = "GPS PERMISSION DENIED";
      showAlert("Location permission was denied. Please allow location access in your browser settings.");
      break;
    case error.POSITION_UNAVAILABLE:
      errorMsg = "POSITION UNAVAILABLE";
      break;
    case error.TIMEOUT:
      errorMsg = "GPS TIMEOUT (SEARCHING)";
      break;
    default:
      errorMsg = error.message || "GPS ERROR";
  }

  elements.gpsStatusPill.className = "status-indicator is-warning";
  elements.gpsStatusText.textContent = errorMsg;
}

// -----------------------------------------------------------------------------
// TELEMETRY TRANSMISSION (POST to /sensor-data)
// -----------------------------------------------------------------------------

async function sendSensorSample() {
  if (!sensorState.active) return;

  const timestampSeconds = Date.now() / 1000.0;

  // Build exact required JSON payload
  const payload = {
    timestamp: timestampSeconds,
    latitude: sensorState.latitude,
    longitude: sensorState.longitude,
    gps_accuracy: sensorState.gps_accuracy,
    gps_speed: sensorState.gps_speed,
    gps_heading: sensorState.gps_heading,
    gps_available: Boolean(sensorState.gps_available),
    accel_x: sensorState.accel_x,
    accel_y: sensorState.accel_y,
    accel_z: sensorState.accel_z,
    gyro_alpha: sensorState.gyro_alpha,
    gyro_beta: sensorState.gyro_beta,
    gyro_gamma: sensorState.gyro_gamma,
  };

  // Update Raw Inspector
  if (elements.rawPayloadJson) {
    elements.rawPayloadJson.textContent = JSON.stringify(payload, null, 2);
  }

  try {
    const targetUrl = `${activeBackendUrl.replace(/\/+$/, "")}/sensor-data`;
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    sensorState.samplesSent += 1;
    sensorState.lastUpdateTime = new Date();

    elements.valSamplesSent.textContent = sensorState.samplesSent.toString();
    elements.valLastUpdate.textContent = sensorState.lastUpdateTime.toTimeString().split(" ")[0] + "." +
      sensorState.lastUpdateTime.getMilliseconds().toString().padStart(3, "0");
    elements.valBackendHttp.textContent = `200 OK (${response.status})`;
    elements.valBackendHttp.style.color = "var(--lime)";

    elements.streamStatusPill.className = "status-indicator is-active";
    elements.streamStatusText.textContent = "TRANSMITTING";

    elements.headerStatusPill.className = "status-pill is-transmitting";
    elements.headerStatusText.textContent = "STREAMING";

    elements.backendStatusPill.className = "status-indicator is-active";
    elements.backendStatusLabel.textContent = "ONLINE";
  } catch (err) {
    elements.valBackendHttp.textContent = `ERR: ${err.message}`;
    elements.valBackendHttp.style.color = "var(--red)";

    elements.streamStatusPill.className = "status-indicator is-error";
    elements.streamStatusText.textContent = "POST FAILED";

    elements.headerStatusPill.className = "status-pill is-error";
    elements.headerStatusText.textContent = "BACKEND UNREACHABLE";

    elements.backendStatusPill.className = "status-indicator is-error";
    elements.backendStatusLabel.textContent = "UNREACHABLE";
  }
}

// -----------------------------------------------------------------------------
// CONNECTION CONTROL LIFECYCLE
// -----------------------------------------------------------------------------

async function connectSensors() {
  clearAlert();

  // Verify secure context warning
  const isSecure = evaluateSecureContext();
  if (!isSecure) {
    showAlert("Notice: Modern Android Chrome requires HTTPS or localhost for motion/GPS access. Check the banner instructions above.", false);
  }

  // Request permissions if required (e.g. iOS or newer Chromium permission API)
  try {
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
      const motionPerm = await DeviceMotionEvent.requestPermission();
      if (motionPerm !== "granted") {
        throw new Error("DeviceMotion permission was denied by user.");
      }
    }
  } catch (permErr) {
    showAlert(`Motion sensor permission note: ${permErr.message}`);
  }

  // Register real motion & orientation listeners
  try {
    window.addEventListener("devicemotion", handleDeviceMotion, true);
    window.addEventListener("deviceorientation", handleDeviceOrientation, true);
    elements.accelStatusPill.className = "status-indicator is-warning";
    elements.accelStatusText.textContent = "LISTENING";
    elements.gyroStatusPill.className = "status-indicator is-warning";
    elements.gyroStatusText.textContent = "LISTENING";
  } catch (motionErr) {
    showAlert(`Could not attach DeviceMotion listener: ${motionErr.message}`);
  }

  // Register real GPS watchPosition
  if ("geolocation" in navigator) {
    elements.gpsStatusPill.className = "status-indicator is-warning";
    elements.gpsStatusText.textContent = "ACQUIRING FIX";

    try {
      sensorState.watchId = navigator.geolocation.watchPosition(
        handleGpsSuccess,
        handleGpsError,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    } catch (geoErr) {
      handleGpsError({ code: 0, message: geoErr.message });
    }
  } else {
    elements.gpsStatusPill.className = "status-indicator is-error";
    elements.gpsStatusText.textContent = "API NOT SUPPORTED";
    showAlert("navigator.geolocation is not available on this browser.");
  }

  sensorState.active = true;
  elements.connectBtn.disabled = true;
  elements.disconnectBtn.disabled = false;
  elements.connectBtnText.textContent = "SENSORS CONNECTED";

  // Start periodic telemetry transmission (every 250ms = 4 Hz)
  if (sensorState.sendTimerId) {
    clearInterval(sensorState.sendTimerId);
  }
  sensorState.sendTimerId = setInterval(sendSensorSample, 250);

  // Send first sample immediately
  sendSensorSample();
}

function disconnectSensors() {
  sensorState.active = false;

  // Stop GPS watcher
  if (sensorState.watchId !== null) {
    navigator.geolocation.clearWatch(sensorState.watchId);
    sensorState.watchId = null;
  }

  // Stop transmission loop
  if (sensorState.sendTimerId !== null) {
    clearInterval(sensorState.sendTimerId);
    sensorState.sendTimerId = null;
  }

  // Remove motion listeners
  try {
    window.removeEventListener("devicemotion", handleDeviceMotion, true);
    window.removeEventListener("deviceorientation", handleDeviceOrientation, true);
  } catch (_) {}

  // Update UI indicators
  elements.connectBtn.disabled = false;
  elements.disconnectBtn.disabled = true;
  elements.connectBtnText.textContent = "CONNECT SENSORS";

  elements.headerStatusPill.className = "status-pill is-disconnected";
  elements.headerStatusText.textContent = "STOPPED";

  elements.streamStatusPill.className = "status-indicator";
  elements.streamStatusText.textContent = "STOPPED";

  elements.gpsStatusPill.className = "status-indicator";
  elements.gpsStatusText.textContent = "INACTIVE";

  elements.accelStatusPill.className = "status-indicator";
  elements.accelStatusText.textContent = "INACTIVE";

  elements.gyroStatusPill.className = "status-indicator";
  elements.gyroStatusText.textContent = "INACTIVE";
}

// -----------------------------------------------------------------------------
// BACKEND CONFIGURATION HANDLER
// -----------------------------------------------------------------------------

function applyBackendUrl() {
  const enteredUrl = elements.backendUrlInput.value.trim();
  if (enteredUrl) {
    activeBackendUrl = enteredUrl;
    showAlert(`Target backend updated to: ${activeBackendUrl}`, false);
    testBackendReachability();
  }
}

async function testBackendReachability() {
  elements.backendStatusPill.className = "status-indicator is-warning";
  elements.backendStatusLabel.textContent = "TESTING...";

  try {
    const url = `${activeBackendUrl.replace(/\/+$/, "")}/health`;
    const res = await fetch(url, { method: "GET" });
    if (res.ok) {
      elements.backendStatusPill.className = "status-indicator is-active";
      elements.backendStatusLabel.textContent = "ONLINE (200)";
    } else {
      elements.backendStatusPill.className = "status-indicator is-warning";
      elements.backendStatusLabel.textContent = `HTTP ${res.status}`;
    }
  } catch (err) {
    elements.backendStatusPill.className = "status-indicator is-error";
    elements.backendStatusLabel.textContent = "UNREACHABLE";
  }
}

// -----------------------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------------------

function init() {
  evaluateSecureContext();

  // Populate backend input
  if (elements.backendUrlInput) {
    // If opened from a browser where LAPTOP_IP wasn't edited, but opened via LAN IP,
    // auto-suggest the current window host with port 8000 if not localhost
    let initialUrl = BACKEND_URL;
    if (BACKEND_URL.includes("LAPTOP_IP") && window.location.hostname && window.location.hostname !== "localhost") {
      initialUrl = `http://${window.location.hostname}:8000`;
    }
    elements.backendUrlInput.value = initialUrl;
    activeBackendUrl = initialUrl;
  }

  // Bind Buttons
  if (elements.connectBtn) {
    elements.connectBtn.addEventListener("click", connectSensors);
  }
  if (elements.disconnectBtn) {
    elements.disconnectBtn.addEventListener("click", disconnectSensors);
  }
  if (elements.applyBackendUrlBtn) {
    elements.applyBackendUrlBtn.addEventListener("click", applyBackendUrl);
  }

  // Perform initial ping
  if (!activeBackendUrl.includes("LAPTOP_IP")) {
    testBackendReachability();
  }
}

window.addEventListener("DOMContentLoaded", init);
