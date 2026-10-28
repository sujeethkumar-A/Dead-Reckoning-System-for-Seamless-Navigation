const API_BASE = `http://${window.location.hostname || '127.0.0.1'}:8000`;
const UPDATE_INTERVAL_MS = 750;
const EARTH_RADIUS_METERS = 6371000;
const MAX_DEMO_SPEED_METERS_PER_SECOND = 25;
const MAX_SENSOR_SAMPLE_AGE_SECONDS = 3;
const RECENT_DESTINATIONS_KEY = 'deadReckoning.recentDestinations.v1';
const SAVED_SESSIONS_KEY = 'deadReckoning.simulationSessions.v1';

const state = {
  mode: 'REAL',
  running: false,
  demoPaused: false,
  busy: false,
  gpsAvailable: true,
  navigationActive: false,
  navigationPaused: false,
  followLocation: false,
  mapPickMode: null,
  timerId: null,
  lastTimestamp: null,
  gpsTimestamp: null,
  latitude: null,
  longitude: null,
  speed: 4.2,
  headingDegrees: 35,
  frame: 0,
  positions: [],
  truthPositions: [],
  errorHistory: [],
  transitionHistory: [],
  lastNavigationMode: null,
  lastRenderedPosition: null,
  latestSample: null,
  latestNavigation: null,
  origin: null,
  destination: null,
  route: null,
  routeOptions: [],
  routeProgressMeters: 0,
  routeDemoRequested: false,
  routeLayers: [],
  routeMarkers: [],
  routeLocationMarker: null,
  nearbyPlaces: [],
  nearbyMarkers: [],
  nearbyCategory: null,
  nearbySearchActive: false,
  nearbySearchComplete: false,
  mapLayers: null,
  simulation: {
    pattern: 'STRAIGHT',
    initialHeading: 0,
    speed: 4,
    speedMultiplier: 1,
    speedNoise: 0,
    headingError: 0,
    outageDuration: 30,
    outageStartedAt: null,
    truthLatitude: null,
    truthLongitude: null,
    groundTruthHeading: 0,
    followRoute: false,
    routeDistanceMeters: 0,
    routeComplete: false,
  },
  backendStatus: 'is-pending',
  backendConnected: false,
  lastError: null,
  map: null,
  mapHasCenteredOnPosition: false,
  positionMarker: null,
  gpsMarker: null,
  gpsLine: null,
  drLine: null,
  truthLine: null,
  truthMarker: null,
  layerControl: null,
  fallbackInitialized: false,
};

const els = {
  backendStatus: document.getElementById('backend-status'),
  phoneSensorLink: document.querySelector('.phone-link'),
  navigationStatus: document.getElementById('navigation-status'),
  liveStatus: document.getElementById('live-status'),
  errorBanner: document.getElementById('error-banner'),
  sourceLabel: document.getElementById('source-label'),
  realModeButton: document.getElementById('real-mode-btn'),
  demoModeButton: document.getElementById('demo-mode-btn'),
  modeDescription: document.getElementById('mode-description'),
  demoBanner: document.getElementById('demo-banner'),
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
  accelSource: document.getElementById('accel-source'),
  accelX: document.getElementById('accel-x'),
  accelY: document.getElementById('accel-y'),
  accelZ: document.getElementById('accel-z'),
  gyroSource: document.getElementById('gyro-source'),
  gyroAlpha: document.getElementById('gyro-alpha'),
  gyroBeta: document.getElementById('gyro-beta'),
  gyroGamma: document.getElementById('gyro-gamma'),
  mlNote: document.getElementById('ml-note'),
  startButton: document.getElementById('start-btn'),
  resetButton: document.getElementById('reset-btn'),
  gpsLossButton: document.getElementById('gps-loss-btn'),
  gpsRestoreButton: document.getElementById('gps-restore-btn'),
  pauseDemoButton: document.getElementById('pause-demo-btn'),
  resumeDemoButton: document.getElementById('resume-demo-btn'),
  mapCaption: document.getElementById('map-caption'),
  pathCount: document.getElementById('path-count'),
  mapElement: document.getElementById('map'),
  positionQuality: document.getElementById('position-quality'),
  positionQualitySecondary: document.getElementById('position-quality-secondary'),
  reliabilityStatus: document.getElementById('reliability-status'),
  reliabilityDetail: document.getElementById('reliability-detail'),
  sensorFreshness: document.getElementById('sensor-freshness'),
  gpsQuality: document.getElementById('gps-quality'),
  streamIndicator: document.getElementById('stream-indicator'),
  exportDiagnosticsButton: document.getElementById('export-diagnostics-btn'),
  originInput: document.getElementById('origin-input'),
  destinationInput: document.getElementById('destination-input'),
  originResults: document.getElementById('origin-results'),
  destinationResults: document.getElementById('destination-results'),
  useLocationButton: document.getElementById('use-location-btn'),
  pickOriginButton: document.getElementById('pick-origin-btn'),
  pickDestinationButton: document.getElementById('pick-destination-btn'),
  calculateRouteButton: document.getElementById('calculate-route-btn'),
  clearRouteButton: document.getElementById('clear-route-btn'),
  routeMessage: document.getElementById('route-message'),
  routeDetails: document.getElementById('route-details'),
  nearbyLocationStatus: document.getElementById('nearby-location-status'),
  nearbyResults: document.getElementById('nearby-results'),
  nearbyUseLocationButton: document.getElementById('nearby-use-location-btn'),
  nearbyCategoryButtons: [...document.querySelectorAll('[data-nearby-category]')],
  recenterMapButton: document.getElementById('recenter-map-btn'),
  showRouteButton: document.getElementById('show-route-btn'),
  routeSummary: document.getElementById('route-summary'),
  routeOverview: document.getElementById('route-overview'),
  routeChoiceList: document.getElementById('route-choice-list'),
  routeProfile: document.getElementById('route-profile'),
  startNavigationButton: document.getElementById('start-navigation-btn'),
  simulateRouteButton: document.getElementById('simulate-route-btn'),
  pauseNavigationButton: document.getElementById('pause-navigation-btn'),
  resumeNavigationButton: document.getElementById('resume-navigation-btn'),
  stopNavigationButton: document.getElementById('stop-navigation-btn'),
  followLocationButton: document.getElementById('follow-location-btn'),
  routeGuidance: document.getElementById('route-guidance'),
  nextManeuver: document.getElementById('next-maneuver'),
  routeRemaining: document.getElementById('route-remaining'),
  routeArrival: document.getElementById('route-arrival'),
  routeProgress: document.getElementById('route-progress'),
  routeProgressLabel: document.getElementById('route-progress-label'),
  turnList: document.getElementById('turn-list'),
  recentList: document.getElementById('recent-list'),
  clearRecentsButton: document.getElementById('clear-recents-btn'),
  simulationPattern: document.getElementById('simulation-pattern'),
  simulationControls: document.querySelector('.simulation-controls'),
  simulationStartLatitude: document.getElementById('simulation-start-lat'),
  simulationStartLongitude: document.getElementById('simulation-start-lon'),
  simulationHeading: document.getElementById('simulation-heading'),
  simulationSpeed: document.getElementById('simulation-speed'),
  simulationSpeedHelp: document.getElementById('simulation-speed-help'),
  simulationRate: document.getElementById('simulation-rate'),
  simulationNoise: document.getElementById('simulation-noise'),
  simulationHeadingError: document.getElementById('simulation-heading-error'),
  simulationOutage: document.getElementById('simulation-outage'),
  simulationGroundTruth: document.getElementById('simulation-ground-truth'),
  simulationError: document.getElementById('simulation-error'),
  simulationOutageTime: document.getElementById('simulation-outage-time'),
  transitionCount: document.getElementById('transition-count'),
  simulationErrorChart: document.getElementById('simulation-error-chart'),
  savedSessionsList: document.getElementById('saved-sessions-list'),
  clearSessionsButton: document.getElementById('clear-sessions-btn'),
  fallbackMap: document.getElementById('fallback-map'),
  fallbackGpsPath: document.getElementById('fallback-path-gps'),
  fallbackDrPath: document.getElementById('fallback-path-dr'),
  fallbackGpsPoint: document.getElementById('fallback-gps-point'),
  fallbackPosition: document.getElementById('fallback-position'),
  fallbackLabel: document.getElementById('fallback-label'),
};

function setBackendStatus(status, detail) {
  state.backendStatus = status;
  state.backendConnected = status === 'is-connected';
  els.backendStatus.className = `status-pill ${status}`;
  els.backendStatus.querySelector('span').textContent = status === 'is-connected'
    ? 'BACKEND CONNECTED'
    : status === 'is-disconnected' ? 'BACKEND DISCONNECTED'
      : status === 'is-error' ? 'BACKEND ERROR' : 'CHECKING BACKEND';
  if (detail) els.liveStatus.textContent = detail;
  updateReliability();
}

async function handleStartDemo() {
  if (state.mode !== 'DEMO') return;
  if (!state.route && (state.origin || state.destination)) {
    els.routeDetails.open = true;
    setRouteMessage('Find a route first. The demo will not move away from your selected destination.', true);
    return;
  }
  if (state.route) {
    await startRouteDemo();
    return;
  }
  await startDemo();
}

async function startRouteDemo() {
  if (!state.route || state.busy || (state.mode === 'DEMO' && state.running)) return;
  if (state.mode !== 'DEMO') setMode('DEMO');
  const first = state.route.geometry[0];
  const initial = positionOnRoute(state.route, 0);
  const isWalking = state.route.profile === 'foot';
  configureDemoSpeedOptions(state.route.profile);
  const configuredSpeedKmh = Number(els.simulationSpeed.value);
  const defaultSpeedKmh = isWalking ? 5 : 50;
  els.simulationStartLatitude.value = first[0].toFixed(6);
  els.simulationStartLongitude.value = first[1].toFixed(6);
  els.simulationHeading.value = String(Math.round(initial.heading));
  const boundedSpeedKmh = Number.isFinite(configuredSpeedKmh) && configuredSpeedKmh > 0
    ? Math.min(configuredSpeedKmh, isWalking ? 6 : 60)
    : defaultSpeedKmh;
  els.simulationSpeed.value = String(boundedSpeedKmh);
  els.simulationRate.value = '1';
  els.simulationNoise.value = '0';
  els.simulationHeadingError.value = '0';
  els.simulationOutage.value = '0';
  els.simulationPattern.value = 'STRAIGHT';
  state.routeDemoRequested = true;
  try {
    await startDemo();
  } finally {
    state.routeDemoRequested = false;
  }
}

function configureDemoSpeedOptions(profile = els.routeProfile.value) {
  const isWalking = profile === 'foot';
  const speeds = isWalking ? [4, 5, 6] : [30, 40, 50, 60];
  const currentSpeed = Number(els.simulationSpeed.value);
  const selectedSpeed = speeds.includes(currentSpeed) ? currentSpeed : (isWalking ? 5 : 50);
  const options = speeds.map((speed) => {
    const option = document.createElement('option');
    option.value = String(speed);
    option.textContent = `${speed} km/h`;
    return option;
  });
  els.simulationSpeed.replaceChildren(...options);
  els.simulationSpeed.value = String(selectedSpeed);
  els.simulationSpeedHelp.textContent = isWalking
    ? 'Walking demo only: choose a walking-speed cap. The real sensor mode is unchanged.'
    : 'Driving demo only: routed segments follow route timing up to this cap (highway segments may reach 50–60 km/h). Standalone demos use the cap directly.';
}

function showError(message) {
  state.lastError = message;
  els.errorBanner.textContent = message;
  els.errorBanner.hidden = false;
  els.liveStatus.textContent = 'Backend request failed';
  updateReliability();
}

function clearError() {
  state.lastError = null;
  els.errorBanner.hidden = true;
  els.errorBanner.textContent = '';
}

function numberValue(value, field) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Backend response has an invalid ${field}.`);
  return parsed;
}

function displayReading(value, digits = 3) {
  return value !== null && value !== undefined && Number.isFinite(Number(value))
    ? Number(value).toFixed(digits)
    : '--';
}

function formatAge(seconds) {
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} hr`;
  return `${Math.floor(seconds / 86400)} days`;
}

async function requestJson(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    setBackendStatus('is-disconnected');
    const reason = error.name === 'TimeoutError'
      ? 'Backend request timed out.'
      : `Cannot reach FastAPI at ${API_BASE}. Start the backend and check the connection.`;
    throw new Error(reason);
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    setBackendStatus('is-error');
    throw new Error(`Backend returned an invalid response (${response.status}).`);
  }
  if (!response.ok) {
    setBackendStatus('is-error');
    const detail = typeof data.detail === 'string'
      ? data.detail
      : `Request failed with HTTP ${response.status}.`;
    throw new Error(detail);
  }
  return data;
}

function postJson(path, payload = {}) {
  return requestJson(path, { method: 'POST', body: JSON.stringify(payload) });
}

