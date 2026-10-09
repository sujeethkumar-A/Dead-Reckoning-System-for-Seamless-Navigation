"""
Stage 1 Automated Verification Suite
Tests FastAPI endpoints for sensor telemetry and regression checks on existing endpoints.
"""
import sys
import time
import requests

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print(f"[*] Testing Stage 1 endpoints against {BASE_URL}...")
    errors = 0

    # 1. Root & Health
    try:
        r = requests.get(f"{BASE_URL}/")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        print("  [PASS] GET / -> 200 OK")
    except Exception as e:
        print(f"  [FAIL] GET /: {e}")
        errors += 1

    try:
        r = requests.get(f"{BASE_URL}/health")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert data.get("status") == "ok", f"Expected status ok, got {data}"
        print("  [PASS] GET /health -> 200 OK")
    except Exception as e:
        print(f"  [FAIL] GET /health: {e}")
        errors += 1

    # 2. Existing Navigation endpoints regression check
    try:
        r = requests.post(f"{BASE_URL}/navigation/start")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        print("  [PASS] POST /navigation/start -> 200 OK")

        r = requests.get(f"{BASE_URL}/navigation/state")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        print("  [PASS] GET /navigation/state -> 200 OK")

        update_payload = {
            "latitude": 11.001,
            "longitude": 77.001,
            "gps_available": True,
            "speed": 5.5,
            "heading": 45.0,
            "accel_x": 0.05,
            "accel_y": 0.02,
            "gyro_z": 0.01,
            "timestamp": time.time(),
        }
        r = requests.post(f"{BASE_URL}/navigation/update", json=update_payload)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        print("  [PASS] POST /navigation/update -> 200 OK")
    except Exception as e:
        print(f"  [FAIL] Existing navigation endpoints: {e}")
        errors += 1

    # 3. GET /sensor-data/latest initially or check current state
    try:
        r = requests.get(f"{BASE_URL}/sensor-data/latest")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        print(f"  [PASS] GET /sensor-data/latest initial call -> 200 OK (body: {r.json()})")
    except Exception as e:
        print(f"  [FAIL] GET /sensor-data/latest: {e}")
        errors += 1

    # 4. POST /sensor-data with full realistic telemetry sample
    sample_data = {
        "timestamp": 1712580000.123,
        "latitude": 12.971598,
        "longitude": 77.594562,
        "gps_accuracy": 4.2,
        "gps_speed": 1.35,
        "gps_heading": 182.4,
        "gps_available": True,
        "accel_x": 0.124,
        "accel_y": -0.045,
        "accel_z": 9.812,
        "gyro_alpha": 0.05,
        "gyro_beta": -0.12,
        "gyro_gamma": 0.01,
    }

    try:
        r = requests.post(f"{BASE_URL}/sensor-data", json=sample_data)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        res_json = r.json()
        assert res_json.get("status") == "success", f"Expected success, got {res_json}"
        print("  [PASS] POST /sensor-data -> 200 OK")
    except Exception as e:
        print(f"  [FAIL] POST /sensor-data: {e}")
        errors += 1

    # 5. GET /sensor-data/latest should now return exact sample
    try:
        r = requests.get(f"{BASE_URL}/sensor-data/latest")
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        latest = r.json()
        assert latest is not None, "Expected latest sample dict, got None"
        assert latest.get("latitude") == 12.971598, f"Latitude mismatch: {latest.get('latitude')}"
        assert latest.get("longitude") == 77.594562, f"Longitude mismatch: {latest.get('longitude')}"
        assert latest.get("accel_z") == 9.812, f"accel_z mismatch: {latest.get('accel_z')}"
        assert latest.get("gps_available") is True, f"gps_available mismatch: {latest.get('gps_available')}"
        print(f"  [PASS] GET /sensor-data/latest retrieved verified sample correctly")
    except Exception as e:
        print(f"  [FAIL] GET /sensor-data/latest verification: {e}")
        errors += 1

    # 6. POST /sensor-data with null values (e.g., GPS not fixed yet, sensor idle)
    null_sample = {
        "timestamp": 1712580005.456,
        "latitude": None,
        "longitude": None,
        "gps_accuracy": None,
        "gps_speed": None,
        "gps_heading": None,
        "gps_available": False,
        "accel_x": 0.0,
        "accel_y": 0.0,
        "accel_z": 9.8,
        "gyro_alpha": None,
        "gyro_beta": None,
        "gyro_gamma": None,
    }

    try:
        r = requests.post(f"{BASE_URL}/sensor-data", json=null_sample)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        print("  [PASS] POST /sensor-data with null/partial telemetry -> 200 OK")
    except Exception as e:
        print(f"  [FAIL] POST /sensor-data with null fields: {e}")
        errors += 1

    # 7. Malformed data handling (Backend should return 422 and not crash)
    malformed_cases = [
        {"timestamp": "not-a-number"},  # Invalid type
        {"latitude": 12.3},             # Missing required timestamp
        "invalid raw string",           # Invalid JSON body structure
        {"timestamp": 123.4, "accel_x": "bad_float"},
    ]

    for idx, case in enumerate(malformed_cases, start=1):
        try:
            r = requests.post(f"{BASE_URL}/sensor-data", json=case)
            assert r.status_code in [400, 422], f"Expected 400/422, got {r.status_code}"
            print(f"  [PASS] Malformed case #{idx} rejected safely with HTTP {r.status_code}")
        except Exception as e:
            print(f"  [FAIL] Malformed case #{idx}: {e}")
            errors += 1

    # 8. Post-malformed health check
    try:
        r = requests.get(f"{BASE_URL}/health")
        assert r.status_code == 200, f"Backend died! Got {r.status_code}"
        print("  [PASS] Backend alive and healthy after malformed payloads")
    except Exception as e:
        print(f"  [FAIL] Health check after malformed inputs: {e}")
        errors += 1

    # 9. CORS check
    try:
        options_headers = {
            "Origin": "http://192.168.1.100:5500",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        }
        r = requests.options(f"{BASE_URL}/sensor-data", headers=options_headers)
        allow_origin = r.headers.get("access-control-allow-origin")
        assert allow_origin in ["*", "http://192.168.1.100:5500"], f"CORS allow-origin was: {allow_origin}"
        print(f"  [PASS] CORS preflight OPTIONS check -> 200 OK (Allow-Origin: {allow_origin})")
    except Exception as e:
        print(f"  [FAIL] CORS preflight check: {e}")
        errors += 1

    print("\n-------------------------------------------")
    if errors == 0:
        print(">>> ALL STAGE 1 AUTOMATED TESTS PASSED! <<<")
        print("-------------------------------------------")
        return 0
    else:
        print(f">>> {errors} TEST(S) FAILED! <<<")
        print("-------------------------------------------")
        return 1

if __name__ == "__main__":
    sys.exit(run_tests())
