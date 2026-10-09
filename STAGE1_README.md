# STAGE 1: Real Android Phone Sensor Input Implementation

## Overview

STAGE 1 implements **real Android phone sensor telemetry** for the AI/ML Intelligent Dead Reckoning System. The system now accepts REAL sensor measurements from an Android device instead of JavaScript-generated fake values.

### What is INCLUDED (STAGE 1)
✅ Real Android GPS data via `navigator.geolocation.watchPosition()`  
✅ Real accelerometer/gyroscope data via `DeviceMotionEvent` API  
✅ Dedicated sensor.html page with real-time UI display  
✅ Backend `/sensor-data` POST endpoint (stores latest sample in memory)  
✅ Backend `/sensor-data/latest` GET endpoint (retrieves stored sample)  
✅ CORS enabled for cross-origin sensor communication  
✅ Secure context warning with browser permission guidance  
✅ LAN-based communication between phone and laptop  
✅ Comprehensive test suite verifying all functionality  

### What is EXCLUDED (STAGE 1 - Reserved for later stages)
❌ GPS-loss detection and automatic dead-reckoning triggering  
❌ ML model improvements or changes  
❌ Persistent database storage of sensor samples  
❌ Dead-reckoning mathematics changes  
❌ Modifications to existing navigation endpoints  

---

## Architecture

```
Android Phone (Chrome)                           Windows Laptop
┌─────────────────────────┐                      ┌──────────────────────────┐
│ sensor.html             │                      │ FastAPI Backend          │
│ ├─ Real GPS Sensor      │──┐                   │ (host=0.0.0.0:8000)    │
│ ├─ Real Accel/Gyro      │  │    Wi-Fi LAN     │ ├─ POST /sensor-data    │
│ └─ DeviceMotionEvent    │  ├───────────────────→ │ ├─ GET /sensor-data/   │
│                         │  │  JSON payload     │ │   latest              │
│ (4 Hz transmission)     │  │                   │ ├─ Existing nav routes  │
│                         │←─┘  Backend response │ └─ Health check         │
└─────────────────────────┘                      └──────────────────────────┘
       Port 5500                                         Port 8000
   (http://LAPTOP_IP:5500)              (http://LAPTOP_IP:8000)
```

### Key Implementation Details

**Frontend (sensor.html, sensor.js, sensor.css):**
- Detects secure context using `window.isSecureContext`
- Requests real GPS via `navigator.geolocation.watchPosition()` with options:
  - `enableHighAccuracy: true`
  - `timeout: 15000`
  - `maximumAge: 0` (no caching)
- Listens for real accelerometer/gyroscope via `DeviceMotionEvent` and `DeviceOrientationEvent`
- Transmits complete JSON payload to backend at **4 Hz (250ms interval)**
- Displays real-time sensor status, values, and network transmission stats
- Provides backend URL configuration UI for dynamic LAN IP input

**Backend (main.py endpoints):**
```python
POST /sensor-data
  ✓ Accepts SensorDataPayload (Pydantic model)
  ✓ Stores latest sample in memory: latest_sensor_sample
  ✓ Returns {"status": "success", "message": "...", "sample": {...}}

GET /sensor-data/latest
  ✓ Returns latest stored sample (dict or None)
  ✓ No database writes (memory only, for STAGE 1)
```

**CORS Configuration:**
- `allow_origins=["*"]` (all origins permitted for local network development)
- All HTTP methods enabled
- All headers permitted

---

## Getting Started

### Prerequisites

✓ Windows laptop with Python 3.8+  
✓ Android device with Chrome browser  
✓ Both devices connected to same Wi-Fi network  
✓ FastAPI and dependencies installed  

### Installation (First Time Only)

```bash
# Navigate to backend directory
cd "AI-Dead-Reckoning\backend"

# Install dependencies (if needed)
pip install fastapi uvicorn pydantic xgboost
```

---

## Running the System

### Step 1: Start the FastAPI Backend

**Option A: Direct Command (Recommended)**
```powershell
cd "AI-Dead-Reckoning\backend"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Expected Output:**
```
INFO:     Will watch for changes in these directories: [...]
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started server process [...]
INFO:     Application startup complete.
```

**Why `--host 0.0.0.0`?**  
The backend binds to all network interfaces (0.0.0.0), making it accessible from the Android phone over Wi-Fi LAN. Without this, it only listens on 127.0.0.1 (localhost).

### Step 2: Find Your Laptop's LAN IPv4 Address

**On Windows PowerShell:**
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual" } | Select-Object IPAddress, InterfaceAlias
```

**Example Output:**
```
IPAddress      InterfaceAlias
---------      --------------
10.199.80.175  Wi-Fi
```

**Note:** The first address (usually your Wi-Fi adapter) is what you need. Remember this IP for the next steps.

### Step 3: Start the Frontend Server

**Option A: Python's Built-in HTTP Server (Recommended)**
```powershell
cd "AI-Dead-Reckoning\frontend"
python -m http.server 5500 --bind 0.0.0.0
```

