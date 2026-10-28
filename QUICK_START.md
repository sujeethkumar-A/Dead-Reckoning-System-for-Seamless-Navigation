# Navigation Dashboard and Phone Sensor Quick Start

## Start the Backend and Dashboard

### 1. Start FastAPI in PowerShell terminal 1
```powershell
cd "c:\Users\sujith kumar\OneDrive\Desktop\Dead Reckoning System for Seamless Navigation\AI-Dead-Reckoning\backend"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Wait for:** `Application startup complete.`

### 2. Serve the dashboard in PowerShell terminal 2
```powershell
cd "c:\Users\sujith kumar\OneDrive\Desktop\Dead Reckoning System for Seamless Navigation\AI-Dead-Reckoning\frontend"
python -m http.server 5501 --bind 0.0.0.0
```

**Wait for:** `Serving HTTP on 0.0.0.0 port 5501`

Open the laptop dashboard at **http://127.0.0.1:5501/**. Choose **DEMO MODE**
and click **START DEMO** to run without a phone. Demo sensor readings are
explicitly labelled simulated. Click **SIMULATE GPS LOSS** and wait for the
backend's three-second GPS timeout; the dashboard shows the actual
`/navigation/real-time?source=demo` dead-reckoning response. Click **RESTORE
GPS** to send a new simulated fix. Demo samples and navigation state are
isolated from `/sensor-data/latest` and the real navigation state.

## Dashboard Features and Limits

- **Route planning:** Search addresses or choose points on the map, request a
  walking or driving route, compare alternatives sorted by distance, and review
  route distance, maneuvers, and progress. Search and routing use public
  OpenStreetMap-based demo services; an internet connection is required and
  these services may rate-limit or be unavailable. Route guidance is a
  dashboard aid, not safety-critical turn-by-turn navigation.
- **Nearby places and directions:** Set a start by searching/selecting a place,
  pressing **USE LOCATION**, or selecting **SET MY LOCATION** in Nearby Places.
  Choose Restaurants, Petrol, Hotels, ATMs, or Grocery to search mapped places
  within 2 km; select **Directions** on a result to use it as the destination
  and calculate a route from your start. Nearby search tries OpenStreetMap's
  bounded place search first and uses Overpass map data if it returns no matches.
  Results depend on internet access and public map-service availability.
- **Map controls:** Start and destination have distinct green **A / START** and
  red **B / END** markers. **Recenter** returns to the latest valid navigation
  position (or the selected start when no current fix exists), and **Show route**
  fits the whole calculated route in the map.
- **Follow a route without walking:** Choose **LAPTOP DEMO**, search for an
  origin and destination (for example, **Vidhana Soudha** to **Bengaluru City
  Railway Station**), choose **Walking**, and click **FIND ROUTE**. Select the
  shortest route or an alternative, then click **START DEMO · FOLLOW ROUTE**
  (or **SIMULATE THIS ROUTE · DEMO ONLY**). Simulated GPS advances along the
  selected route rather than the default straight-line pattern, and the
  dashboard reports backend navigation responses and route progress. If you
  have entered locations but have not clicked **FIND ROUTE**, the demo asks you
  to calculate a route instead of moving in an unrelated direction. No
  generated sample is sent to the real `/sensor-data` endpoint or replaces a
  real phone sample. Use **SIMULATE GPS LOSS** and **RESTORE GPS** during the
  run to demonstrate backend timeout and GPS recovery.
- **Laptop simulation:** Expand **Walk a planned route without leaving your
  desk** to configure
  a start coordinate, motion pattern, speed cap, rate, sensor noise, heading
  error, and optional GPS-outage duration. Walking demos offer 4–6 km/h caps;
  driving demos offer 30–60 km/h caps. Route-following demos use the routing
  service's per-segment duration as a speed estimate, limited by the selected
  cap, so faster highway segments can reach 50–60 km/h while slower segments
  remain slower. A standalone demo uses the selected cap directly. These
  settings affect demo data only; real sensor mode is unchanged. Pause/resume
  stops publishing simulated
  samples while the dashboard continues querying the backend. During simulated
  GPS loss, latitude and longitude are sent as `null`; the map keeps the
  simulated ground truth only in the browser for comparison. Nothing from the
  simulator is written to the real sensor endpoint.
- **Saved sessions:** Resetting a demo saves its simulated track, transition
  history, and error series in this browser's local storage. Replays are
  read-only and do not update backend navigation.
- **Reliability panel:** When GPS or movement estimates are unavailable, the
  dashboard labels the last GPS fix as reference-only and explains recovery
  options. Raw accelerometer and gyroscope values are telemetry, not a
  substitute for speed or heading. The trained ML model is not used to correct
  these live estimates.

**REAL SENSOR MODE** reads the real phone sample from `/sensor-data/latest` and
the navigation state from `/navigation/real-time`. Use the **PHONE SENSOR HUB**
link to open the Android sensor page; the phone and laptop must be on the same
Wi-Fi network and the backend URL on that page must point at this laptop.

The dashboard uses `AI-Dead-Reckoning\frontend` (the folder containing its
`index.html` and `script.js`). The root `frontend` folder contains the existing
phone sensor page. In this workspace it is already served over HTTPS on port
5500; keep that sensor server running and use port 5501 for the dashboard.

## Connect an Android Phone

### 1. Find your laptop IP
```powershell
ipconfig
```

Use the Wi-Fi adapter's IPv4 address. Keep the phone and laptop on the same
Wi-Fi network.

### 2. Open the sensor page on Android Chrome
   ```
   https://<YOUR_LAPTOP_IP>:5500/sensor.html
   ```

Set the sensor page backend URL to:
   ```
   http://<YOUR_LAPTOP_IP>:8000
   ```

Tap **CONNECT SENSORS** and grant location/motion permission when prompted.

## ⚠️ Secure Context Warning

The laptop dashboard/demo works over local HTTP without a phone. Modern Android
browsers may block phone GPS and motion APIs on ordinary LAN HTTP. The sensor
page reports its secure-context status; if it says **NO**, serve it from a
trusted HTTPS origin before expecting real phone sensors to work. Do not bypass
the browser's secure-context protections.

---

## ✅ Verify It Works

On phone:
- ✅ GPS shows latitude/longitude
- ✅ Move phone → accelerometer changes
- ✅ Rotate phone → gyroscope changes
- ✅ "Samples transmitted" counter goes up
- ✅ "BACKEND STATUS" shows "ONLINE (200)"

---

## 🧪 Run Tests

```powershell
cd "c:\Users\sujith kumar\OneDrive\Desktop\Dead Reckoning System for Seamless Navigation\AI-Dead-Reckoning\backend"
python -B -m unittest test_dead_reckoning.py test_stage2.py test_stage3.py
node --check ..\frontend\script.js
```

The Python command runs the focused calculation, GPS timeout/recovery, demo
isolation, and existing endpoint tests. The Node command checks dashboard
JavaScript syntax. Browser route search and map tiles additionally require
internet access.

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| "BACKEND UNREACHABLE" | Check IP is correct, backend running on port 8000 |
| "GPS not working" | Check Android permissions for Chrome → Location |
| Dashboard port already in use | Check `netstat -ano \| findstr :5501`; stop only the identified process with `Stop-Process -Id <PID>` |
| Phone can't reach laptop | Same Wi-Fi network? Check Windows Firewall |

---

## 📊 API Endpoints

```bash
# Health check
curl http://10.199.80.175:8000/health

