const API_BASE = 'http://127.0.0.1:8000';
const UPDATE_INTERVAL_MS = 750;
const EARTH_RADIUS_METERS = 6371000;

const state = {
  running: false,
  gpsAvailable: true,
  mlEnabled: false,
  timerId: null,
  busy: false,
  timestamp: null,
  simulatedLatitude: null,
  simulatedLongitude: null,
  speed: 7.2,
  heading: Math.PI / 3,
  frame: 0,
  positions: [],
  map: null,
  positionMarker: null,
  gpsMarker: null,
  gpsLine: null,
  drLine: null,
  fallbackInitialized: false,
};

const els = {
  backendStatus: document.getElementById('backend-status'),
  navigationStatus: document.getElementById('navigation-status'),
  liveStatus: document.getElementById('live-status'),
  errorBanner: document.getElementById('error-banner'),
  navMode: document.getElementById('nav-mode'),
  modeValue: document.getElementById('mode-value'),
  gpsStatus: document.getElementById('gps-status'),
  gpsStatusSide: document.getElementById('gps-status-side'),
  latValue: document.getElementById('lat-value'),
  lonValue: document.getElementById('lon-value'),
  mapLat: document.getElementById('map-lat'),
  mapLon: document.getElementById('map-lon'),
  speedValue: document.getElementById('speed-value'),
  headingValue: document.getElementById('heading-value'),
  timeGpsValue: document.getElementById('time-gps-value'),
  distanceGpsValue: document.getElementById('distance-gps-value'),
  mlStatus: document.getElementById('ml-status'),
  mlErrorValue: document.getElementById('ml-error-value'),
  mlSpeedValue: document.getElementById('ml-speed-value'),
  mlButton: document.getElementById('ml-btn'),
  mlButtonLabel: document.getElementById('ml-button-label'),
  startButton: document.getElementById('start-btn'),
  stopButton: document.getElementById('stop-btn'),
  resetButton: document.getElementById('reset-btn'),
  gpsLossButton: document.getElementById('gps-loss-btn'),
  gpsRestoreButton: document.getElementById('gps-restore-btn'),
  mapCaption: document.getElementById('map-caption'),
  pathCount: document.getElementById('path-count'),
  mapElement: document.getElementById('map'),
  fallbackMap: document.getElementById('fallback-map'),
  fallbackGpsPath: document.getElementById('fallback-path-gps'),
  fallbackDrPath: document.getElementById('fallback-path-dr'),
  fallbackGpsPoint: document.getElementById('fallback-gps-point'),
  fallbackPosition: document.getElementById('fallback-position'),
  fallbackLabel: document.getElementById('fallback-label'),
};

function setBackendStatus(status, detail) {
  els.backendStatus.className = `status-pill ${status}`;
  els.backendStatus.querySelector('span').textContent = status === 'is-connected'
    ? 'BACKEND CONNECTED'
    : status === 'is-disconnected' ? 'BACKEND DISCONNECTED' : 'CHECKING BACKEND';
  if (detail) els.liveStatus.textContent = detail;
}

function showError(message) {
  els.errorBanner.textContent = message;
  els.errorBanner.hidden = false;
  els.liveStatus.textContent = 'Backend request failed';
}

function clearError() {
  els.errorBanner.hidden = true;
  els.errorBanner.textContent = '';
}

function numberValue(value, field) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Backend response has an invalid ${field}.`);
  return parsed;
}

async function requestJson(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    setBackendStatus('is-disconnected');
    throw new Error(error.name === 'TimeoutError' ? 'Backend request timed out.' : 'Cannot reach FastAPI at http://127.0.0.1:8000. Start the backend and check the connection.');
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Backend returned an invalid response (${response.status}).`);
  }
  if (!response.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : `Request failed with HTTP ${response.status}.`;
    throw new Error(detail);
  }
  setBackendStatus('is-connected');
  clearError();
  return data;
}

function postJson(path, payload) {
  return requestJson(path, { method: 'POST', body: JSON.stringify(payload) });
}

function setMlEnabled(enabled) {
  state.mlEnabled = Boolean(enabled);
  els.mlButton.setAttribute('aria-pressed', String(state.mlEnabled));
  els.mlButtonLabel.textContent = state.mlEnabled ? 'ML ON' : 'ML OFF';
  els.mlStatus.textContent = state.mlEnabled ? 'ML ENABLED' : 'ML DISABLED';
  els.mlStatus.className = `value-state ${state.mlEnabled ? 'is-good' : ''}`;
}

