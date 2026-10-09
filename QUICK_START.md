# STAGE 1 Quick Start Guide

## 🚀 Start Everything in 3 Steps

### 1. Open PowerShell Terminal #1 - Start Backend
```powershell
cd "c:\Users\sujith kumar\OneDrive\Desktop\Dead Reckoning System for Seamless Navigation\AI-Dead-Reckoning\backend"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Wait for:** `Application startup complete.`

### 2. Open PowerShell Terminal #2 - Start Frontend
```powershell
cd "c:\Users\sujith kumar\OneDrive\Desktop\Dead Reckoning System for Seamless Navigation\AI-Dead-Reckoning\frontend"
python -m http.server 5500 --bind 0.0.0.0
```

**Wait for:** `Serving HTTP on 0.0.0.0 port 5500`

### 3. Find Your Laptop IP
```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual" } | Select-Object IPAddress, InterfaceAlias
```

**Copy the IPv4 address** (usually Wi-Fi adapter)

---

## 📱 On Your Android Phone

1. **Open Chrome**
2. **Navigate to:**
   ```
   http://<YOUR_LAPTOP_IP>:5500/sensor.html
   ```
   Example: `http://10.199.80.175:5500/sensor.html`

3. **Set backend URL** at top of page:
   ```
   http://<YOUR_LAPTOP_IP>:8000
   ```
   Click **SET URL**

4. **Tap CONNECT SENSORS**

5. **Grant permissions:**
   - ✅ Location (GPS)
   - ✅ Motion sensors

---

## ⚠️ Secure Context Warning

If you see: **"Secure context: NO"**

This is normal! Use one of these:

**Option A (Best):** USB Port Forwarding
- Connect phone via USB
- In laptop Chrome: `chrome://inspect/#devices`
- Click "Port forwarding" for port `5500` and `8000`
- Open `http://localhost:5500/sensor.html` on phone

**Option B:** Chrome Flag
- Phone Chrome: `chrome://flags/#unsafely-treat-insecure-origin-as-treat-secure`
- Add `http://10.199.80.175:5500`
- Restart Chrome

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
python test_stage1.py
```

Should show: `>>> ALL STAGE 1 AUTOMATED TESTS PASSED! <<<`

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| "BACKEND UNREACHABLE" | Check IP is correct, backend running on port 8000 |
| "GPS not working" | Check Android permissions for Chrome → Location |
| Port already in use | Kill process: `netstat -ano \| findstr :5500` then `taskkill /PID <number> /F` |
| Phone can't reach laptop | Same Wi-Fi network? Check Windows Firewall |

---

## 📊 API Endpoints

```bash
# Health check
curl http://10.199.80.175:8000/health

# Latest sensor sample
curl http://10.199.80.175:8000/sensor-data/latest

# Send sample (from phone automatically)
curl -X POST http://10.199.80.175:8000/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

---

## 📁 File Locations

| File | Path | Purpose |
|------|------|---------|
| Backend | `AI-Dead-Reckoning\backend\main.py` | FastAPI server |
| Sensor Page | `AI-Dead-Reckoning\frontend\sensor.html` | Android phone UI |
| Sensor Logic | `AI-Dead-Reckoning\frontend\sensor.js` | Real sensor APIs + transmission |
| Tests | `AI-Dead-Reckoning\backend\test_stage1.py` | Automated verification |

---

## 🎯 What Changed in STAGE 1?

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
- Real sensors only (no fake data generation)
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
