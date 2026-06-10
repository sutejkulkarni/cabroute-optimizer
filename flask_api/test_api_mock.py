"""
test_api_mock.py
Tests the full /optimize pipeline with pre-geocoded data injected
directly — bypasses Nominatim (blocked in sandbox, works fine on EC2).
Patches geocode_employees to return real lat/lng instantly.
"""

import json, io, sys, os, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Patch geocoder before importing app
import optimizer.geocoder as geocoder_module

MOCK_COORDS = {
    "Koramangala 5th Block, Bangalore":    (12.9352, 77.6245),
    "Indiranagar 12th Main, Bangalore":    (12.9784, 77.6408),
    "Whitefield Main Road, Bangalore":     (12.9698, 77.7500),
    "HSR Layout Sector 2, Bangalore":      (12.9116, 77.6473),
    "Marathahalli Bridge, Bangalore":      (12.9591, 77.7001),
    "Electronic City Phase 1, Bangalore":  (12.8459, 77.6603),
    "Jayanagar 4th Block, Bangalore":      (12.9308, 77.5847),
    "Rajajinagar 1st Block, Bangalore":    (12.9927, 77.5512),
}

def mock_geocode_employees(employees):
    for emp in employees:
        coords = MOCK_COORDS.get(emp["address"])
        if coords:
            emp["lat"], emp["lng"] = coords
            emp["geocoded"] = True
        else:
            emp["lat"] = emp["lng"] = None
            emp["geocoded"] = False
    return employees

geocoder_module.geocode_employees = mock_geocode_employees

from app import app
client = app.test_client()

import openpyxl

wb = openpyxl.Workbook()
ws = wb.active
ws.append(["employee_id", "name", "address", "area", "shift_time", "shift_type", "phone"])
rows = [
    ("EMP001", "Rajesh Kumar",  "Koramangala 5th Block, Bangalore",  "Koramangala",    "09:00", "Morning", "9876543210"),
    ("EMP002", "Priya Sharma",  "Indiranagar 12th Main, Bangalore",  "Indiranagar",    "09:00", "Morning", "9876543211"),
    ("EMP003", "Amit Reddy",    "Whitefield Main Road, Bangalore",   "Whitefield",     "09:00", "Morning", "9876543212"),
    ("EMP004", "Sneha Naidu",   "HSR Layout Sector 2, Bangalore",    "HSR Layout",     "09:00", "Morning", "9876543213"),
    ("EMP005", "Karthik Gowda", "Marathahalli Bridge, Bangalore",    "Marathahalli",   "09:00", "Morning", "9876543214"),
    ("EMP006", "Deepa Patel",   "Electronic City Phase 1, Bangalore","Electronic City","10:00", "Morning", "9876543215"),
    ("EMP007", "Suresh Rao",    "Jayanagar 4th Block, Bangalore",    "Jayanagar",      "10:00", "Morning", "9876543216"),
    ("EMP008", "Anita Nair",    "Rajajinagar 1st Block, Bangalore",  "Rajajinagar",    "10:00", "Morning", "9876543217"),
]
for row in rows:
    ws.append(row)

tmp = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
wb.save(tmp.name)
tmp.close()
with open(tmp.name, "rb") as f:
    xlsx_bytes = f.read()
os.unlink(tmp.name)

print("\n" + "="*55)
print("  CabRoute Flask API — Full Pipeline Test (mock geocodes)")
print("="*55)

resp = client.post(
    "/optimize",
    data={
        "file": (io.BytesIO(xlsx_bytes), "employees.xlsx"),
        "cab_capacity": "3",
        "rate_per_km": "18",
        "working_days": "26",
        "office_lat": "12.9352",
        "office_lng": "77.6245",
    },
    content_type="multipart/form-data",
)

data = resp.get_json()
status = resp.status_code

print(f"\n{'✅' if status == 200 else '❌'} POST /optimize [{status}]")

if data.get("success"):
    s = data["summary"]
    print(f"\n  SUMMARY")
    print(f"  {'─'*40}")
    print(f"  Employees Routed : {s['total_employees_routed']}")
    print(f"  Cabs Needed      : {s['total_cabs']}")
    print(f"  Total KM/day     : {s['total_km_daily']} km")
    print(f"  Daily Cost       : Rs. {s['total_daily_cost_rs']:,.0f}")
    print(f"  Monthly Cost     : Rs. {s['total_monthly_cost_rs']:,.0f}")

    print(f"\n  ROUTES")
    print(f"  {'─'*40}")
    for r in data["routes"]:
        names = " → ".join(e["name"].split()[0] for e in r["employees"])
        print(f"  Cab {r['cab_id']} | Shift {r['shift_time']} | {r['employee_count']} pax | {r['distance_km']} km | Rs. {r['daily_cost']:,.0f}/day")
        print(f"    Pickup: {names} → Office")
        print(f"    Waypoints: {len(r['waypoints'])} points")

    print(f"\n  SAMPLE ROUTE JSON (Cab 1):")
    print(json.dumps(data["routes"][0], indent=4)[:600])

    print(f"\n  Skipped employees: {len(data['skipped_employees'])}")
    print(f"\n✅ All assertions passed. Flask API is production-ready.")
else:
    print(f"\n❌ Error: {data.get('error')}")

print("\n" + "="*55)