function initializeMap() {
  if (window.L) {
    state.map = L.map(els.mapElement, { zoomControl: true }).setView([11, 77], 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(state.map);
    state.gpsLine = L.polyline([], { color: '#68c9b2', weight: 3, opacity: 0.95 }).addTo(state.map);
    state.drLine = L.polyline([], { color: '#e3a843', weight: 3, opacity: 0.95, dashArray: '7 7' }).addTo(state.map);
    state.positionMarker = L.marker([11, 77], {
      icon: L.divIcon({ className: 'position-marker is-gps', iconSize: [17, 17], iconAnchor: [8, 8] }),
    }).addTo(state.map);
    state.gpsMarker = L.circleMarker([11, 77], { radius: 6, color: '#101816', weight: 2, fillColor: '#68c9b2', fillOpacity: 1 }).addTo(state.map);
  } else {
    els.mapElement.hidden = true;
    els.fallbackMap.hidden = false;
    state.fallbackInitialized = true;
  }
}

function format(value, digits = 4) {
  return numberValue(value, 'numeric field').toFixed(digits);
}

function renderTelemetry(data, addPosition = false) {
  if (!data || typeof data !== 'object' || typeof data.gps_available !== 'boolean') {
    throw new Error('Backend navigation response is invalid.');
  }
  const latitude = numberValue(data.latitude, 'latitude');
  const longitude = numberValue(data.longitude, 'longitude');
  const speed = numberValue(data.speed, 'speed');
  const headingRadians = numberValue(data.heading, 'heading');
  const gpsAvailable = Boolean(data.gps_available);
  const mode = String(data.navigation_mode || (gpsAvailable ? 'GPS' : 'DEAD_RECKONING'));

  els.latValue.textContent = format(latitude, 6);
  els.lonValue.textContent = format(longitude, 6);
  els.mapLat.textContent = format(latitude, 6);
  els.mapLon.textContent = format(longitude, 6);
  els.speedValue.innerHTML = `${format(speed, 2)} <small>m/s</small>`;
  els.headingValue.innerHTML = `${format((headingRadians * 180 / Math.PI + 360) % 360, 1)} <small>°</small>`;
  els.gpsStatus.textContent = gpsAvailable ? 'GPS AVAILABLE' : 'GPS LOST';
  els.gpsStatus.classList.toggle('is-lost', !gpsAvailable);
  els.gpsStatusSide.textContent = gpsAvailable ? 'GPS AVAILABLE' : 'GPS LOST';
  els.gpsStatusSide.className = `value-state ${gpsAvailable ? 'is-good' : 'is-warning'}`;
  els.navMode.textContent = mode;
  els.navMode.classList.toggle('is-dr', mode === 'DEAD_RECKONING');
  els.modeValue.textContent = mode.replaceAll('_', ' ');
  els.modeValue.className = `value-state ${gpsAvailable ? 'is-good' : 'is-warning'}`;
  els.timeGpsValue.textContent = `${format(data.time_since_last_gps, 1)} s`;
  els.distanceGpsValue.textContent = `${format(data.distance_since_last_gps, 1)} m`;

  const predictionAvailable = Boolean(data.ml_prediction_available)
    && data.predicted_velocity_error !== null
    && data.ml_corrected_speed !== null;
  if (predictionAvailable) {
    els.mlErrorValue.textContent = `${format(data.predicted_velocity_error, 5)} m/s`;
    els.mlSpeedValue.textContent = `${format(data.ml_corrected_speed, 3)} m/s`;
  } else {
    els.mlErrorValue.textContent = 'Unavailable';
    els.mlSpeedValue.textContent = 'Unavailable';
  }
  if (typeof data.ml_enabled === 'boolean') setMlEnabled(data.ml_enabled);
  els.liveStatus.textContent = data.status || 'Backend state received';
  els.navigationStatus.querySelector('span').textContent = state.running ? 'RUNNING' : 'STOPPED';
  els.navigationStatus.classList.toggle('is-running', state.running);

  if (addPosition) addTrackPosition(latitude, longitude, gpsAvailable);
}

function addTrackPosition(latitude, longitude, gpsAvailable) {
  const position = { latitude, longitude, gpsAvailable };
  state.positions.push(position);
  if (state.positions.length > 1500) state.positions.shift();
  els.pathCount.textContent = `${state.positions.length} received position${state.positions.length === 1 ? '' : 's'}`;
  els.mapCaption.textContent = gpsAvailable ? 'Position confirmed by GPS' : 'Dashed track is estimated by dead reckoning';

  if (state.map) {
    const point = [latitude, longitude];
    const path = gpsAvailable ? state.gpsLine : state.drLine;
    path.addLatLng(point);
    state.positionMarker.setLatLng(point);
    state.positionMarker.setIcon(L.divIcon({
      className: `position-marker ${gpsAvailable ? 'is-gps' : ''}`,
      iconSize: [17, 17],
      iconAnchor: [8, 8],
    }));
    if (gpsAvailable) state.gpsMarker.setLatLng(point);
    state.map.panTo(point, { animate: false });
  } else if (state.fallbackInitialized) {
    renderFallbackTrack();
  }
}

function renderFallbackTrack() {
  if (!state.positions.length) return;
  const latitudes = state.positions.map((point) => point.latitude);
  const longitudes = state.positions.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const spanLat = Math.max(maxLat - minLat, 0.00008);
  const spanLon = Math.max(maxLon - minLon, 0.00008);
  const project = (point) => ({
    x: 48 + ((point.longitude - minLon) / spanLon) * 704,
    y: 412 - ((point.latitude - minLat) / spanLat) * 364,
  });
  const gps = state.positions.filter((point) => point.gpsAvailable).map(project);
  const dr = state.positions.filter((point) => !point.gpsAvailable).map(project);
  const pathData = (points) => points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  els.fallbackGpsPath.setAttribute('d', pathData(gps));
  els.fallbackDrPath.setAttribute('d', pathData(dr));
  const latest = project(state.positions[state.positions.length - 1]);
  els.fallbackPosition.setAttribute('cx', latest.x);
  els.fallbackPosition.setAttribute('cy', latest.y);
  const lastGps = gps[gps.length - 1] || latest;
  els.fallbackGpsPoint.setAttribute('cx', lastGps.x);
  els.fallbackGpsPoint.setAttribute('cy', lastGps.y);
  els.fallbackLabel.setAttribute('x', Math.min(latest.x + 13, 735));
  els.fallbackLabel.setAttribute('y', latest.y - 9);
}

function advanceSimulatedVehicle(dt) {
  state.frame += 1;
  state.heading += Math.sin(state.frame / 8) * 0.006;
  state.speed = 7.2 + Math.sin(state.frame / 5) * 0.65;
  const distance = state.speed * dt;
  const latitudeRadians = state.simulatedLatitude * Math.PI / 180;
  const north = distance * Math.sin(state.heading);
  const east = distance * Math.cos(state.heading);
  state.simulatedLatitude += north / EARTH_RADIUS_METERS * 180 / Math.PI;
  state.simulatedLongitude += east / (EARTH_RADIUS_METERS * Math.max(Math.cos(latitudeRadians), 0.01)) * 180 / Math.PI;
}

function makeSensorPayload(timestamp) {
  const turnRate = Math.sin(state.frame / 8) * 0.008;
  return {
    latitude: state.simulatedLatitude,
    longitude: state.simulatedLongitude,
    gps_available: state.gpsAvailable,
    speed: state.speed,
    heading: state.heading,
    accel_x: 0.04 + Math.sin(state.frame / 4) * 0.025,
    accel_y: 0.02 + Math.cos(state.frame / 6) * 0.018,
    gyro_z: turnRate,
    timestamp,
  };
}

async function sendSimulationFrame() {
  if (!state.running || state.busy) return;
  state.busy = true;
  try {
    const now = Date.now() / 1000;
    const dt = state.timestamp === null ? UPDATE_INTERVAL_MS / 1000 : Math.max(now - state.timestamp, 0.01);
    state.timestamp = now;
    advanceSimulatedVehicle(dt);
    const response = await postJson('/navigation/update', makeSensorPayload(now));
    if (state.running) renderTelemetry(response, true);
  } catch (error) {
    stopNavigation();
    setBackendStatus('is-disconnected');
    showError(`Simulation update failed: ${error.message}`);
    stopTimer();
  } finally {
    state.busy = false;
  }
}

function stopTimer() {
  if (state.timerId !== null) window.clearInterval(state.timerId);
  state.timerId = null;
}

async function startNavigation() {
  if (state.running) return;
  els.startButton.disabled = true;
  clearError();
  try {
    const response = await postJson('/navigation/start', {});
    const selectedMlState = state.mlEnabled;
    state.running = true;
    state.gpsAvailable = true;
    state.timestamp = Date.now() / 1000;
    state.simulatedLatitude = numberValue(response.latitude, 'latitude');
    state.simulatedLongitude = numberValue(response.longitude, 'longitude');
    state.speed = 7.2;
    state.heading = Math.PI / 3;
    state.frame = 0;
    renderTelemetry(response);
    setMlEnabled(selectedMlState);
    els.navigationStatus.querySelector('span').textContent = 'RUNNING';
    els.navigationStatus.classList.add('is-running');
    els.startButton.disabled = true;
    els.stopButton.disabled = false;
    els.gpsLossButton.disabled = false;
    els.gpsRestoreButton.disabled = true;
    state.timerId = window.setInterval(sendSimulationFrame, UPDATE_INTERVAL_MS);
    await sendSimulationFrame();
  } catch (error) {
    state.running = false;
    showError(`Unable to start navigation: ${error.message}`);
  } finally {
    els.startButton.disabled = state.running;
  }
}

function stopNavigation() {
  state.running = false;
  stopTimer();
  els.startButton.disabled = false;
  els.stopButton.disabled = true;
  els.gpsLossButton.disabled = true;
  els.gpsRestoreButton.disabled = true;
  els.navigationStatus.querySelector('span').textContent = 'STOPPED';
  els.navigationStatus.classList.remove('is-running');
  els.liveStatus.textContent = 'Simulation stopped; latest backend state retained';
}

async function resetNavigation() {
  stopNavigation();
  clearError();
  els.resetButton.disabled = true;
  try {
    const response = await postJson('/navigation/reset', {});
    const selectedMlState = state.mlEnabled;
    state.gpsAvailable = true;
    state.timestamp = null;
    state.simulatedLatitude = numberValue(response.latitude, 'latitude');
    state.simulatedLongitude = numberValue(response.longitude, 'longitude');
    state.positions = [];
    if (state.map) {
      state.gpsLine.setLatLngs([]);
      state.drLine.setLatLngs([]);
      state.map.setView([state.simulatedLatitude, state.simulatedLongitude], 17);
      state.positionMarker.setLatLng([state.simulatedLatitude, state.simulatedLongitude]);
      state.gpsMarker.setLatLng([state.simulatedLatitude, state.simulatedLongitude]);
    }
    if (state.fallbackInitialized) {
      els.fallbackGpsPath.setAttribute('d', '');
      els.fallbackDrPath.setAttribute('d', '');
    }
    els.pathCount.textContent = '0 received positions';
    els.mapCaption.textContent = 'Track cleared';
    renderTelemetry(response);
    setMlEnabled(selectedMlState);
  } catch (error) {
    showError(`Reset failed: ${error.message}`);
  } finally {
    els.resetButton.disabled = false;
  }
}

async function setGpsAvailability(available) {
  if (!state.running || state.busy || state.gpsAvailable === available) return;
  state.busy = true;
  els.gpsLossButton.disabled = true;
  els.gpsRestoreButton.disabled = true;
  clearError();
  try {
    const now = Date.now() / 1000;
    const dt = state.timestamp === null ? 0.75 : Math.max(now - state.timestamp, 0.01);
    advanceSimulatedVehicle(dt);
    state.timestamp = now;
    state.gpsAvailable = available;
    const response = await postJson('/navigation/update', makeSensorPayload(now));
    renderTelemetry(response, true);
    els.liveStatus.textContent = available ? 'GPS fix restored by backend' : 'GPS unavailable; backend dead reckoning active';
  } catch (error) {
    state.gpsAvailable = !available;
    showError(`GPS ${available ? 'restore' : 'loss'} request failed: ${error.message}`);
  } finally {
    state.busy = false;
    els.gpsLossButton.disabled = !state.running || !state.gpsAvailable;
    els.gpsRestoreButton.disabled = !state.running || state.gpsAvailable;
  }
}

async function toggleMl() {
  els.mlButton.disabled = true;
  clearError();
  try {
    const response = await postJson('/navigation/ml', { enabled: !state.mlEnabled });
    if (typeof response.ml_enabled !== 'boolean') throw new Error('Backend ML response is invalid.');
    setMlEnabled(response.ml_enabled);
    if (response.model_available === false) {
      showError(response.message || 'ML model is unavailable; navigation remains in baseline mode.');
    }
  } catch (error) {
    showError(`ML toggle failed: ${error.message}`);
  } finally {
    els.mlButton.disabled = false;
  }
}

async function loadBackendState() {
  initializeMap();
  try {
    const health = await requestJson('/health');
    if (health.status !== 'ok' || health.backend_connected !== true) {
      throw new Error('Backend health response is invalid.');
    }
    setBackendStatus('is-connected', health.status === 'ok' ? 'Backend healthy' : 'Backend responded');
    if (typeof health.ml_enabled === 'boolean') setMlEnabled(health.ml_enabled);
    const response = await requestJson('/navigation/state');
    state.simulatedLatitude = numberValue(response.latitude, 'latitude');
    state.simulatedLongitude = numberValue(response.longitude, 'longitude');
    state.gpsAvailable = Boolean(response.gps_available);
    renderTelemetry(response);
    setMlEnabled(typeof health.ml_enabled === 'boolean' ? health.ml_enabled : state.mlEnabled);
  } catch (error) {
    setBackendStatus('is-disconnected');
    els.liveStatus.textContent = 'Backend unavailable';
    showError(error.message);
  }
}

els.startButton.addEventListener('click', startNavigation);
els.stopButton.addEventListener('click', stopNavigation);
els.resetButton.addEventListener('click', resetNavigation);
els.gpsLossButton.addEventListener('click', () => setGpsAvailability(false));
els.gpsRestoreButton.addEventListener('click', () => setGpsAvailability(true));
els.mlButton.addEventListener('click', toggleMl);

loadBackendState();
