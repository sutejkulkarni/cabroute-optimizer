"""
test_engine.py
Tests the full pipeline with pre-geocoded mock data (no live API calls).
Bypasses Nominatim so we can verify clustering + OR-Tools instantly.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from optimizer.clusterer import cluster_by_shift, print_cluster_summary
from optimizer.vrp_solver import solve_all_routes
from optimizer.cost_calculator import calculate_costs, build_summary

# 15 pre-geocoded Bangalore employees (real lat/lng)
MOCK_EMPLOYEES = [
    {"employee_id": "EMP001", "name": "Rajesh Kumar",    "area": "Koramangala",   "shift_time": "09:00", "lat": 12.9352, "lng": 77.6245, "geocoded": True},
    {"employee_id": "EMP002", "name": "Priya Sharma",    "area": "Indiranagar",   "shift_time": "09:00", "lat": 12.9784, "lng": 77.6408, "geocoded": True},
    {"employee_id": "EMP003", "name": "Amit Reddy",      "area": "Whitefield",    "shift_time": "09:00", "lat": 12.9698, "lng": 77.7500, "geocoded": True},
    {"employee_id": "EMP004", "name": "Sneha Naidu",     "area": "HSR Layout",    "shift_time": "09:00", "lat": 12.9116, "lng": 77.6473, "geocoded": True},
    {"employee_id": "EMP005", "name": "Karthik Gowda",   "area": "Marathahalli",  "shift_time": "09:00", "lat": 12.9591, "lng": 77.7001, "geocoded": True},
    {"employee_id": "EMP006", "name": "Deepa Patel",     "area": "Electronic City","shift_time": "09:00", "lat": 12.8459, "lng": 77.6603, "geocoded": True},
    {"employee_id": "EMP007", "name": "Suresh Rao",      "area": "Jayanagar",     "shift_time": "09:00", "lat": 12.9308, "lng": 77.5847, "geocoded": True},
    {"employee_id": "EMP008", "name": "Anita Nair",      "area": "Rajajinagar",   "shift_time": "09:00", "lat": 12.9927, "lng": 77.5512, "geocoded": True},
    {"employee_id": "EMP009", "name": "Vijay Iyer",      "area": "Malleswaram",   "shift_time": "09:00", "lat": 13.0035, "lng": 77.5710, "geocoded": True},
    {"employee_id": "EMP010", "name": "Lakshmi Hegde",   "area": "Bellandur",     "shift_time": "09:00", "lat": 12.9274, "lng": 77.6790, "geocoded": True},
    {"employee_id": "EMP011", "name": "Rahul Joshi",     "area": "Hebbal",        "shift_time": "10:00", "lat": 13.0358, "lng": 77.5970, "geocoded": True},
    {"employee_id": "EMP012", "name": "Pooja Pillai",    "area": "JP Nagar",      "shift_time": "10:00", "lat": 12.9063, "lng": 77.5857, "geocoded": True},
    {"employee_id": "EMP013", "name": "Arun Menon",      "area": "Yelahanka",     "shift_time": "10:00", "lat": 13.1007, "lng": 77.5963, "geocoded": True},
    {"employee_id": "EMP014", "name": "Divya Shetty",    "area": "Banashankari",  "shift_time": "10:00", "lat": 12.9260, "lng": 77.5460, "geocoded": True},
    {"employee_id": "EMP015", "name": "Sanjay Kamath",   "area": "Yeshwanthpur",  "shift_time": "10:00", "lat": 13.0284, "lng": 77.5400, "geocoded": True},
]

OFFICE_DEPOT = (12.9352, 77.6245)  # Koramangala (office)
CAB_CAPACITY = 4

print("\n" + "="*55)
print("  CabRoute Engine — Unit Test (mock data, no API)")
print("="*55)

# Step 1: Cluster
print(f"\n[Step 1] Clustering {len(MOCK_EMPLOYEES)} employees (capacity: {CAB_CAPACITY})...")
shift_clusters = cluster_by_shift(MOCK_EMPLOYEES, cab_capacity=CAB_CAPACITY)
print_cluster_summary(shift_clusters)

# Step 2: Solve routes
print(f"\n[Step 2] Running OR-Tools VRP solver...")
routes = solve_all_routes(shift_clusters, depot=OFFICE_DEPOT)

# Step 3: Costs
print(f"\n[Step 3] Calculating costs...")
routes = calculate_costs(routes, rate_per_km=18.0, working_days=26)
summary = build_summary(routes, MOCK_EMPLOYEES)

# Results
print("\n" + "="*55)
print("  TEST RESULTS")
print("="*55)
print(f"  Total Cabs    : {summary['total_cabs']}")
print(f"  Total KM/day  : {summary['total_km_daily']} km")
print(f"  Daily Cost    : Rs. {summary['total_daily_cost_rs']:,.0f}")
print(f"  Monthly Cost  : Rs. {summary['total_monthly_cost_rs']:,.0f}")

print("\n  Routes:")
for r in routes:
    names = " -> ".join(e["name"].split()[0] for e in r["ordered_employees"])
    print(f"    Cab {r['cab_id']} | Shift {r['shift_time']} | {r['distance_km']} km | "
          f"Rs. {r['daily_cost']:,.0f}/day")
    print(f"      Pickup: {names} -> Office")

print("\n[TEST PASSED] Engine working correctly.")