**Expected Output:**
```
Serving HTTP on 0.0.0.0 port 5500 (http://0.0.0.0:5500/) ...
```

The `--bind 0.0.0.0` makes it accessible from any device on the network.

---

## Using the Phone Sensor Page

### Step 1: Open sensor.html on Android Chrome

On your Android phone's Chrome browser, navigate to:
```
http://<LAPTOP_IP>:5500/sensor.html
```

**Example with the IP from earlier:**
```
http://10.199.80.175:5500/sensor.html
```

### Step 2: Configure Backend URL

At the top of the page, you'll see:

**"TARGET TELEMETRY SERVER"** card with:
- Input field showing the default backend URL
- **SET URL** button

Update the input to:
```
http://<LAPTOP_IP>:8000
```

Example:
```
http://10.199.80.175:8000
```

Then click **SET URL**. The page will test connectivity to the backend.

### Step 3: Grant Sensor Permissions

Tap the **CONNECT SENSORS** button.

The browser will request permissions for:
- ✅ **Location** (GPS) - Tap "Allow" or "Allow only while using the app"
- ✅ **Motion** (accelerometer/gyroscope) - May be automatic on Android

**Note on HTTPS/Secure Context:**

Modern Android Chrome requires a **Secure Context** for GPS and motion APIs. Your page will show a banner indicating:

```
Secure context: NO
HTTPS is required for phone GPS/motion access in this browser.
```

**This is normal on a local LAN.** Three solutions are provided in the warning:

1. **Option A (Recommended - USB Port Forwarding):**
   - Connect phone via USB to laptop
   - Open `chrome://inspect/#devices` on laptop
   - Port forward `5500` and `8000`
   - Open `http://localhost:5500/sensor.html` on phone
   - Chrome treats `localhost` as secure ✓

2. **Option B (Chrome Flag):**
   - On phone Chrome: `chrome://flags/#unsafely-treat-insecure-origin-as-treat-secure`
   - Add `http://10.199.80.175:5500`
   - Restart Chrome
   - Sensors may become accessible

3. **Option C (Local HTTPS):**
   - Generate self-signed certificate (e.g., via `mkcert`)
   - Serve frontend over HTTPS
   - More complex but proper security

### Step 4: Verify Sensor Data

Once connected:
- ✅ Move the phone around → accelerometer values change
- ✅ Rotate the phone → gyroscope values change
- ✅ Device reports location → GPS values appear
- ✅ "Samples transmitted" counter increments every ~250ms
- ✅ Backend status shows **ONLINE**

---

## Testing the Implementation

### Automated Test Suite

Run the comprehensive test suite to verify all endpoints:

```powershell
cd "AI-Dead-Reckoning\backend"
python test_stage1.py
```

**Test Coverage:**
- ✅ Root endpoint `GET /` works
- ✅ Health check `GET /health` works
- ✅ Existing navigation endpoints still work (regression)
- ✅ `POST /sensor-data` accepts valid payloads
- ✅ `GET /sensor-data/latest` returns stored samples
- ✅ Null/partial telemetry handled correctly
- ✅ Malformed data rejected with HTTP 422 (not crashing backend)
- ✅ Backend survives malformed requests
- ✅ CORS preflight OPTIONS works

**Expected Output:**
```
[*] Testing Stage 1 endpoints against http://127.0.0.1:8000...
  [PASS] GET / -> 200 OK
  [PASS] GET /health -> 200 OK
  ...
  [PASS] CORS preflight OPTIONS check -> 200 OK

>>> ALL STAGE 1 AUTOMATED TESTS PASSED! <<<
```

### Manual Testing Checklist

- [ ] **Backend starts** without errors on `0.0.0.0:8000`
- [ ] **Frontend loads** from `http://LAPTOP_IP:5500/sensor.html`
- [ ] **Security context** warning displays (expected on HTTP LAN)
- [ ] **Connect Sensors** button enables sensor listening
- [ ] **GPS acquired** - latitude/longitude display real coordinates
- [ ] **Motion sensors active** - accelerometer/gyroscope show non-zero values when moved/rotated
- [ ] **Samples counter** increments (4 Hz = every ~250ms)
- [ ] **Last update time** changes every sample
- [ ] **Backend status** shows "ONLINE (200)"
- [ ] **Raw JSON payload** visible in inspector section
- [ ] **No random values** - all values are from real sensors
- [ ] **Move phone in different directions** - accelerometer changes accordingly
- [ ] **Rotate phone** - gyroscope changes accordingly
- [ ] **Navigate back to index.html** - existing navigation console still works
- [ ] **Disconnect button** stops sensor transmission
- [ ] **Health endpoint** still responds: `http://LAPTOP_IP:8000/health`

### Debugging Tips