# Latest sensor sample
curl http://10.199.80.175:8000/sensor-data/latest

# Latest real-time navigation state (GPS expires after 3 seconds without a new GPS fix)
curl http://10.199.80.175:8000/navigation/real-time

# Send sample (from phone automatically)
curl -X POST http://10.199.80.175:8000/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "timestamp": 1712580000.123,
    "gps_timestamp": 1712580000.123,
    "latitude": 12.971598,
    "longitude": 77.594562,
    "gps_accuracy": 4.2,
    "gps_speed": 1.35,
    "gps_heading": 182.4,
    "gps_available": true,
    "accel_x": 0.124,
    "accel_y": -0.045,
    "accel_z": 9.812,
    "gyro_alpha": 0.05,
    "gyro_beta": -0.12,
    "gyro_gamma": 0.01
  }'
```

The phone page sends `gps_timestamp` from the browser's actual geolocation fix.
Repeated sensor samples carrying the same GPS fix do not reset its 3-second
freshness timer. When a newer valid fix arrives, the estimated position is
synchronized to that fix and GPS mode resumes.

---

## 📁 File Locations

| File | Path | Purpose |
|------|------|---------|
| Backend | `AI-Dead-Reckoning\backend\main.py` | FastAPI server |
| Laptop dashboard | `AI-Dead-Reckoning\frontend\index.html` | Real sensor / demo dashboard |
| Dashboard logic | `AI-Dead-Reckoning\frontend\script.js` | Backend polling and demo publisher |
| Dashboard styles | `AI-Dead-Reckoning\frontend\style.css` | Dashboard layout |
| Sensor Page | `AI-Dead-Reckoning\frontend\sensor.html` | Android phone UI |
| Sensor Logic | `AI-Dead-Reckoning\frontend\sensor.js` | Real sensor APIs + transmission |
| Tests | `AI-Dead-Reckoning\backend\test_stage1.py` | Automated verification |

---

## Backend endpoints used by the dashboard

- `GET /sensor-data/latest` — latest real phone sensor packet in memory.
- `GET /navigation/real-time` — current real GPS/dead-reckoning state.
- `GET /navigation/real-time?source=demo` — isolated demo GPS/dead-reckoning
  state using the same backend timeout and propagation logic.
- `POST /sensor-data` — real phone samples only; latest real sample remains
  available here.
- `POST /navigation/demo/sensor-data` — clearly labelled simulated samples,
  stored separately from the real sensor feed.
- `POST /navigation/demo/reset` — reset only the isolated demo state.
- `POST /navigation/start` and `POST /navigation/reset` — initialize/reset the
  existing real navigation state.

The trained model asset and the existing optional ML integration are unchanged.
The dashboard reports model availability but does not apply ML to the
real-time-sensor or demo endpoint flow; backend dead reckoning is authoritative.

## 🎯 Stage 1 features retained

✅ **Added:**
- `POST /sensor-data` endpoint (accepts real sensor data)
- `GET /sensor-data/latest` endpoint (retrieves stored sample)
- `sensor.html` phone page with real GPS/motion sensors
- `sensor.js` with real `navigator.geolocation` and `DeviceMotionEvent` APIs
- `sensor.css` for Android Chrome UI

❌ **NOT Changed:**
- Dead-reckoning mathematics
- XGBoost ML model
- Existing navigation endpoints
- Database structure

---

## 🔐 Security Notes

- CORS enabled for LAN development (`allow_origins=["*"]`)
- Phone sensor page uses real browser sensors; dashboard demo data is explicitly labelled simulated
- Secure context required by modern browsers for GPS/motion
- All payloads validated by Pydantic (malformed requests rejected)
- No credentials or secrets in code

---

## 📝 Notes

**STAGE 1 is complete and ready for testing.**

- Real sensor data confirmed working
- All endpoints tested and passing
- No database required (memory-only storage for STAGE 1)
- Production deployment (STAGE 2+) will add HTTPS, DB, and advanced features