function initializeMap() {
  if (window.L) {
    state.map = L.map(els.mapElement, { zoomControl: false }).setView([20, 0], 2);
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
    });
    streetLayer.addTo(state.map);
    state.gpsLine = L.polyline([], { color: '#16805d', weight: 3, opacity: 0.95 }).addTo(state.map);
    state.drLine = L.polyline([], { color: '#e18a18', weight: 3, opacity: 0.95, dashArray: '7 7' }).addTo(state.map);
    state.truthLine = L.polyline([], { color: '#7556c7', weight: 2, opacity: 0.8, dashArray: '3 6' }).addTo(state.map);
    state.layerControl = L.control.layers(
      { 'Street map': streetLayer, 'Topographic': topoLayer },
      { 'GPS path': state.gpsLine, 'Dead-reckoning estimate': state.drLine, 'Simulation ground truth': state.truthLine },
      { collapsed: true, position: 'bottomright' },
    ).addTo(state.map);
    L.control.zoom({ position: 'bottomleft' }).addTo(state.map);
    updateMapActionControls();
    state.map.on('click', (event) => {
      if (!state.mapPickMode) return;
      const selectedKind = state.mapPickMode;
      const location = {
        label: `${event.latlng.lat.toFixed(5)}, ${event.latlng.lng.toFixed(5)}`,
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      };
      setRoutePoint(selectedKind, location);
      state.mapPickMode = null;
      els.pickOriginButton.setAttribute('aria-pressed', 'false');
      els.pickDestinationButton.setAttribute('aria-pressed', 'false');
      setRouteMessage(`Selected ${location.label} as the ${selectedKind}.`);
    });
  } else {
    els.mapElement.hidden = true;
    els.fallbackMap.hidden = false;
    state.fallbackInitialized = true;
  }
}

function updateMapActionControls() {
  els.showRouteButton.disabled = !state.route;
  els.recenterMapButton.disabled = !state.map;
}

function recenterMap() {
  if (!state.map) return;
  const navigation = state.latestNavigation;
  const hasNavigationPosition = navigation
    && ['GPS', 'DEAD_RECKONING'].includes(navigation.navigation_mode)
    && isCoordinate(Number(navigation.latitude), Number(navigation.longitude));
  const center = hasNavigationPosition
    ? [Number(navigation.latitude), Number(navigation.longitude)]
    : state.origin
      ? [state.origin.latitude, state.origin.longitude]
      : state.destination
        ? [state.destination.latitude, state.destination.longitude]
        : null;
  if (!center) {
    els.nearbyLocationStatus.textContent = 'No current position yet. Set your start location or open the phone sensor page.';
    return;
  }
  state.map.setView(center, Math.max(state.map.getZoom(), 16), { animate: true });
  if (state.navigationActive) {
    state.followLocation = true;
    els.mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setNavigationControls();
  }
}

function showRouteOnMap() {
  if (!state.map) return;
  if (state.route) {
    state.map.fitBounds(state.route.geometry, { padding: [54, 54], maxZoom: 17 });
    state.mapHasCenteredOnPosition = true;
    return;
  }
  const points = [state.origin, state.destination]
    .filter((point) => point && isCoordinate(point.latitude, point.longitude))
    .map((point) => [point.latitude, point.longitude]);
  if (points.length) {
    state.map.fitBounds(points, { padding: [54, 54], maxZoom: 17 });
    state.mapHasCenteredOnPosition = true;
  }
}

const geocodeCache = new Map();
let geocodeQueue = Promise.resolve();
let lastGeocodeRequestAt = 0;
let nearbySearchQueue = Promise.resolve();
let lastNearbySearchAt = 0;
const storedDestinations = readLocalList(RECENT_DESTINATIONS_KEY)
  .filter((location) => location && typeof location.label === 'string'
    && isCoordinate(Number(location.latitude), Number(location.longitude)))
  .slice(0, 8);
const storedSessions = readLocalList(SAVED_SESSIONS_KEY)
  .filter((session) => session && session.simulated === true
    && Array.isArray(session.positions) && Array.isArray(session.ground_truth))
  .slice(0, 10);

function readLocalList(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    setRouteMessage('Saved browser data could not be read; local history was not loaded.', true);
    return [];
  }
}

function persistLocalList(key, values) {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    setRouteMessage('Browser storage is unavailable; this item was not saved on this device.', true);
  }
}

function isCoordinate(latitude, longitude) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180;
}

function setRouteMessage(message, isError = false) {
  els.routeMessage.textContent = message;
  els.routeMessage.classList.toggle('is-error', isError);
}

function externalServiceError(error, operation) {
  const message = error instanceof Error ? error.message : String(error);
  if (/timed out|timeout|abort/i.test(message)) {
    return `${operation} timed out. The public service may be busy; try again or select the location on the map.`;
  }
  if (error instanceof TypeError) {
    return `${operation} could not reach the public service. Check the internet connection or select the location on the map.`;
  }
  return message || `${operation} failed.`;
}

function invalidateRoute() {
  if (!state.route) return;
  removeRouteLayers();
  state.route = null;
  state.routeOptions = [];
  state.routeProgressMeters = 0;
  state.navigationActive = false;
  state.navigationPaused = false;
  state.followLocation = false;
  els.routeSummary.hidden = true;
  els.routeGuidance.hidden = true;
  updateMapActionControls();
  updateMapActionControls();
  els.routeOverview.textContent = '';
  els.routeChoiceList.replaceChildren();
  setNavigationControls();
  updateModeControls();
}

function setRoutePoint(kind, location) {
  if (kind !== 'origin' && kind !== 'destination') return;
  if (location && !isCoordinate(location.latitude, location.longitude)) {
    setRouteMessage('Selected location has invalid coordinates.', true);
    return;
  }
  state[kind] = location;
  if (kind === 'origin') clearNearbySearchState();
  invalidateRoute();
  const input = kind === 'origin' ? els.originInput : els.destinationInput;
  const results = kind === 'origin' ? els.originResults : els.destinationResults;
  input.value = location ? location.label : '';
  results.hidden = true;
  updateWaypointMarkers();
  updateNearbyLocationStatus();
  updateMapActionControls();
  setNavigationControls();
  if (kind === 'origin' && state.mode === 'DEMO') {
    els.simulationStartLatitude.value = location.latitude.toFixed(6);
    els.simulationStartLongitude.value = location.longitude.toFixed(6);
  }
}

const NEARBY_CATEGORIES = {
  restaurant: { label: 'restaurants', key: 'amenity', values: ['restaurant', 'cafe', 'fast_food', 'food_court'], searchText: 'restaurant', nominatimTypes: ['restaurant', 'cafe', 'fast_food', 'food_court'], icon: '☕', color: '#d97706' },
  fuel: { label: 'petrol stations', key: 'amenity', values: ['fuel'], searchText: 'petrol station', nominatimTypes: ['fuel'], icon: '⛽', color: '#2563eb' },
  hotel: { label: 'hotels', key: 'tourism', values: ['hotel', 'motel', 'guest_house'], searchText: 'hotel', nominatimTypes: ['hotel', 'motel', 'guest_house'], icon: '⌂', color: '#7c3aed' },
  atm: { label: 'ATMs', key: 'amenity', values: ['atm'], searchText: 'ATM', nominatimTypes: ['atm'], icon: '₹', color: '#0f766e' },
  grocery: { label: 'grocery stores', key: 'shop', values: ['supermarket', 'convenience', 'greengrocer'], searchText: 'grocery store', nominatimTypes: ['supermarket', 'convenience', 'greengrocer'], icon: '🛒', color: '#15803d' },
};
const NEARBY_SERVICE_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];

function updateWaypointMarkers() {
  if (!state.map) return;
  for (const marker of state.routeMarkers) state.map.removeLayer(marker);
  state.routeMarkers = [];
  for (const [kind, location] of [['START', state.origin], ['DESTINATION', state.destination]]) {
    if (!location) continue;
    const marker = L.marker([location.latitude, location.longitude], {
      icon: L.divIcon({
        className: `waypoint-marker ${kind === 'START' ? 'is-start' : 'is-destination'}`,
        html: `<span>${kind === 'START' ? 'A' : 'B'} <small>${kind === 'START' ? 'START' : 'END'}</small></span>`,
        iconSize: [72, 32],
        iconAnchor: [16, 29],
      }),
      title: `${kind}: ${location.label}`,
    }).addTo(state.map);
    state.routeMarkers.push(marker);
  }
}

function getNearbyCenter() {
  if (state.origin && isCoordinate(state.origin.latitude, state.origin.longitude)) {
    return { ...state.origin, source: 'selected start' };
  }
  const navigation = state.latestNavigation;
  if (
    navigation
    && ['GPS', 'DEAD_RECKONING'].includes(navigation.navigation_mode)
    && isCoordinate(Number(navigation.latitude), Number(navigation.longitude))
  ) {
    return {
      label: state.mode === 'DEMO' ? 'Simulated current position' : 'Current navigation position',
      latitude: Number(navigation.latitude),
      longitude: Number(navigation.longitude),
      source: state.mode === 'DEMO' ? 'demo position' : 'current position',
    };
  }
  return null;
}

function updateNearbyLocationStatus() {
  if (state.nearbySearchActive || state.nearbySearchComplete) return;
  const center = getNearbyCenter();
  els.nearbyLocationStatus.textContent = center
    ? `Searching around ${center.label} · ${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}`
    : 'Set your starting location to find nearby places.';
}

function clearNearbyMarkers() {
  if (state.map) {
    for (const marker of state.nearbyMarkers) state.map.removeLayer(marker);
  }
  state.nearbyMarkers = [];
}

function clearNearbySearchState() {
  state.nearbySearchActive = false;
  state.nearbySearchComplete = false;
  state.nearbyPlaces = [];
  state.nearbyCategory = null;
  clearNearbyMarkers();
  els.nearbyResults.replaceChildren();
  for (const button of els.nearbyCategoryButtons) {
    button.setAttribute('aria-pressed', 'false');
  }
}

function formatNearbyDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function nearbyElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function showNearbyPlaceOnMap(place, category) {
  if (!state.map || !window.L) return;
  const marker = L.marker([place.latitude, place.longitude], {
    icon: L.divIcon({
      className: 'nearby-map-marker',
      html: `<span style="--marker-color:${category.color}">${category.icon}</span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    }),
    title: place.name,
  }).addTo(state.map);
  const popup = document.createElement('div');
  const title = nearbyElement('strong', '', place.name);
  const detail = nearbyElement('div', 'nearby-popup-detail', `${category.label} · ${formatNearbyDistance(place.distance)}`);
  const directions = nearbyElement('button', 'nearby-popup-directions', 'Directions');
  directions.type = 'button';
  directions.addEventListener('click', () => routeToNearbyPlace(place));
  popup.append(title, detail, directions);
  marker.bindPopup(popup);
  state.nearbyMarkers.push(marker);
}

function renderNearbyPlaces(places, category) {
  els.nearbyResults.replaceChildren();
  if (!places.length) {
    els.nearbyResults.appendChild(nearbyElement(
      'p',
      'nearby-empty',
      `No mapped ${category.label} found within 2 km. Try another category or a different starting location.`,
    ));
    return;
  }
  const list = nearbyElement('div', 'nearby-place-list');
  for (const place of places) {
    const item = nearbyElement('article', 'nearby-place');
    const icon = nearbyElement('span', 'nearby-place-icon', category.icon);
    icon.style.setProperty('--marker-color', category.color);
    const details = nearbyElement('div', 'nearby-place-details');
    details.append(
      nearbyElement('strong', '', place.name),
      nearbyElement('small', '', `${category.label} · ${formatNearbyDistance(place.distance)}`),
    );
    const directions = nearbyElement('button', 'nearby-directions-button', 'Directions');
    directions.type = 'button';
    directions.addEventListener('click', () => routeToNearbyPlace(place));
    item.append(icon, details, directions);
    list.appendChild(item);
  }
  els.nearbyResults.appendChild(list);
}

async function searchNearbyWithNominatim(center, category) {
  const task = nearbySearchQueue.then(async () => {
    const wait = Math.max(0, 1000 - (Date.now() - lastNearbySearchAt));
    if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));

    const latitudeDelta = 2000 / 111320;
    const longitudeDelta = 2000 / (
      111320 * Math.max(Math.abs(Math.cos(center.latitude * Math.PI / 180)), 0.01)
    );
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('q', category.searchText);
    url.searchParams.set('viewbox', [
      center.longitude - longitudeDelta,
      center.latitude + latitudeDelta,
      center.longitude + longitudeDelta,
      center.latitude - latitudeDelta,
    ].join(','));
    url.searchParams.set('bounded', '1');
    url.searchParams.set('limit', '30');
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'Accept-Language': navigator.language || 'en' },
      signal: AbortSignal.timeout(10000),
    });
    lastNearbySearchAt = Date.now();
    if (!response.ok) throw new Error(`OpenStreetMap search failed (HTTP ${response.status}).`);
    const results = await response.json();
    if (!Array.isArray(results)) throw new Error('OpenStreetMap search returned invalid data.');

    return results.map((result) => {
      const latitude = Number(result.lat);
      const longitude = Number(result.lon);
      const type = String(result.type || '').toLocaleLowerCase();
      if (!isCoordinate(latitude, longitude) || !category.nominatimTypes.includes(type)) return null;
      const distance = distanceBetween(
        [center.latitude, center.longitude],
        [latitude, longitude],
      );
      if (distance > 2000) return null;
      return {
        name: String(result.name || result.display_name?.split(',')[0] || `Unnamed ${category.label.slice(0, -1)}`),
        latitude,
        longitude,
        distance,
      };
    }).filter(Boolean)
      .sort((first, second) => first.distance - second.distance)
      .slice(0, 12);
  });
  nearbySearchQueue = task.catch(() => []);
  return task;
}

async function findNearbyPlaces(categoryKey) {
  const category = NEARBY_CATEGORIES[categoryKey];
  if (!category) return;
  state.nearbySearchActive = false;
  state.nearbySearchComplete = false;
  const center = getNearbyCenter();
  if (!center) {
    els.nearbyLocationStatus.textContent = 'Choose a starting place or use Set My Location before searching nearby.';
    els.nearbyResults.replaceChildren(nearbyElement(
      'p',
      'nearby-empty',
      'Nearby search needs a real current location or a place you selected as the start.',
    ));
    return;
  }
  state.nearbyCategory = categoryKey;
  state.nearbySearchActive = true;
  for (const button of els.nearbyCategoryButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.nearbyCategory === categoryKey));
  }
  els.nearbyLocationStatus.textContent = `Searching for ${category.label} around ${center.latitude.toFixed(5)}, ${center.longitude.toFixed(5)}…`;
  els.nearbyResults.replaceChildren(nearbyElement('p', 'nearby-empty', 'Contacting the OpenStreetMap nearby places service…'));
  clearNearbyMarkers();
  try {
    let places = await searchNearbyWithNominatim(center, category);
    let source = 'OpenStreetMap search';
    if (!places.length) {
      const values = category.values.join('|');
      const around = `around:2000,${center.latitude.toFixed(6)},${center.longitude.toFixed(6)}`;
      const query = `[out:json][timeout:15];(node(${around})[${category.key}~"^(${values})$"];way(${around})[${category.key}~"^(${values})$"];);out center tags 60;`;
      let body = null;
      let lastServiceError = null;
      for (const endpoint of NEARBY_SERVICE_ENDPOINTS) {
        try {
          const url = new URL(endpoint);
          url.searchParams.set('data', query);
          const response = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(7000),
          });
          if (!response.ok) throw new Error(`Nearby places service failed (HTTP ${response.status}).`);
          body = await response.json();
          break;
        } catch (error) {
          lastServiceError = error;
        }
      }
      if (!body) throw lastServiceError || new Error('Nearby places services are unavailable.');
      if (!Array.isArray(body.elements)) throw new Error('Nearby places service returned invalid data.');
      places = body.elements.map((element) => {
        const latitude = Number(element.lat ?? element.center?.lat);
        const longitude = Number(element.lon ?? element.center?.lon);
        if (!isCoordinate(latitude, longitude)) return null;
        const tags = element.tags || {};
        return {
          name: String(tags.name || tags.brand || tags.operator || `Unnamed ${category.label.slice(0, -1)}`),
          latitude,
          longitude,
          distance: distanceBetween([center.latitude, center.longitude], [latitude, longitude]),
        };
      }).filter(Boolean)
        .sort((first, second) => first.distance - second.distance)
        .filter((place, index, list) => list.findIndex((candidate) => (
          Math.abs(candidate.latitude - place.latitude) < 0.00001
          && Math.abs(candidate.longitude - place.longitude) < 0.00001
        )) === index)
        .slice(0, 12);
      source = 'Overpass map data';
    }
    state.nearbyPlaces = places;
    renderNearbyPlaces(places, category);
    for (const place of places) showNearbyPlaceOnMap(place, category);
    els.nearbyLocationStatus.textContent = places.length
      ? `${places.length} nearby ${category.label} · around ${center.label} · ${source}`
      : `No mapped ${category.label} found within 2 km of ${center.label}.`;
    state.nearbySearchActive = false;
    state.nearbySearchComplete = true;
    if (places.length && state.map) {
      const bounds = L.latLngBounds([
        [center.latitude, center.longitude],
        ...places.map((place) => [place.latitude, place.longitude]),
      ]);
      state.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  } catch (error) {
    const message = externalServiceError(error, 'Nearby search');
    els.nearbyLocationStatus.textContent = message;
    els.nearbyResults.replaceChildren(nearbyElement(
      'p',
      'nearby-empty is-error',
      `${message} Place search requires an internet connection and the public map service may be unavailable.`,
    ));
    state.nearbySearchActive = false;
    state.nearbySearchComplete = true;
  }
}

async function routeToNearbyPlace(place) {
  const currentStart = getNearbyCenter();
  if (!currentStart) {
    els.nearbyLocationStatus.textContent = 'Set a starting location before requesting directions.';
    return;
  }
  const start = {
    label: currentStart.label,
    latitude: currentStart.latitude,
    longitude: currentStart.longitude,
  };
  setRoutePoint('origin', start);
  setRoutePoint('destination', {
    label: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
  });
  els.originInput.value = start.label;
  els.destinationInput.value = place.name;
  els.routeDetails.open = true;
  if (state.map) state.map.closePopup();
  await calculateRoute();
  els.mapElement.closest('.map-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function searchPlaces(query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (normalizedQuery.length < 3) return [];
  if (geocodeCache.has(normalizedQuery)) return geocodeCache.get(normalizedQuery);

  const task = geocodeQueue.then(async () => {
    const wait = Math.max(0, 1000 - (Date.now() - lastGeocodeRequestAt));
    if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '5');
    url.searchParams.set('q', query.trim());
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'Accept-Language': navigator.language || 'en' },
      signal: AbortSignal.timeout(10000),
    });
    lastGeocodeRequestAt = Date.now();
    if (!response.ok) throw new Error(`Place search failed (HTTP ${response.status}).`);
    const results = await response.json();
    if (!Array.isArray(results)) throw new Error('Place search returned an invalid response.');
    const locations = results
      .filter((result) => isCoordinate(Number(result.lat), Number(result.lon)))
      .map((result) => ({
        label: String(result.display_name || query.trim()),
        latitude: Number(result.lat),
        longitude: Number(result.lon),
      }));
    geocodeCache.set(normalizedQuery, locations);
    return locations;
  });
  geocodeQueue = task.catch(() => []);
  return task;
}

function showSearchResults(kind, results) {
  const container = kind === 'origin' ? els.originResults : els.destinationResults;
  container.replaceChildren();
  for (const location of results) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'search-result';
    button.role = 'option';
    button.textContent = location.label;
    button.addEventListener('click', () => {
      setRoutePoint(kind, location);
      setRouteMessage(`Selected ${kind}: ${location.label}`);
    });
    container.appendChild(button);
  }
  container.hidden = results.length === 0;
}

function bindPlaceSearch(kind) {
  const input = kind === 'origin' ? els.originInput : els.destinationInput;
  const results = kind === 'origin' ? els.originResults : els.destinationResults;
  let timer = null;
  input.addEventListener('input', () => {
    const text = input.value.trim();
    invalidateRoute();
    state[kind] = null;
    if (kind === 'origin') state.simulation.truthLatitude = null;
    updateNearbyLocationStatus();
    results.hidden = true;
    if (text.length < 3) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      try {
          const matches = await searchPlaces(text);
          if (input.value.trim() === text) showSearchResults(kind, matches);
        } catch (error) {
          if (input.value.trim() === text) {
            setRouteMessage(externalServiceError(error, 'Place search'), true);
          }
        }
    }, 850);
  });
  input.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const firstResult = results.querySelector('.search-result');
    if (firstResult) {
      firstResult.click();
      return;
    }
    try {
      const matches = await searchPlaces(input.value);
      if (!matches.length) {
        setRouteMessage('No matching place found. Try a more specific search.', true);
        return;
      }
      setRoutePoint(kind, matches[0]);
      setRouteMessage(`Selected ${kind}: ${matches[0].label}`);
    } catch (error) {
      setRouteMessage(externalServiceError(error, 'Place search'), true);
    }
  });
}

function requestBrowserLocation() {
  if (!navigator.geolocation) {
    setRouteMessage('Geolocation is not available in this browser. Search for or pick a start point on the map.', true);
    return;
  }
  setRouteMessage('Requesting this browser’s current location…');
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      if (!isCoordinate(latitude, longitude)) {
        setRouteMessage('Browser returned an invalid location.', true);
        return;
      }
      const location = {
        label: `Current location (±${Number(accuracy).toFixed(0)} m)`,
        latitude,
        longitude,
        accuracy: Number.isFinite(accuracy) ? accuracy : null,
      };
      setRoutePoint('origin', location);
      if (state.map) {
        if (state.routeLocationMarker) state.map.removeLayer(state.routeLocationMarker);
        state.routeLocationMarker = L.circleMarker([latitude, longitude], {
          radius: 8,
          color: '#fff',
          weight: 3,
          fillColor: '#1769d2',
          fillOpacity: 1,
        }).addTo(state.map).bindTooltip(`Browser location · ±${location.accuracy?.toFixed(0) ?? '?'} m`);
        state.map.setView([latitude, longitude], 16);
      }
      updateNearbyLocationStatus();
      setRouteMessage('Current browser location is set as the route start.');
    },
    (error) => {
      const messages = {
        1: 'Location permission was denied. Allow location access or select a start point manually.',
        2: 'Current location is unavailable. Search for a start point or choose one on the map.',
        3: 'Location request timed out. Try again or choose a start point manually.',
      };
      const message = messages[error.code] || `Location error: ${error.message}`;
      els.nearbyLocationStatus.textContent = message;
      setRouteMessage(message, true);
    },
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 },
  );
}

function setMapPickMode(kind) {
  state.mapPickMode = state.mapPickMode === kind ? null : kind;
  els.pickOriginButton.setAttribute('aria-pressed', String(state.mapPickMode === 'origin'));
  els.pickDestinationButton.setAttribute('aria-pressed', String(state.mapPickMode === 'destination'));
  if (state.map) els.mapElement.style.cursor = state.mapPickMode ? 'crosshair' : '';
  if (state.mapPickMode) setRouteMessage(`Click the map to select the ${kind}.`);
}

function removeRouteLayers() {
  for (const layer of state.routeLayers) {
    if (state.map) state.map.removeLayer(layer);
    if (state.layerControl) state.layerControl.removeLayer(layer);
  }
  state.routeLayers = [];
}

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

function maneuverText(step) {
  const type = String(step.maneuver?.type || 'continue').replaceAll('_', ' ');
  const modifier = step.maneuver?.modifier ? ` ${String(step.maneuver.modifier).replaceAll('_', ' ')}` : '';
  const road = step.name ? ` onto ${step.name}` : '';
  if (type === 'depart') return `Start${road}`;
  if (type === 'arrive') return 'Arrive at destination';
  return `${type}${modifier}${road}`;
}

function renderTurnList() {
  els.turnList.replaceChildren();
  if (!state.route) return;
  for (const [index, step] of state.route.steps.slice(0, 30).entries()) {
    const item = document.createElement('li');
    item.dataset.stepIndex = String(index);
    const instruction = document.createElement('span');
    instruction.textContent = maneuverText(step);
    const distance = document.createElement('span');
    distance.textContent = formatDistance(step.distance);
    item.append(instruction, distance);
    els.turnList.appendChild(item);
  }
}

function rememberDestination(location) {
  if (!location) return;
  const next = [
    { label: location.label, latitude: location.latitude, longitude: location.longitude, savedAt: new Date().toISOString() },
    ...storedDestinations.filter((entry) => entry.label !== location.label),
  ].slice(0, 8);
  storedDestinations.splice(0, storedDestinations.length, ...next);
  persistLocalList(RECENT_DESTINATIONS_KEY, storedDestinations);
  renderRecentDestinations();
}

function renderRecentDestinations() {
  els.recentList.replaceChildren();
  if (!storedDestinations.length) {
    els.recentList.textContent = 'No saved destinations on this device.';
    return;
  }
  for (const location of storedDestinations) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recent-item';
    button.textContent = location.label;
    button.title = `Use ${location.label} as destination`;
    button.addEventListener('click', () => {
      setRoutePoint('destination', location);
      setRouteMessage(`Selected recent destination: ${location.label}`);
    });
    els.recentList.appendChild(button);
  }
}

function clearRoute() {
  removeRouteLayers();
  for (const marker of state.routeMarkers) {
    if (state.map) state.map.removeLayer(marker);
  }
  state.routeMarkers = [];
  state.route = null;
  state.routeOptions = [];
  state.simulation.followRoute = false;
  state.simulation.routeComplete = false;
  state.mapPickMode = null;
  state.navigationActive = false;
  state.navigationPaused = false;
  state.followLocation = false;
  els.pickOriginButton.setAttribute('aria-pressed', 'false');
  els.pickDestinationButton.setAttribute('aria-pressed', 'false');
  state.origin = null;
  state.destination = null;
  els.originInput.value = '';
  els.destinationInput.value = '';
  updateNearbyLocationStatus();
  els.routeSummary.hidden = true;
  els.routeOverview.textContent = '';
  els.routeChoiceList.replaceChildren();
  els.routeGuidance.hidden = true;
  els.simulateRouteButton.disabled = true;
  updateMapActionControls();
  els.startNavigationButton.disabled = true;
  setNavigationControls();
  setRouteMessage('Route cleared. Set a start and destination to plan a new route.');
}

async function calculateRoute() {
  if (!state.origin || !state.destination) {
    setRouteMessage('Choose both a start and destination before requesting a route.', true);
    return;
  }
  if (!state.map || !window.L) {
    setRouteMessage('The interactive map library is unavailable; routing cannot be displayed.', true);
    return;
  }
  if (
    state.origin.latitude === state.destination.latitude
    && state.origin.longitude === state.destination.longitude
  ) {
    setRouteMessage('Choose different start and destination locations.', true);
    return;
  }
  els.calculateRouteButton.disabled = true;
  setRouteMessage(`Finding a ${els.routeProfile.value === 'foot' ? 'walking' : 'driving'} route…`);
  try {
    const coordinates = `${state.origin.longitude},${state.origin.latitude};${state.destination.longitude},${state.destination.latitude}`;
    const routingBase = els.routeProfile.value === 'foot'
      ? 'https://routing.openstreetmap.de/routed-foot/route/v1/driving'
      : 'https://router.project-osrm.org/route/v1/driving';
    const url = `${routingBase}/${coordinates}?overview=full&geometries=geojson&steps=true&alternatives=true`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Routing service failed (HTTP ${response.status}).`);
    const body = await response.json();
    if (body.code !== 'Ok' || !Array.isArray(body.routes) || body.routes.length === 0) {
      throw new Error(`No ${els.routeProfile.value === 'foot' ? 'walking' : 'driving'} route was found between these locations.`);
    }
    removeRouteLayers();
    const routes = body.routes.map(buildRouteOption).filter(Boolean);
    if (!routes.length) throw new Error('Routing service returned no valid route geometry.');
    routes.sort((first, second) => first.distance - second.distance);
    state.routeOptions = routes;
    const routeColors = ['#1a73e8', '#16a765', '#a142f4', '#e8710a'];
    state.routeLayers = routes.map((route, index) => {
      const line = L.polyline(route.geometry, {
        color: routeColors[index % routeColors.length],
        weight: index === 0 ? 7 : 5,
        opacity: index === 0 ? 0.96 : 0.6,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(state.map);
      route.layer = line;
      return line;
    });
    selectRouteOption(0);
    updateWaypointMarkers();
    state.map.fitBounds(state.route.geometry, { padding: [36, 36] });
    state.mapHasCenteredOnPosition = true;
    updateMapActionControls();
    rememberDestination(state.destination);
    updateModeControls();
    setRouteMessage(`Shortest-by-distance ${els.routeProfile.value === 'foot' ? 'walking' : 'driving'} route selected. Start live navigation or simulate this route on the laptop.`);
  } catch (error) {
    removeRouteLayers();
    state.route = null;
    state.routeOptions = [];
    els.routeSummary.hidden = true;
    els.routeGuidance.hidden = true;
    setRouteMessage(`${externalServiceError(error, 'Route request')} You can still use live tracking without routing; no route was fabricated.`, true);
  } finally {
    els.calculateRouteButton.disabled = false;
    setNavigationControls();
  }
}

function buildRouteOption(candidate) {
  const coordinates = candidate.geometry?.coordinates;
  const distance = Number(candidate.distance);
  const duration = Number(candidate.duration);
  if (
    !Array.isArray(coordinates)
    || coordinates.length < 2
    || coordinates.some((pair) => (
      !Array.isArray(pair)
      || pair.length < 2
      || !isCoordinate(Number(pair[1]), Number(pair[0]))
    ))
    || !Number.isFinite(distance)
    || distance < 0
    || !Number.isFinite(duration)
    || duration < 0
  ) return null;

  const geometry = coordinates.map(([longitude, latitude]) => [Number(latitude), Number(longitude)]);
  const pathCumulative = [0];
  for (let index = 1; index < geometry.length; index += 1) {
    pathCumulative.push(
      pathCumulative[index - 1] + distanceBetween(geometry[index - 1], geometry[index]),
    );
  }
  const steps = Array.isArray(candidate.legs)
    ? candidate.legs.flatMap((leg) => Array.isArray(leg.steps) ? leg.steps : [])
      .map((step) => ({
        ...step,
        distance: Math.max(0, Number(step.distance) || 0),
        duration: Math.max(0, Number(step.duration) || 0),
        cumulativeDistance: 0,
      }))
    : [];
  let stepDistance = 0;
  for (const step of steps) {
    stepDistance += step.distance;
    step.cumulativeDistance = stepDistance;
  }
  const pathDistance = pathCumulative[pathCumulative.length - 1];
  if (pathDistance <= 0) return null;
  const speedSegments = stepDistance > 0
    ? steps.map((step) => ({
      endDistance: pathDistance * step.cumulativeDistance / stepDistance,
      speedMetersPerSecond: step.duration > 0 ? step.distance / step.duration : null,
    }))
    : [];
  return {
    geometry,
    pathCumulative,
    pathDistance,
    speedSegments,
    profile: els.routeProfile.value,
    distance,
    duration,
    steps,
    alternatives: 0,
    layer: null,
  };
}

function selectRouteOption(index) {
  if (state.navigationActive || state.navigationPaused
    || (state.mode === 'DEMO' && state.running && state.simulation.followRoute)) {
    setRouteMessage('Stop route guidance before choosing a different route.', true);
    return;
  }
  const route = state.routeOptions[index];
  if (!route) return;
  state.route = route;
  state.routeProgressMeters = 0;
  state.simulation.routeDistanceMeters = 0;
  state.simulation.routeComplete = false;
  state.routeOptions.forEach((option, optionIndex) => {
    const selected = optionIndex === index;
    option.layer?.setStyle({
      color: selected ? '#1a73e8' : '#7f9dbb',
      weight: selected ? 7 : 5,
      opacity: selected ? 0.96 : 0.48,
    });
    if (selected) option.layer?.bringToFront();
  });
  els.routeChoiceList.replaceChildren();
  state.routeOptions.forEach((option, optionIndex) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `route-choice ${optionIndex === index ? 'is-selected' : ''}`;
    button.setAttribute('aria-pressed', String(optionIndex === index));
    button.textContent = `${optionIndex === 0 ? 'Shortest' : `Alternative ${optionIndex + 1}`} · ${formatDistance(option.distance)}`;
    const duration = document.createElement('small');
    duration.textContent = `about ${formatDuration(option.duration)}`;
    button.appendChild(duration);
    button.addEventListener('click', () => selectRouteOption(optionIndex));
    els.routeChoiceList.appendChild(button);
  });
  const travelMode = route.profile === 'foot' ? 'Walking' : 'Driving';
  els.routeOverview.textContent = `${travelMode} · ${formatDistance(route.distance)} · about ${formatDuration(route.duration)} · sorted by shortest distance`;
  els.routeSummary.hidden = false;
  els.routeGuidance.hidden = false;
  els.routeProgress.value = 0;
  els.routeProgressLabel.textContent = '0%';
  els.routeRemaining.textContent = formatDistance(route.distance);
  els.routeArrival.textContent = new Date(Date.now() + route.duration * 1000)
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  els.nextManeuver.textContent = route.steps.length
    ? maneuverText(route.steps[0])
    : 'Start navigation to follow this route';
  renderTurnList();
  els.turnList.querySelector('[data-step-index="0"]')?.classList.add('is-next');
  updateRouteProgress(
    state.latestNavigation?.latitude,
    state.latestNavigation?.longitude,
  );
  setNavigationControls();
}

function distanceBetween(pointA, pointB) {
  const latitudeA = pointA[0] * Math.PI / 180;
  const latitudeB = pointB[0] * Math.PI / 180;
  const latitudeDelta = latitudeB - latitudeA;
  const longitudeDelta = (pointB[1] - pointA[1]) * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

function updateRouteProgress(latitude = null, longitude = null) {
  if (!state.route || !state.navigationActive) return;
  const positionMode = state.latestNavigation?.navigation_mode;
  if (
    (positionMode && positionMode !== 'GPS' && positionMode !== 'DEAD_RECKONING')
    || latitude === null
    || latitude === undefined
    || longitude === null
    || longitude === undefined
    || !isCoordinate(Number(latitude), Number(longitude))
  ) {
    els.nextManeuver.textContent = 'Position unavailable';
    els.routeRemaining.textContent = '--';
    els.routeArrival.textContent = '--';
    return;
  }
  let nearestDistance = Infinity;
  let nearestAlong = 0;
  for (let index = 1; index < state.route.geometry.length; index += 1) {
    const start = state.route.geometry[index - 1];
    const end = state.route.geometry[index];
    const latitudeScale = EARTH_RADIUS_METERS * Math.PI / 180;
    const longitudeScale = latitudeScale * Math.cos(Number(latitude) * Math.PI / 180);
    const startX = start[1] * longitudeScale;
    const startY = start[0] * latitudeScale;
    const endX = end[1] * longitudeScale;
    const endY = end[0] * latitudeScale;
    const pointX = Number(longitude) * longitudeScale;
    const pointY = Number(latitude) * latitudeScale;
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
    const fraction = segmentLengthSquared
      ? Math.max(0, Math.min(1, ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / segmentLengthSquared))
      : 0;
    const projected = [
      start[0] + (end[0] - start[0]) * fraction,
      start[1] + (end[1] - start[1]) * fraction,
    ];
    const distance = distanceBetween([Number(latitude), Number(longitude)], projected);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      const segmentDistance = state.route.pathCumulative[index] - state.route.pathCumulative[index - 1];
      nearestAlong = state.route.pathCumulative[index - 1] + segmentDistance * fraction;
    }
  }
  if (nearestDistance > 100) {
    els.nextManeuver.textContent = `Off route · ${formatDistance(nearestDistance)} from route`;
    return;
  }
  state.routeProgressMeters = Math.max(state.routeProgressMeters, nearestAlong);
  const routeFraction = state.route.pathDistance
    ? Math.max(0, Math.min(1, state.routeProgressMeters / state.route.pathDistance))
    : 0;
  const progressDistance = routeFraction * state.route.distance;
  const remaining = Math.max(0, state.route.distance - progressDistance);
  const progressPercent = Math.round(routeFraction * 100);
  const nextStep = state.route.steps.find((step) => step.cumulativeDistance > progressDistance + 5);
  els.routeProgress.value = progressPercent;
  els.routeProgressLabel.textContent = `${progressPercent}%`;
  els.routeRemaining.textContent = formatDistance(remaining);
  els.nextManeuver.textContent = nextStep ? maneuverText(nextStep) : 'Arrive at destination';
  const secondsRemaining = state.route.distance > 0
    ? state.route.duration * remaining / state.route.distance
    : 0;
  els.routeArrival.textContent = new Date(Date.now() + secondsRemaining * 1000)
    .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  for (const item of els.turnList.querySelectorAll('[data-step-index]')) {
    item.classList.toggle('is-next', Number(item.dataset.stepIndex) === state.route.steps.indexOf(nextStep));
  }
  if (state.followLocation && state.map) state.map.panTo([latitude, longitude], { animate: false });
}

function setNavigationControls() {
  els.startNavigationButton.disabled = !state.route || state.navigationActive || state.navigationPaused;
  els.pauseNavigationButton.disabled = !state.navigationActive || state.navigationPaused;
  els.resumeNavigationButton.disabled = !state.navigationActive || !state.navigationPaused;
  els.stopNavigationButton.disabled = !state.navigationActive && !state.navigationPaused;
  els.simulateRouteButton.disabled = !state.route
    || state.busy
    || (state.mode === 'DEMO' && state.running);
  for (const choice of els.routeChoiceList.querySelectorAll('.route-choice')) {
    choice.disabled = state.navigationActive || state.navigationPaused
      || (state.mode === 'DEMO' && state.running && state.simulation.followRoute);
  }
  els.followLocationButton.setAttribute('aria-pressed', String(state.followLocation));
  els.followLocationButton.textContent = `FOLLOW LOCATION: ${state.followLocation ? 'ON' : 'OFF'}`;
}

function startNavigation() {
  if (!state.route || state.navigationActive || state.navigationPaused) return;
  state.navigationActive = true;
  state.navigationPaused = false;
  state.followLocation = true;
  els.mapElement.closest('.map-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setNavigationControls();
  updateRouteProgress(
    state.latestNavigation?.latitude,
    state.latestNavigation?.longitude,
  );
  const positionMode = state.latestNavigation?.navigation_mode;
  if (state.map && state.latestNavigation
    && (positionMode === 'GPS' || positionMode === 'DEAD_RECKONING')
    && isCoordinate(
    Number(state.latestNavigation.latitude),
    Number(state.latestNavigation.longitude),
  )) {
    state.map.panTo([
      Number(state.latestNavigation.latitude),
      Number(state.latestNavigation.longitude),
    ], { animate: false });
  }
  setRouteMessage('Navigation guidance is active for the latest backend position.');
}

function pauseNavigation() {
  if (!state.navigationActive) return;
  state.navigationPaused = true;
  state.navigationActive = false;
  setNavigationControls();
  setRouteMessage('Route guidance paused. Backend tracking continues.');
}

function resumeNavigation() {
  if (!state.route || !state.navigationPaused) return;
  state.navigationPaused = false;
  state.navigationActive = true;
  setNavigationControls();
  setRouteMessage('Route guidance resumed.');
}

function stopNavigation() {
  state.navigationActive = false;
  state.navigationPaused = false;
  state.followLocation = false;
  setNavigationControls();
  setRouteMessage('Route guidance stopped. Backend tracking continues.');
}

function recordModeTransition(mode) {
  if (!state.lastNavigationMode) {
    state.lastNavigationMode = mode;
    return;
  }
  if (mode === state.lastNavigationMode) return;
  state.transitionHistory.push({
    timestamp: new Date().toISOString(),
    from: state.lastNavigationMode,
    to: mode,
    source: state.mode,
  });
  state.lastNavigationMode = mode;
  els.transitionCount.textContent = String(state.transitionHistory.length);
}

function saveSimulationSession() {
  if (!state.truthPositions.length && !state.positions.length) return;
  const session = {
    id: `${Date.now()}-${storedSessions.length}`,
    started_at: state.sessionStartedAt || new Date().toISOString(),
    ended_at: new Date().toISOString(),
    positions: state.positions.slice(-1200),
    ground_truth: state.truthPositions.slice(-1200),
    transitions: state.transitionHistory,
    error_history: state.errorHistory.slice(-1200),
    simulated: true,
  };
  storedSessions.unshift(session);
  storedSessions.splice(10);
  persistLocalList(SAVED_SESSIONS_KEY, storedSessions);
  renderSavedSessions();
}

function renderSavedSessions() {
  els.savedSessionsList.replaceChildren();
  if (!storedSessions.length) {
    els.savedSessionsList.textContent = 'No saved sessions on this device.';
    return;
  }
  for (const session of storedSessions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'recent-item';
    button.textContent = `${new Date(session.started_at).toLocaleString()} · ${session.positions.length} estimates`;
    button.title = 'Replay this saved simulation path';
    button.addEventListener('click', () => replaySession(session));
    els.savedSessionsList.appendChild(button);
  }
}

function replaySession(session) {
  state.mode = 'DEMO';
  state.running = false;
  state.demoPaused = false;
  state.navigationActive = false;
  state.navigationPaused = false;
  state.followLocation = false;
  clearModeDisplay();
  state.positions = Array.isArray(session.positions) ? session.positions : [];
  state.truthPositions = Array.isArray(session.ground_truth) ? session.ground_truth : [];
  state.transitionHistory = Array.isArray(session.transitions) ? session.transitions : [];
  state.errorHistory = Array.isArray(session.error_history) ? session.error_history : [];
  state.latestNavigation = null;
  state.latestSample = null;
  els.transitionCount.textContent = String(state.transitionHistory.length);
  els.simulationError.textContent = state.errorHistory.length
    ? `${Number(state.errorHistory[state.errorHistory.length - 1].meters).toFixed(1)} m`
    : 'Unavailable';
  const latestTruth = state.truthPositions[state.truthPositions.length - 1];
  els.simulationGroundTruth.textContent = latestTruth
    ? `${Number(latestTruth.latitude).toFixed(6)}, ${Number(latestTruth.longitude).toFixed(6)} · SIM ONLY`
    : '--';
  renderSensorSample(null);
  updateModeControls();
  if (state.map) {
    state.gpsLine.setLatLngs(state.positions.filter((point) => point.gpsAvailable).map((point) => [point.latitude, point.longitude]));
    state.drLine.setLatLngs(state.positions.filter((point) => !point.gpsAvailable).map((point) => [point.latitude, point.longitude]));
    state.truthLine.setLatLngs(state.truthPositions.map((point) => [point.latitude, point.longitude]));
    const last = state.positions[state.positions.length - 1];
    if (last) state.map.setView([last.latitude, last.longitude], 16);
    state.mapHasCenteredOnPosition = Boolean(last);
  }
  els.pathCount.textContent = `${state.positions.length} replayed positions`;
  els.mapCaption.textContent = 'Saved simulation replay · ground truth is simulation-only';
  drawSimulationErrorChart();
  updateModeControls();
  setRouteMessage('Saved simulation loaded for replay. It does not update backend navigation.');
}

function format(value, digits = 4) {
  return numberValue(value, 'numeric field').toFixed(digits);
}

function mpsToKmh(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue * 3.6 : null;
}

function renderSensorSample(sample) {
  const sampleAvailable = sample && typeof sample === 'object';
  state.latestSample = sampleAvailable ? sample : null;
  const source = state.mode === 'DEMO'
    ? 'SIMULATED'
    : sample?.source === 'demo' ? 'SIMULATED FEED' : sample?.source === 'real' ? 'REAL PHONE' : 'SOURCE UNKNOWN';
  const readings = sampleAvailable ? sample : {};
  const sampleTimestamp = sampleAvailable ? Number(sample.timestamp) : NaN;
  const sampleAge = Number.isFinite(sampleTimestamp) ? Date.now() / 1000 - sampleTimestamp : NaN;
  const sampleIsStale = !Number.isFinite(sampleAge)
    || sampleAge > MAX_SENSOR_SAMPLE_AGE_SECONDS
    || sampleAge < -5;
  const readingSource = sampleAvailable
    ? `${source}${sampleIsStale ? ' · STALE' : ''}`
    : 'NO SAMPLE';
  els.accelSource.textContent = readingSource;
  els.gyroSource.textContent = readingSource;
  els.accelSource.classList.toggle('is-stale', sampleIsStale);
  els.gyroSource.classList.toggle('is-stale', sampleIsStale);
  els.accelX.textContent = displayReading(readings.accel_x);
  els.accelY.textContent = displayReading(readings.accel_y);
  els.accelZ.textContent = displayReading(readings.accel_z);
  els.gyroAlpha.textContent = displayReading(readings.gyro_alpha);
  els.gyroBeta.textContent = displayReading(readings.gyro_beta);
  els.gyroGamma.textContent = displayReading(readings.gyro_gamma);

  const hasGps = sampleAvailable
    && readings.latitude !== null
    && readings.latitude !== undefined
    && readings.longitude !== null
    && readings.longitude !== undefined
    && Number.isFinite(Number(readings.latitude))
    && Number.isFinite(Number(readings.longitude));
  if (hasGps) {
    state.latitude = Number(readings.latitude);
    state.longitude = Number(readings.longitude);
  }
  updateReliability();
}

function renderNavigation(data, addPosition = false) {
  if (!data || typeof data !== 'object' || typeof data.gps_available !== 'boolean') {
    throw new Error('Backend navigation response is invalid.');
  }
  const gpsAvailable = data.gps_available;
  const mode = String(data.navigation_mode || (gpsAvailable ? 'GPS' : 'DEAD_RECKONING'));
  const hasPosition = mode !== 'WAITING_FOR_GPS';
  const estimateAvailable = mode === 'GPS' || mode === 'DEAD_RECKONING';
  const latitude = hasPosition ? numberValue(data.latitude, 'latitude') : null;
  const longitude = hasPosition ? numberValue(data.longitude, 'longitude') : null;
  const speed = estimateAvailable ? numberValue(data.speed, 'speed') : null;
  const speedKmh = speed !== null ? mpsToKmh(speed) : null;
  const headingRadians = estimateAvailable ? numberValue(data.heading, 'heading') : null;
  state.latestNavigation = { ...data };
  updateNearbyLocationStatus();
  recordModeTransition(mode);

  els.latValue.textContent = hasPosition ? format(latitude, 6) : '--';
  els.lonValue.textContent = hasPosition ? format(longitude, 6) : '--';
  els.mapLat.textContent = hasPosition ? format(latitude, 6) : '--';
  els.mapLon.textContent = hasPosition ? format(longitude, 6) : '--';
  els.speedValue.innerHTML = speedKmh !== null ? `${format(speedKmh, 1)} <small>km/h</small>` : '-- <small>km/h</small>';
  els.headingValue.innerHTML = headingRadians !== null
    ? `${format((headingRadians * 180 / Math.PI + 360) % 360, 1)} <small>°</small>`
    : '-- <small>°</small>';
  els.gpsStatus.textContent = gpsAvailable ? 'GPS AVAILABLE' : mode === 'WAITING_FOR_GPS' ? 'WAITING FOR GPS' : 'GPS LOST';
  els.gpsStatus.classList.toggle('is-lost', !gpsAvailable);
  els.gpsStatusSide.textContent = gpsAvailable ? 'GPS AVAILABLE' : mode === 'WAITING_FOR_GPS' ? 'WAITING FOR GPS' : 'GPS LOST';
  els.gpsStatusSide.className = `value-state ${gpsAvailable ? 'is-good' : 'is-warning'}`;
  els.navMode.textContent = mode.replaceAll('_', ' ');
  els.navMode.classList.toggle('is-dr', mode === 'DEAD_RECKONING');
  els.navMode.classList.toggle('is-unavailable', mode === 'DEAD_RECKONING_UNAVAILABLE');
  els.modeValue.textContent = mode.replaceAll('_', ' ');
  els.modeValue.className = `value-state ${gpsAvailable ? 'is-good' : mode === 'DEAD_RECKONING_UNAVAILABLE' ? 'is-bad' : 'is-warning'}`;
  els.timeGpsValue.textContent = `${format(data.time_since_last_gps, 1)} s`;
  els.distanceGpsValue.textContent = `${format(data.distance_since_last_gps, 1)} m`;
  const positionDescription = mode === 'DEAD_RECKONING_UNAVAILABLE'
    ? 'Last GPS fix · reference only'
    : mode === 'DEAD_RECKONING'
      ? 'Bounded estimate · reacquire GPS'
      : gpsAvailable
        ? state.mode === 'DEMO' ? 'Simulated GPS position' : 'GPS-confirmed position'
        : 'No valid GPS position';
  els.positionQuality.textContent = positionDescription;
  els.positionQualitySecondary.textContent = positionDescription;
  els.mapCaption.textContent = mode === 'DEAD_RECKONING_UNAVAILABLE'
    ? 'Position estimate unavailable; retained coordinate is the last GPS fix only'
    : mode === 'WAITING_FOR_GPS'
      ? 'Waiting for the first valid GPS position'
      : gpsAvailable
        ? state.mode === 'DEMO' ? 'Simulated GPS fix (demo only)' : 'Position confirmed by a valid GPS fix'
        : 'Dashed track is a bounded backend estimate, not a precise route';
  els.liveStatus.textContent = data.status || 'Backend state received';
  const isPaused = state.mode === 'DEMO' && state.demoPaused;
  els.navigationStatus.querySelector('span').textContent = isPaused
    ? 'PAUSED'
    : state.running ? 'RUNNING' : 'MONITORING';
  els.navigationStatus.classList.toggle('is-running', state.running && !isPaused);

  const moved = hasPosition && (
    !state.lastRenderedPosition
    || Math.abs(latitude - state.lastRenderedPosition.latitude) > 0.00000001
    || Math.abs(longitude - state.lastRenderedPosition.longitude) > 0.00000001
    || gpsAvailable !== state.lastRenderedPosition.gpsAvailable
  );
  if (addPosition && moved && estimateAvailable) {
    addTrackPosition(latitude, longitude, gpsAvailable);
    state.lastRenderedPosition = { latitude, longitude, gpsAvailable };
  }
  if (state.navigationActive) {
    updateRouteProgress(estimateAvailable ? latitude : null, estimateAvailable ? longitude : null);
  }
  if (state.mode === 'DEMO' && hasPosition) {
    updateSimulationDiagnostics(data);
  }
  updateReliability();
}

function addTrackPosition(latitude, longitude, gpsAvailable) {
  state.positions.push({ latitude, longitude, gpsAvailable });
  if (state.positions.length > 1500) state.positions.shift();
  els.pathCount.textContent = `${state.positions.length} received position${state.positions.length === 1 ? '' : 's'}`;
  els.mapCaption.textContent = gpsAvailable
    ? 'Position confirmed by the selected data source'
    : 'Dashed track is estimated by backend dead reckoning';

  if (state.map) {
    const point = [latitude, longitude];
    const gpsPoints = state.positions.filter((position) => position.gpsAvailable)
      .map((position) => [position.latitude, position.longitude]);
    const drPoints = state.positions.filter((position) => !position.gpsAvailable)
      .map((position) => [position.latitude, position.longitude]);
    state.gpsLine.setLatLngs(gpsPoints);
    state.drLine.setLatLngs(drPoints);
    if (!state.positionMarker) {
      state.positionMarker = L.marker(point, {
        icon: L.divIcon({ className: 'position-marker', iconSize: [17, 17], iconAnchor: [8, 8] }),
      }).addTo(state.map);
    } else {
      state.positionMarker.setLatLng(point);
    }
    state.positionMarker.setIcon(L.divIcon({
      className: `position-marker ${gpsAvailable ? 'is-gps' : ''}`,
      iconSize: [17, 17],
      iconAnchor: [8, 8],
    }));
    if (gpsAvailable) {
      if (!state.gpsMarker) {
        state.gpsMarker = L.circleMarker(point, {
          radius: 6,
          color: '#101816',
          weight: 2,
          fillColor: '#68c9b2',
          fillOpacity: 1,
        }).addTo(state.map);
      } else {
        state.gpsMarker.setLatLng(point);
      }
    }
    if (!state.mapHasCenteredOnPosition) {
      state.map.setView(point, 16, { animate: false });
      state.mapHasCenteredOnPosition = true;
    }
    if (state.followLocation || (state.mode === 'DEMO' && state.running)) {
      state.map.panTo(point, { animate: false });
    }
  } else if (state.fallbackInitialized) {
    renderFallbackTrack();
  }
}

function renderFallbackTrack() {
  if (!state.positions.length) return;
  els.fallbackGpsPoint.removeAttribute('hidden');
  els.fallbackPosition.removeAttribute('hidden');
  els.fallbackLabel.removeAttribute('hidden');
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
  const pathData = (points) => points
    .map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`)
    .join(' ');
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

function updateSimulationDiagnostics(navigation) {
  const latitude = state.simulation.truthLatitude;
  const longitude = state.simulation.truthLongitude;
  if (!isCoordinate(latitude, longitude)) return;
  els.simulationGroundTruth.textContent = `${latitude.toFixed(6)}, ${longitude.toFixed(6)} · SIM ONLY`;
  if (navigation.gps_available) {
    els.simulationOutageTime.textContent = '0.0 s';
  } else {
    els.simulationOutageTime.textContent = `${formatAge(Math.max(0, Number(navigation.time_since_last_gps) || 0))}`;
  }
  const hasEstimate = navigation.navigation_mode === 'GPS'
    || navigation.navigation_mode === 'DEAD_RECKONING';
  if (!hasEstimate || !isCoordinate(Number(navigation.latitude), Number(navigation.longitude))) {
    els.simulationError.textContent = 'Unavailable';
    return;
  }
  const errorMeters = distanceBetween(
    [latitude, longitude],
    [Number(navigation.latitude), Number(navigation.longitude)],
  );
  els.simulationError.textContent = `${errorMeters.toFixed(1)} m`;
  state.errorHistory.push({ timestamp: Date.now(), meters: errorMeters });
  if (state.errorHistory.length > 300) state.errorHistory.shift();
  drawSimulationErrorChart();
}

function drawSimulationErrorChart() {
  const canvas = els.simulationErrorChart;
  if (!canvas) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.strokeStyle = '#dce3eb';
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(30, 8);
  context.lineTo(30, height - 20);
  context.lineTo(width - 8, height - 20);
  context.stroke();
  if (state.errorHistory.length < 2) {
    context.fillStyle = '#7d8b9b';
    context.font = '10px sans-serif';
    context.fillText('Error history appears as simulation runs.', 38, Math.max(22, height / 2));
    return;
  }
  const maximum = Math.max(1, ...state.errorHistory.map((sample) => sample.meters));
  const chartWidth = width - 44;
  const chartHeight = height - 34;
  context.strokeStyle = '#7556c7';
  context.lineWidth = 2;
  context.beginPath();
  state.errorHistory.forEach((sample, index) => {
    const x = 32 + index / (state.errorHistory.length - 1) * chartWidth;
    const y = height - 22 - sample.meters / maximum * chartHeight;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.fillStyle = '#607083';
  context.font = '9px monospace';
  context.fillText(`${maximum.toFixed(1)} m`, 3, 12);
  context.fillText('0', 14, height - 21);
}

function updateReliability() {
  if (!els.reliabilityStatus) return;

  const navigation = state.latestNavigation;
  const mode = navigation?.navigation_mode || 'WAITING_FOR_GPS';
  const backendUnavailable = state.backendStatus === 'is-disconnected' || state.backendStatus === 'is-error';
  const backendPending = state.backendStatus === 'is-pending';
  let level = 'is-pending';
  let label = 'CHECKING';
  let detail = 'Waiting for backend navigation and sensor status.';
  if (backendUnavailable) {
    level = 'is-bad';
    label = 'BACKEND OFFLINE';
    detail = state.lastError
      ? `No live navigation updates. ${state.lastError} Previously displayed values are not current.`
      : 'No live navigation updates. Previously displayed values are not current until the backend reconnects.';
    els.speedValue.innerHTML = '-- <small>km/h</small>';
    els.headingValue.innerHTML = '-- <small>°</small>';
    els.positionQuality.textContent = 'Last received value · backend offline';
    els.positionQualitySecondary.textContent = 'Last received value · backend offline';
    els.gpsStatus.textContent = 'BACKEND OFFLINE';
    els.gpsStatusSide.textContent = 'BACKEND OFFLINE';
    els.gpsStatusSide.className = 'value-state is-bad';
    els.navMode.textContent = 'STALE';
    els.navMode.classList.remove('is-dr', 'is-unavailable');
    els.modeValue.textContent = 'BACKEND OFFLINE';
    els.modeValue.className = 'value-state is-bad';
    els.mapCaption.textContent = 'Backend offline · displayed track and position are cached, not live';
  } else if (backendPending) {
    level = 'is-pending';
    label = 'CHECKING';
    detail = 'Checking backend connectivity before showing navigation as live.';
  } else if (!navigation) {
    level = 'is-pending';
    label = 'WAITING';
    detail = 'Backend is reachable; waiting for its first navigation response.';
  } else if (mode === 'DEAD_RECKONING_UNAVAILABLE') {
    level = 'is-bad';
    label = 'POSITION UNAVAILABLE';
    detail = `${navigation.status || 'No reliable movement estimate is available.'} The coordinates above are the retained last GPS fix, not a current position estimate.`;
  } else if (mode === 'DEAD_RECKONING') {
    level = 'is-warning';
    label = 'BOUNDED ESTIMATE';
    detail = 'GPS is unavailable. The backend is returning a short, bounded projection from recent GPS-derived motion; it is not a precise route. Reacquire GPS for position recovery.';
  } else if (mode === 'WAITING_FOR_GPS') {
    level = 'is-warning';
    label = 'WAITING FOR GPS';
    detail = 'No valid GPS position has been received. The system will not invent coordinates or infer speed and heading from raw IMU readings.';
  } else if (state.mode === 'DEMO') {
    level = 'is-warning';
    label = 'SIMULATED';
    detail = 'Demo data is isolated from real phone measurements and is only for demonstrating the dashboard flow.';
  } else {
    level = 'is-good';
    label = 'GPS POSITION';
    detail = 'The backend is synchronized to a fresh valid GPS position. Dead reckoning is only used after GPS becomes unavailable.';
  }
  els.reliabilityStatus.className = `reliability-status ${level}`;
  els.reliabilityStatus.textContent = label;
  els.reliabilityDetail.textContent = detail;

  const sample = state.latestSample;
  const sampleMatchesMode = sample
    && (state.mode === 'DEMO' ? sample.source === 'demo' : sample.source === 'real');
  const sampleTimestamp = sampleMatchesMode ? Number(sample.timestamp) : NaN;
  const sampleAge = Date.now() / 1000 - sampleTimestamp;
  if (!sampleMatchesMode || !Number.isFinite(sampleAge)) {
    els.sensorFreshness.textContent = 'No sample';
    els.sensorFreshness.className = 'is-warning';
    els.streamIndicator.lastChild.textContent = 'NO DATA';
    els.streamIndicator.className = 'stream-indicator is-warning';
  } else if (sampleAge < -5) {
    els.sensorFreshness.textContent = 'Clock mismatch';
    els.sensorFreshness.className = 'is-warning';
    els.streamIndicator.lastChild.textContent = 'CLOCK MISMATCH';
    els.streamIndicator.className = 'stream-indicator is-warning';
  } else if (sampleAge > MAX_SENSOR_SAMPLE_AGE_SECONDS) {
    els.sensorFreshness.textContent = `Stale · ${formatAge(sampleAge)} old`;
    els.sensorFreshness.className = 'is-bad';
    els.streamIndicator.lastChild.textContent = 'STALE';
    els.streamIndicator.className = 'stream-indicator is-bad';
  } else {
    const ageText = formatAge(Math.max(0, sampleAge));
    els.sensorFreshness.textContent = state.mode === 'DEMO'
      ? `Simulated · ${ageText} old`
      : `${state.backendConnected ? 'Live' : 'Recent'} · ${ageText} old`;
    els.sensorFreshness.className = state.mode === 'DEMO' || !state.backendConnected ? 'is-warning' : 'is-good';
    els.streamIndicator.lastChild.textContent = backendUnavailable
      ? 'BACKEND OFFLINE'
      : backendPending ? 'CHECKING'
      : state.mode === 'DEMO' ? 'SIMULATED' : 'LIVE';
    els.streamIndicator.className = `stream-indicator ${backendUnavailable ? 'is-bad' : backendPending || state.mode === 'DEMO' ? 'is-warning' : ''}`;
  }
  if (backendUnavailable) {
    els.streamIndicator.lastChild.textContent = 'BACKEND OFFLINE';
    els.streamIndicator.className = 'stream-indicator is-bad';
  } else if (backendPending) {
    els.streamIndicator.lastChild.textContent = 'CHECKING';
    els.streamIndicator.className = 'stream-indicator is-warning';
  }

  if (!navigation) {
    els.gpsQuality.textContent = 'Not available';
    els.gpsQuality.className = 'is-warning';
    return;
  }

  const accuracy = sampleMatchesMode && sample.gps_accuracy !== null && sample.gps_accuracy !== undefined
    ? Number(sample.gps_accuracy)
    : NaN;
  if (backendUnavailable) {
    els.gpsQuality.textContent = Number.isFinite(accuracy)
      ? `Cached · last reported ±${accuracy.toFixed(1)} m`
      : 'Cached · not a live GPS status';
    els.gpsQuality.className = 'is-warning';
  } else if (!navigation.gps_available) {
    els.gpsQuality.textContent = mode === 'WAITING_FOR_GPS'
      ? 'No valid fix'
      : Number.isFinite(accuracy) ? `GPS lost · last reported ±${accuracy.toFixed(1)} m` : 'GPS lost';
    els.gpsQuality.className = 'is-warning';
  } else if (Number.isFinite(accuracy)) {
    els.gpsQuality.textContent = `${state.mode === 'DEMO' ? 'Simulated · ' : ''}±${accuracy.toFixed(1)} m reported`;
    els.gpsQuality.className = state.mode === 'DEMO' ? 'is-warning' : accuracy <= 15 ? 'is-good' : 'is-warning';
  } else {
    els.gpsQuality.textContent = 'GPS active · accuracy not reported';
    els.gpsQuality.className = 'is-warning';
  }
}

function updateModeControls() {
  const isDemo = state.mode === 'DEMO';
  els.realModeButton.classList.toggle('is-selected', !isDemo);
  els.demoModeButton.classList.toggle('is-selected', isDemo);
  els.realModeButton.setAttribute('aria-pressed', String(!isDemo));
  els.demoModeButton.setAttribute('aria-pressed', String(isDemo));
  els.sourceLabel.textContent = isDemo ? 'DEMO MODE · SIMULATED' : 'REAL SENSOR MODE';
  els.demoBanner.hidden = !isDemo;
  els.modeDescription.textContent = isDemo
    ? 'Simulated samples use an isolated backend demo state and never replace real phone samples.'
    : 'Reading real phone measurements received by FastAPI. Open the Phone Sensor Hub on Android to connect a device.';
  els.startButton.lastChild.textContent = state.route
    ? 'START DEMO · FOLLOW ROUTE'
    : 'START DEMO';
  els.startButton.title = state.route
    ? 'Simulate motion along the selected route using isolated demo data.'
    : 'Start the configured laptop-only motion demo.';
  els.startButton.disabled = !isDemo || state.running || state.busy;
  for (const control of els.simulationControls.querySelectorAll('input, select')) {
    control.disabled = state.running;
  }
  els.pauseDemoButton.disabled = !isDemo || !state.running || state.demoPaused;
  els.resumeDemoButton.disabled = !isDemo || !state.running || !state.demoPaused;
  els.gpsLossButton.disabled = !isDemo || !state.running || !state.gpsAvailable;
  els.gpsRestoreButton.disabled = !isDemo || !state.running || state.gpsAvailable;
}

function setMode(mode) {
  if (state.mode === 'DEMO' && state.running) saveSimulationSession();
  state.mode = mode;
  state.running = false;
  state.demoPaused = false;
  state.gpsAvailable = mode === 'REAL';
  state.navigationActive = false;
  state.navigationPaused = false;
  state.followLocation = false;
  clearModeDisplay();
  updateModeControls();
  setNavigationControls();
  clearError();
  if (mode === 'REAL') {
    refreshRealSensorMode();
    return;
  }

  renderSensorSample(null);
  requestJson('/navigation/real-time?source=demo')
    .then((navigation) => {
      if (state.mode === 'DEMO' && !state.running) {
        setBackendStatus('is-connected');
        clearError();
        renderNavigation(navigation, true);
      }
    })
    .catch((error) => {
      if (state.mode === 'DEMO') showError(error.message);
    });
}

function advanceDemoPosition(dt) {
  state.frame += 1;
  const pattern = state.simulation.pattern;
  if (state.simulation.followRoute && state.route) {
    const routeLength = state.route.pathDistance;
    const selectedSpeedCap = state.simulation.speed;
    const requestedSpeed = selectedSpeedCap * state.simulation.speedMultiplier;
    const routeSpeed = routeSpeedAtDistance(
      state.route,
      state.simulation.routeDistanceMeters,
    );
    state.speed = state.simulation.routeComplete
      ? 0
      : Math.min(
        MAX_DEMO_SPEED_METERS_PER_SECOND,
        selectedSpeedCap,
        requestedSpeed,
        routeSpeed ?? selectedSpeedCap,
      );
    state.simulation.routeDistanceMeters = Math.min(
      routeLength,
      state.simulation.routeDistanceMeters + state.speed * dt,
    );
    if (state.simulation.routeDistanceMeters >= routeLength) {
      state.simulation.routeComplete = true;
      state.speed = 0;
    }
    const routePosition = positionOnRoute(
      state.route,
      state.simulation.routeDistanceMeters,
    );
    state.latitude = routePosition.latitude;
    state.longitude = routePosition.longitude;
    state.headingDegrees = routePosition.heading;
    state.simulation.groundTruthHeading = routePosition.heading;
  } else if (pattern === 'LEFT_TURN') {
    state.simulation.groundTruthHeading = (state.simulation.groundTruthHeading - 30 * dt * state.simulation.speedMultiplier + 360) % 360;
  } else if (pattern === 'RIGHT_TURN') {
    state.simulation.groundTruthHeading = (state.simulation.groundTruthHeading + 30 * dt * state.simulation.speedMultiplier) % 360;
  }
  if (!state.simulation.followRoute) {
    const speedVariation = pattern === 'SPEED_CHANGE'
      ? 0.5 + 0.5 * Math.sin(state.frame / 9)
      : 1;
    state.speed = pattern === 'STOP'
      ? 0
      : Math.min(
        MAX_DEMO_SPEED_METERS_PER_SECOND,
        state.simulation.speed,
        state.simulation.speed * speedVariation * state.simulation.speedMultiplier,
      );
    state.headingDegrees = (state.simulation.groundTruthHeading + 360) % 360;
    if (state.latitude === null || state.longitude === null) return;
    const distance = state.speed * dt;
    const headingRadians = state.simulation.groundTruthHeading * Math.PI / 180;
    const north = distance * Math.cos(headingRadians);
    const east = distance * Math.sin(headingRadians);
    const latitudeRadians = state.latitude * Math.PI / 180;
    state.latitude += north / EARTH_RADIUS_METERS * 180 / Math.PI;
    state.longitude += east / (EARTH_RADIUS_METERS * Math.max(Math.cos(latitudeRadians), 0.01)) * 180 / Math.PI;
  }
  state.simulation.truthLatitude = state.latitude;
  state.simulation.truthLongitude = state.longitude;
  const lastTruthPoint = state.truthPositions[state.truthPositions.length - 1];
  if (
    !lastTruthPoint
    || Math.abs(lastTruthPoint.latitude - state.latitude) > 0.00000001
    || Math.abs(lastTruthPoint.longitude - state.longitude) > 0.00000001
  ) {
    state.truthPositions.push({
      latitude: state.latitude,
      longitude: state.longitude,
      timestamp: Date.now(),
    });
    if (state.truthPositions.length > 1200) state.truthPositions.shift();
  }
  if (state.map) {
    state.truthLine.setLatLngs(state.truthPositions.map((point) => [point.latitude, point.longitude]));
    if (!state.truthMarker) {
      state.truthMarker = L.circleMarker([state.latitude, state.longitude], {
        radius: 6,
        color: '#fff',
        weight: 2,
        fillColor: '#7556c7',
        fillOpacity: 1,
      }).addTo(state.map).bindTooltip('Ground truth · simulation only');
    } else {
      state.truthMarker.setLatLng([state.latitude, state.longitude]);
    }
  }
  if (state.simulation.followRoute && state.simulation.routeComplete) {
    els.liveStatus.textContent = 'Route simulation reached its destination.';
    updateRouteProgress(state.latitude, state.longitude);
  }
}

function positionOnRoute(route, distanceMeters) {
  let low = 0;
  let high = route.pathCumulative.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (route.pathCumulative[middle] < distanceMeters) low = middle + 1;
    else high = middle;
  }
  const endIndex = Math.max(1, low);
  const start = route.geometry[endIndex - 1];
  const end = route.geometry[endIndex];
  const startDistance = route.pathCumulative[endIndex - 1];
  const segmentDistance = route.pathCumulative[endIndex] - startDistance;
  const fraction = segmentDistance > 0
    ? Math.max(0, Math.min(1, (distanceMeters - startDistance) / segmentDistance))
    : 0;
  const latitude = start[0] + (end[0] - start[0]) * fraction;
  const longitude = start[1] + (end[1] - start[1]) * fraction;
  const latitudeStart = start[0] * Math.PI / 180;
  const latitudeEnd = end[0] * Math.PI / 180;
  const longitudeDelta = (end[1] - start[1]) * Math.PI / 180;
  const heading = (
    Math.atan2(
      Math.sin(longitudeDelta) * Math.cos(latitudeEnd),
      Math.cos(latitudeStart) * Math.sin(latitudeEnd)
        - Math.sin(latitudeStart) * Math.cos(latitudeEnd) * Math.cos(longitudeDelta),
    ) * 180 / Math.PI + 360
  ) % 360;
  return { latitude, longitude, heading };
}

function routeSpeedAtDistance(route, distanceMeters) {
  const segment = route.speedSegments?.find((item) => distanceMeters < item.endDistance)
    || route.speedSegments?.[route.speedSegments.length - 1];
  return segment && Number.isFinite(segment.speedMetersPerSecond)
    ? segment.speedMetersPerSecond
    : null;
}

function createDemoSample(timestamp, dt) {
  advanceDemoPosition(dt);
  const frame = state.frame;
  const speedNoise = state.simulation.speedNoise * Math.sin(frame * 0.73);
  const measuredSpeed = Math.max(
    0,
    Math.min(MAX_DEMO_SPEED_METERS_PER_SECOND, state.speed + speedNoise),
  );
  const measuredHeading = (state.simulation.groundTruthHeading + state.simulation.headingError + 360) % 360;
  return {
    timestamp,
    source: 'demo',
    gps_timestamp: state.gpsAvailable ? timestamp : state.gpsTimestamp,
    latitude: state.gpsAvailable ? state.latitude : null,
    longitude: state.gpsAvailable ? state.longitude : null,
    gps_accuracy: state.gpsAvailable ? 4.0 : null,
    gps_speed: measuredSpeed,
    gps_heading: measuredHeading,
    gps_available: state.gpsAvailable,
    accel_x: 0.15 + 0.08 * Math.sin(frame / 5),
    accel_y: 0.05 + 0.06 * Math.cos(frame / 7),
    accel_z: 9.81 + 0.12 * Math.sin(frame / 9),
    gyro_alpha: 1.8 * Math.sin(frame / 8),
    gyro_beta: 1.2 * Math.cos(frame / 11),
    gyro_gamma: 0.9 * Math.sin(frame / 6),
  };
}

async function refreshRealSensorMode() {
  if (state.busy || state.mode !== 'REAL') return;
  state.busy = true;
  try {
    const [sample, navigation] = await Promise.all([
      requestJson('/sensor-data/latest'),
      requestJson('/navigation/real-time'),
    ]);
    if (state.mode !== 'REAL') return;
    setBackendStatus('is-connected');
    clearError();
    renderSensorSample(sample);
    renderNavigation(navigation, true);
    if (!sample) {
      els.liveStatus.textContent = 'Waiting for a real phone sample. Open the Phone Sensor Hub to connect.';
    }
  } catch (error) {
    showError(error.message);
  } finally {
    state.busy = false;
  }
}

async function refreshDemoMode() {
  if (!state.running || state.demoPaused || state.busy || state.mode !== 'DEMO') return;
  state.busy = true;
  try {
    const now = Date.now() / 1000;
    const dt = state.lastTimestamp === null
      ? UPDATE_INTERVAL_MS / 1000
      : Math.min(Math.max(now - state.lastTimestamp, 0.01), 2);
    state.lastTimestamp = now;

    if (
      !state.gpsAvailable
      && state.simulation.outageStartedAt !== null
      && state.simulation.outageDuration > 0
      && Date.now() - state.simulation.outageStartedAt >= state.simulation.outageDuration * 1000
    ) {
      state.gpsAvailable = true;
      state.simulation.outageStartedAt = null;
      updateModeControls();
    }

    const sample = createDemoSample(now, dt);
    if (state.gpsAvailable) state.gpsTimestamp = now;
    sample.gps_timestamp = state.gpsTimestamp;

    await postJson('/navigation/demo/sensor-data', sample);
    const navigation = await requestJson('/navigation/real-time?source=demo');
    if (state.mode !== 'DEMO') return;
    setBackendStatus('is-connected');
    clearError();
    renderSensorSample(sample);
    renderNavigation(navigation, true);
    if (!state.gpsAvailable && navigation.gps_available) {
      els.liveStatus.textContent = 'GPS reports paused; waiting for backend 3-second timeout';
    }
  } catch (error) {
    showError(error.message);
  } finally {
    state.busy = false;
  }
}

async function refreshPausedDemoMode() {
  if (!state.running || !state.demoPaused || state.busy || state.mode !== 'DEMO') return;
  state.busy = true;
  try {
    const navigation = await requestJson('/navigation/real-time?source=demo');
    if (state.mode !== 'DEMO' || !state.demoPaused) return;
    setBackendStatus('is-connected');
    clearError();
    renderNavigation(navigation, true);
  } catch (error) {
    showError(error.message);
  } finally {
    state.busy = false;
    updateModeControls();
  }
}

function refreshCurrentMode() {
  if (state.mode === 'REAL') {
    refreshRealSensorMode();
  } else if (state.running) {
    if (state.demoPaused) refreshPausedDemoMode();
    else refreshDemoMode();
  } else {
    renderSensorSample(null);
  }
}

async function startDemo() {
  if (state.mode !== 'DEMO' || state.running || state.busy) return;
  const startLatitude = Number(els.simulationStartLatitude.value);
  const startLongitude = Number(els.simulationStartLongitude.value);
  const initialHeading = Number(els.simulationHeading.value);
  const speedKmh = Number(els.simulationSpeed.value);
  const speed = Number.isFinite(speedKmh) ? speedKmh / 3.6 : NaN;
  const speedMultiplier = Number(els.simulationRate.value);
  const speedNoise = Number(els.simulationNoise.value);
  const headingError = Number(els.simulationHeadingError.value);
  const outageDuration = Number(els.simulationOutage.value);
  if (
    !isCoordinate(startLatitude, startLongitude)
    || !Number.isFinite(initialHeading) || initialHeading < 0 || initialHeading >= 360
    || !Number.isFinite(speedKmh) || speedKmh < 0 || speedKmh > 60
    || !Number.isFinite(speedMultiplier) || speedMultiplier < 0.25 || speedMultiplier > 4
    || !Number.isFinite(speedNoise) || speedNoise < 0 || speedNoise > 10
    || !Number.isFinite(headingError) || headingError < -45 || headingError > 45
    || !Number.isFinite(outageDuration) || outageDuration < 0 || outageDuration > 3600
  ) {
    showError('Simulation settings are invalid. Choose a demo speed cap from 4 to 60 km/h and stay within the configured safety limits.');
    return;
  }
  state.mode = 'DEMO';
  state.running = false;
  state.demoPaused = false;
  state.gpsAvailable = true;
  state.lastTimestamp = null;
  state.gpsTimestamp = null;
  state.simulation = {
    pattern: els.simulationPattern.value,
    initialHeading,
    speed,
    speedMultiplier,
    speedNoise,
    headingError,
    outageDuration,
    outageStartedAt: null,
    truthLatitude: startLatitude,
    truthLongitude: startLongitude,
    groundTruthHeading: initialHeading,
    followRoute: state.routeDemoRequested && Boolean(state.route),
    routeDistanceMeters: 0,
    routeComplete: false,
  };
  if (state.simulation.followRoute) {
    state.simulation.pattern = 'ROUTE';
    state.navigationActive = true;
    state.followLocation = true;
  }
  state.latitude = startLatitude;
  state.longitude = startLongitude;
  state.frame = 0;
  state.errorHistory = [];
  state.transitionHistory = [];
  state.lastNavigationMode = null;
  els.transitionCount.textContent = '0';
  els.simulationError.textContent = '--';
  els.simulationOutageTime.textContent = '0.0 s';
  state.sessionStartedAt = new Date().toISOString();
  state.navigationActive = state.simulation.followRoute;
  state.navigationPaused = false;
  state.followLocation = state.simulation.followRoute;
  clearModeDisplay();
  state.truthPositions = [{ latitude: startLatitude, longitude: startLongitude, timestamp: Date.now() }];
  els.simulationGroundTruth.textContent = `${startLatitude.toFixed(6)}, ${startLongitude.toFixed(6)} · SIM ONLY`;
  state.busy = true;
  updateModeControls();
  setNavigationControls();
  clearError();
  try {
    const navigation = await postJson('/navigation/demo/reset');
    if (state.mode !== 'DEMO') {
      state.busy = false;
      updateModeControls();
      return;
    }
    setBackendStatus('is-connected');
    clearError();
    state.running = true;
    state.busy = false;
    updateModeControls();
    renderNavigation(navigation);
    await refreshDemoMode();
    if (state.simulation.followRoute) {
      setRouteMessage(
        `Laptop ${state.route.profile === 'foot' ? 'walking' : 'driving'} route demo started. `
        + `Speed follows routed segment timing, up to the selected ${Number(els.simulationSpeed.value)} km/h cap. `
        + 'All samples are simulated and isolated from real sensor data.',
      );
    }
  } catch (error) {
    state.running = false;
    state.busy = false;
    updateModeControls();
    showError(`Could not start demo: ${error.message}`);
  }
}

function pauseDemo() {
  if (state.mode !== 'DEMO' || !state.running || state.demoPaused) return;
  state.demoPaused = true;
  state.lastTimestamp = null;
  els.navigationStatus.querySelector('span').textContent = 'PAUSED';
  els.navigationStatus.classList.remove('is-running');
  updateModeControls();
  updateReliability();
}

function resumeDemo() {
  if (state.mode !== 'DEMO' || !state.running || !state.demoPaused) return;
  state.demoPaused = false;
  state.lastTimestamp = null;
  updateModeControls();
  updateReliability();
  refreshDemoMode();
}

async function simulateGpsLoss() {
  if (state.mode !== 'DEMO' || !state.running || !state.gpsAvailable) return;
  state.gpsAvailable = false;
  state.simulation.outageStartedAt = Date.now();
  updateModeControls();
  await refreshDemoMode();
}

async function restoreGps() {
  if (state.mode !== 'DEMO' || !state.running || state.gpsAvailable) return;
  state.gpsAvailable = true;
  state.simulation.outageStartedAt = null;
  updateModeControls();
  await refreshDemoMode();
}

function enableMapPicking(kind) {
  if (!state.map) {
    setRouteMessage('Map point selection is unavailable because the interactive map did not load.', true);
    return;
  }
  state.mapPickMode = kind;
  const pickingOrigin = kind === 'origin';
  els.pickOriginButton.setAttribute('aria-pressed', String(pickingOrigin));
  els.pickDestinationButton.setAttribute('aria-pressed', String(!pickingOrigin));
  setRouteMessage(`Click the map to select a ${kind}.`);
}

function clearRecentDestinations() {
  storedDestinations.splice(0);
  persistLocalList(RECENT_DESTINATIONS_KEY, storedDestinations);
  renderRecentDestinations();
  setRouteMessage('Recent destination history cleared from this browser.');
}

function clearSavedSessions() {
  storedSessions.splice(0);
  persistLocalList(SAVED_SESSIONS_KEY, storedSessions);
  renderSavedSessions();
  setRouteMessage('Saved simulation sessions cleared from this browser.');
}

function clearTrack() {
  state.positions = [];
  state.truthPositions = [];
  state.errorHistory = [];
  state.transitionHistory = [];
  state.lastRenderedPosition = null;
  if (state.map) {
    state.gpsLine.setLatLngs([]);
    state.drLine.setLatLngs([]);
    state.truthLine.setLatLngs([]);
    state.map.setView([20, 0], 2, { animate: false });
    state.mapHasCenteredOnPosition = false;
  }
  if (state.fallbackInitialized) {
    els.fallbackGpsPath.setAttribute('d', '');
    els.fallbackDrPath.setAttribute('d', '');
    els.fallbackGpsPoint.setAttribute('hidden', '');
    els.fallbackPosition.setAttribute('hidden', '');
    els.fallbackLabel.setAttribute('hidden', '');
  }
  if (state.map) {
    if (state.positionMarker) state.map.removeLayer(state.positionMarker);
    if (state.gpsMarker) state.map.removeLayer(state.gpsMarker);
    if (state.truthMarker) state.map.removeLayer(state.truthMarker);
    state.positionMarker = null;
    state.gpsMarker = null;
    state.truthMarker = null;
  }
  els.pathCount.textContent = '0 received positions';
  els.mapCaption.textContent = 'Track cleared';
  els.simulationGroundTruth.textContent = '--';
  els.simulationError.textContent = '--';
  els.simulationOutageTime.textContent = '0.0 s';
  els.transitionCount.textContent = '0';
  drawSimulationErrorChart();
}

function clearModeDisplay() {
  state.latestNavigation = null;
  state.latestSample = null;
  state.lastRenderedPosition = null;
  state.lastNavigationMode = null;
  clearTrack();
  els.latValue.textContent = '--';
  els.lonValue.textContent = '--';
  els.mapLat.textContent = '--';
  els.mapLon.textContent = '--';
  els.speedValue.innerHTML = '-- <small>km/h</small>';
  els.headingValue.innerHTML = '-- <small>°</small>';
  els.gpsStatus.textContent = 'WAITING FOR GPS';
  els.gpsStatus.classList.remove('is-lost');
  els.gpsStatusSide.textContent = 'WAITING FOR GPS';
  els.gpsStatusSide.className = 'value-state';
  els.navMode.textContent = 'WAITING';
  els.navMode.classList.remove('is-dr', 'is-unavailable');
  els.modeValue.textContent = 'WAITING';
  els.modeValue.className = 'value-state';
  els.timeGpsValue.textContent = '-- s';
  els.distanceGpsValue.textContent = '-- m';
  els.positionQuality.textContent = 'Waiting for a valid position';
  els.positionQualitySecondary.textContent = 'Waiting for a valid position';
  els.navigationStatus.querySelector('span').textContent = 'MONITORING';
  els.navigationStatus.classList.remove('is-running');
  renderSensorSample(null);
  updateReliability();
}

async function resetNavigation() {
  if (state.busy) return;
  if (state.mode === 'DEMO') saveSimulationSession();
  state.running = false;
  state.demoPaused = false;
  state.simulation.outageStartedAt = null;
  state.navigationActive = false;
  state.navigationPaused = false;
  state.followLocation = false;
  state.lastTimestamp = null;
  state.busy = true;
  updateModeControls();
  setNavigationControls();
  clearError();
  els.resetButton.disabled = true;
  clearTrack();
  state.latestNavigation = null;
  state.latestSample = null;
  state.truthPositions = [];
  state.errorHistory = [];
  updateReliability();
  try {
    const navigation = await postJson(
      state.mode === 'DEMO' ? '/navigation/demo/reset' : '/navigation/reset',
    );
    setBackendStatus('is-connected');
    clearError();
    state.latitude = numberValue(navigation.latitude, 'latitude');
    state.longitude = numberValue(navigation.longitude, 'longitude');
    renderNavigation(navigation);
    if (state.mode === 'REAL') {
      state.busy = false;
      updateModeControls();
      await refreshRealSensorMode();
    } else {
      renderSensorSample(null);
    }
  } catch (error) {
    showError(`Reset failed: ${error.message}`);
  } finally {
    state.busy = false;
    els.resetButton.disabled = false;
    updateModeControls();
    setNavigationControls();
  }
}

function exportDiagnostics() {
  const diagnostics = {
    exported_at: new Date().toISOString(),
    dashboard_mode: state.mode,
    backend_url: API_BASE,
    backend_connected: state.backendConnected,
    latest_navigation: state.latestNavigation,
    latest_sensor_sample: state.latestSample,
    recent_track: state.positions,
    last_error: state.lastError,
    note: 'This local export may contain precise location and sensor data. Review before sharing.',
  };
  const blob = new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `navigation-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function loadBackendState() {
  els.phoneSensorLink.href = `https://${window.location.hostname || '127.0.0.1'}:5500/sensor.html`;
  initializeMap();
  try {
    const health = await requestJson('/health');
    if (health.status !== 'ok' || health.backend_connected !== true) {
      throw new Error('Backend health response is invalid.');
    }
    setBackendStatus('is-connected');
    clearError();
    const modelStatus = health.ml_status === 'loaded'
      ? 'Model file loaded, but ML is not applied to real-time sensor or demo navigation.'
      : `Model status: ${String(health.ml_status || 'unknown')}. ML is not applied to real-time sensor or demo navigation.`;
    els.mlNote.textContent = `ⓘ ${modelStatus} Backend dead reckoning remains authoritative.`;
  } catch (error) {
    showError(error.message);
  }
  await refreshRealSensorMode();
  state.timerId = window.setInterval(refreshCurrentMode, UPDATE_INTERVAL_MS);
}

els.realModeButton.addEventListener('click', () => setMode('REAL'));
els.demoModeButton.addEventListener('click', () => setMode('DEMO'));
els.startButton.addEventListener('click', handleStartDemo);
els.pauseDemoButton.addEventListener('click', pauseDemo);
els.resumeDemoButton.addEventListener('click', resumeDemo);
els.resetButton.addEventListener('click', resetNavigation);
els.gpsLossButton.addEventListener('click', simulateGpsLoss);
els.gpsRestoreButton.addEventListener('click', restoreGps);
els.exportDiagnosticsButton.addEventListener('click', exportDiagnostics);
els.useLocationButton.addEventListener('click', requestBrowserLocation);
els.nearbyUseLocationButton.addEventListener('click', requestBrowserLocation);
for (const button of els.nearbyCategoryButtons) {
  button.addEventListener('click', () => findNearbyPlaces(button.dataset.nearbyCategory));
}
els.recenterMapButton.addEventListener('click', recenterMap);
els.showRouteButton.addEventListener('click', showRouteOnMap);
els.pickOriginButton.addEventListener('click', () => enableMapPicking('origin'));
els.pickDestinationButton.addEventListener('click', () => enableMapPicking('destination'));
els.calculateRouteButton.addEventListener('click', calculateRoute);
els.clearRouteButton.addEventListener('click', clearRoute);
els.startNavigationButton.addEventListener('click', startNavigation);
els.pauseNavigationButton.addEventListener('click', pauseNavigation);
els.resumeNavigationButton.addEventListener('click', resumeNavigation);
els.stopNavigationButton.addEventListener('click', stopNavigation);
els.simulateRouteButton.addEventListener('click', startRouteDemo);
els.routeProfile.addEventListener('change', () => {
  if (state.navigationActive || state.navigationPaused
    || (state.mode === 'DEMO' && state.running && state.simulation.followRoute)) {
    els.routeProfile.value = state.route?.profile || 'foot';
    configureDemoSpeedOptions(els.routeProfile.value);
    setRouteMessage('Stop the active route simulation or guidance before changing travel mode.', true);
    return;
  }
  configureDemoSpeedOptions();
  if (!state.route && !state.routeOptions.length) return;
  removeRouteLayers();
  state.route = null;
  state.routeOptions = [];
  state.routeProgressMeters = 0;
  els.routeSummary.hidden = true;
  els.routeChoiceList.replaceChildren();
  els.routeGuidance.hidden = true;
  setRouteMessage('Travel mode changed. Find the route again to use the new mode.');
  updateMapActionControls();
  setNavigationControls();
});
els.followLocationButton.addEventListener('click', () => {
  state.followLocation = !state.followLocation;
  setNavigationControls();
});
els.clearRecentsButton.addEventListener('click', clearRecentDestinations);
els.clearSessionsButton.addEventListener('click', clearSavedSessions);
bindPlaceSearch('origin');
bindPlaceSearch('destination');
renderRecentDestinations();
renderSavedSessions();
drawSimulationErrorChart();

updateModeControls();
configureDemoSpeedOptions();
setNavigationControls();
updateNearbyLocationStatus();
updateMapActionControls();
loadBackendState();
