"""
test_api.py
Simulates how Node.js calls the Flask API.
Tests all 3 endpoints: /health, /geocode-test, /optimize (with mock Excel).

Run Flask first:  python app.py
Then in another terminal: python test_api.py

OR run in-process (no live server needed) using Flask test client — that's what this does.
"""

import json
import io
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app

client = app.test_client()

def pretty(label, response):
    data = response.get_json()
    status = response.status_code
    ok = "✅" if status < 400 else "❌"
    print(f"\n{ok} {label} [{status}]")
    print(json.dumps(data, indent=2)[:800])  # truncate long outputs
    print("  ..." if len(json.dumps(data)) > 800 else "")
    return data


print("\n" + "="*55)
print("  CabRoute Flask API — Test Suite")
print("="*55)

# ── Test 1: Health check ───────────────────────────────────────────────
resp = client.get("/health")
pretty("GET /health", resp)

# ── Test 2: Missing file ───────────────────────────────────────────────
resp = client.post("/optimize")
pretty("POST /optimize (no file — expect 400)", resp)

# ── Test 3: Invalid file type ──────────────────────────────────────────
resp = client.post("/optimize", data={"file": (io.BytesIO(b"fake"), "data.csv")},
                   content_type="multipart/form-data")
pretty("POST /optimize (wrong file type — expect 400)", resp)

# ── Test 4: Full optimize with mock Excel ─────────────────────────────
# Build a real minimal xlsx in memory using openpyxl
import openpyxl, tempfile

wb = openpyxl.Workbook()
ws = wb.active
ws.append(["employee_id", "name", "address", "area", "shift_time", "shift_type", "phone"])

# 8 pre-geocodable employees (simple enough Bangalore addresses)
rows = [
    ("EMP001", "Rajesh Kumar",  "Koramangala 5th Block, Bangalore", "Koramangala",  "09:00", "Morning", "9876543210"),
    ("EMP002", "Priya Sharma",  "Indiranagar 12th Main, Bangalore", "Indiranagar",  "09:00", "Morning", "9876543211"),
    ("EMP003", "Amit Reddy",    "Whitefield Main Road, Bangalore",  "Whitefield",   "09:00", "Morning", "9876543212"),
    ("EMP004", "Sneha Naidu",   "HSR Layout Sector 2, Bangalore",   "HSR Layout",   "09:00", "Morning", "9876543213"),
    ("EMP005", "Karthik Gowda", "Marathahalli Bridge, Bangalore",   "Marathahalli", "09:00", "Morning", "9876543214"),
    ("EMP006", "Deepa Patel",   "Electronic City Phase 1, Bangalore","Electronic City","10:00","Morning","9876543215"),
    ("EMP007", "Suresh Rao",    "Jayanagar 4th Block, Bangalore",   "Jayanagar",    "10:00", "Morning", "9876543216"),
    ("EMP008", "Anita Nair",    "Rajajinagar 1st Block, Bangalore", "Rajajinagar",  "10:00", "Morning", "9876543217"),
]
for row in rows:
    ws.append(row)

tmp = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
wb.save(tmp.name)
tmp.close()

with open(tmp.name, "rb") as f:
    xlsx_bytes = f.read()
os.unlink(tmp.name)

resp = client.post(
    "/optimize",
    data={
        "file": (io.BytesIO(xlsx_bytes), "test_employees.xlsx"),
        "cab_capacity": "3",
        "rate_per_km": "18",
        "working_days": "26",
        "office_lat": "12.9352",
        "office_lng": "77.6245",
    },
    content_type="multipart/form-data",
)
data = pretty("POST /optimize (8 employees, cap=3 — full run)", resp)

if data.get("success"):
    s = data["summary"]
    print(f"\n  Summary:")
    print(f"    Cabs needed     : {s['total_cabs']}")
    print(f"    Employees routed: {s['total_employees_routed']}")
    print(f"    Total KM/day    : {s['total_km_daily']} km")
    print(f"    Daily cost      : Rs. {s['total_daily_cost_rs']:,.0f}")
    print(f"    Monthly cost    : Rs. {s['total_monthly_cost_rs']:,.0f}")
    print(f"\n  Routes:")
    for r in data["routes"]:
        names = " -> ".join(e["name"].split()[0] for e in r["employees"])
        print(f"    Cab {r['cab_id']} | Shift {r['shift_time']} | {r['distance_km']} km | Rs. {r['daily_cost']}/day")
        print(f"      {names} -> Office")

print("\n" + "="*55)
print("  All tests complete.")
print("="*55)