| Issue | Solution |
|-------|----------|
| "BACKEND UNREACHABLE" on phone | Verify LAPTOP_IP is correct, backend running on `0.0.0.0:8000` |
| "GPS PERMISSION DENIED" | Check Android settings → Chrome → Permissions → Location enabled |
| "Secure context: NO" warning persists | Use Option A, B, or C from the warning banner to enable sensor access |
| Accelerometer/Gyro shows "--" (null) | Phone may not have sensors, or browser didn't request permissions. Tap "Allow" when prompted. |
| "HTTPS is required..." banner appears | Normal on LAN HTTP. Use USB port forwarding or Chrome flags to enable sensors. |
| Port 5500 already in use | Change port: `python -m http.server 5555 --bind 0.0.0.0` then use `http://LAPTOP_IP:5555/sensor.html` |
| "Can't connect to http://LAPTOP_IP:8000" | Ensure laptop and phone are on **same Wi-Fi network**, no firewall blocking port 8000 |

---

## API Reference

### POST /sensor-data

**Purpose:** Accept real sensor measurements from Android phone.

**Request Body (JSON):**
```json
{
  "timestamp": 1712580000.123,
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
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "message": "Sensor sample stored",
  "sample": { /* echoes back the stored data */ }
}
```

**Error Responses:**
- **422 Unprocessable Entity** - Malformed JSON or invalid field types
- **400 Bad Request** - Missing required fields

---

### GET /sensor-data/latest

**Purpose:** Retrieve the most recently stored sensor sample.

**Response (200 OK):**
```json
{
  "timestamp": 1712580005.456,
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
}
```

**Or (if no sample yet):**
```json
null
```

---

## File Structure

```
AI-Dead-Reckoning/
├── backend/
│   ├── main.py                    ← FastAPI app with /sensor-data endpoints
│   ├── schemas.py                 ← SensorDataPayload Pydantic model
│   ├── dead_reckoning.py          ← (Unchanged)
│   ├── ml_model.py                ← (Unchanged)
│   └── test_stage1.py             ← Automated test suite
│
└── frontend/
    ├── sensor.html                ← Real sensor page (STAGE 1)
    ├── sensor.js                  ← Real sensor logic + backend config
    ├── sensor.css                 ← Sensor page styling
    ├── index.html                 ← Existing navigation console
    ├── script.js                  ← (Unchanged)
    └── style.css                  ← (Unchanged)
```

**Key Changes in STAGE 1:**
- `backend/main.py`: Added `POST /sensor-data` and `GET /sensor-data/latest` endpoints (already there)
- `backend/schemas.py`: Added `SensorDataPayload` model (already there)
- `frontend/`: New files `sensor.html`, `sensor.js`, `sensor.css` (already there)
- No changes to dead reckoning or ML models

---

## Important Notes

### Why NOT Database (STAGE 1)?
- Keeps system simple and focused on real sensor integration
- Memory storage sufficient for live telemetry monitoring
- Database persistence planned for future stages

### Why 4 Hz Transmission Rate?
- 250ms interval balances responsiveness and network load
- Sufficient for dead-reckoning motion detection
- Adjustable in `sensor.js`: line ~380 `setInterval(sendSensorSample, 250)`

### Real Sensor Data Only
The implementation **never generates random or fake sensor values**:
- GPS: Only displays when `navigator.geolocation` returns a valid fix
- Accelerometer: Reads directly from `DeviceMotionEvent.accelerationIncludingGravity`
- Gyroscope: Reads directly from `DeviceMotionEvent.rotationRate` (or fallback to `DeviceOrientationEvent`)

### Secure Context Requirement
Modern browsers enforce **Secure Contexts** for sensitive APIs:
- HTTPS (with valid certificate)
- `localhost` or `127.0.0.1`
- Specific insecure origins via Chrome flag
- Possible future: `http://` on private networks (experimental)

---

## What's Next (Future Stages)

**STAGE 2+** (Not in this implementation):
- [ ] GPS-loss detection and handling
- [ ] Automatic dead-reckoning trigger on GPS loss
- [ ] ML model retraining with real sensor data
- [ ] Persistent sensor data storage (MySQL)
- [ ] Advanced filtering and calibration
- [ ] Production-grade HTTPS deployment

---

## Summary

**STAGE 1 successfully delivers:**

1. ✅ Real Android phone sensor integration
2. ✅ Dedicated sensor telemetry page
3. ✅ Backend endpoints for sensor data storage/retrieval
4. ✅ Complete test coverage
5. ✅ Clear deployment instructions
6. ✅ Security context awareness
7. ✅ LAN-based communication

**No existing functionality was removed or modified.** All original navigation endpoints, dead-reckoning logic, and ML model remain unchanged.

The system is ready for real-world sensor data collection and analysis.

---

## Support & Troubleshooting

**Secure Context Issues?**  
→ See the warning banner on sensor.html with detailed solutions

**Port Conflicts?**  
→ Change port numbers and update configuration

**Backend Not Responding?**  
→ Check Windows Firewall allows inbound on port 8000  
→ Verify laptop and phone on same Wi-Fi network

**Sensors Not Working on Phone?**  
→ Ensure Android Chrome has permission for Location  
→ Try USB port forwarding (Option A) for reliable Secure Context

---

**Last Updated:** STAGE 1 Implementation Complete  
**Backend Version:** 0.4.0  
**Frontend Version:** Real Sensor Integration Ready
