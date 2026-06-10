"""
main.py
CabRoute Optimizer — Main Pipeline

Usage:
    python main.py --file <path_to_excel> [--capacity 6] [--rate 18] [--days 26]
                   [--office-lat 12.9352] [--office-lng 77.6245]

Runs the full optimization pipeline:
    1. Read Excel
    2. Geocode addresses (Nominatim/OSM)
    3. Cluster by shift + K-Means
    4. Solve VRP routes (OR-Tools)
    5. Calculate costs
    6. Output JSON result
"""

import argparse
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from optimizer.excel_reader import read_employees
from optimizer.geocoder import geocode_employees
from optimizer.clusterer import cluster_by_shift, print_cluster_summary
from optimizer.vrp_solver import solve_all_routes
from optimizer.cost_calculator import calculate_costs, build_summary


def run_pipeline(
    filepath: str,
    cab_capacity: int = 6,
    rate_per_km: float = 18.0,
    working_days: int = 26,
    office_lat: float = 12.9352,
    office_lng: float = 77.6245,
) -> dict:

    print("\n" + "="*55)
    print("  CabRoute Optimizer — Starting Pipeline")
    print("="*55)

    # Step 1: Read Excel
    print("\n[Step 1/5] Reading Excel...")
    employees = read_employees(filepath)

    # Step 2: Geocode
    print(f"\n[Step 2/5] Geocoding {len(employees)} addresses (this takes ~{len(employees)} seconds)...")
    employees = geocode_employees(employees)

    # Step 3: Cluster
    print(f"\n[Step 3/5] Clustering employees (cab capacity: {cab_capacity})...")
    shift_clusters = cluster_by_shift(employees, cab_capacity=cab_capacity)
    print_cluster_summary(shift_clusters)

    # Step 4: Solve routes
    print(f"\n[Step 4/5] Solving VRP routes (OR-Tools)...")
    depot = (office_lat, office_lng)
    routes = solve_all_routes(shift_clusters, depot=depot)

    # Step 5: Calculate costs
    print(f"\n[Step 5/5] Calculating costs (Rs. {rate_per_km}/km, {working_days} days/month)...")
    routes = calculate_costs(routes, rate_per_km=rate_per_km, working_days=working_days)
    summary = build_summary(routes, employees, working_days=working_days)

    result = {
        "summary": summary,
        "routes": routes,
        "config": {
            "cab_capacity": cab_capacity,
            "rate_per_km": rate_per_km,
            "working_days": working_days,
            "office": {"lat": office_lat, "lng": office_lng},
        },
    }

    # Print summary
    print("\n" + "="*55)
    print("  RESULTS SUMMARY")
    print("="*55)
    print(f"  Total Employees Routed : {summary['total_employees_routed']}")
    print(f"  Total Cabs Needed      : {summary['total_cabs']}")
    print(f"  Total Distance/Day     : {summary['total_km_daily']} km")
    print(f"  Daily Cost             : Rs. {summary['total_daily_cost_rs']:,.0f}")
    print(f"  Monthly Cost           : Rs. {summary['total_monthly_cost_rs']:,.0f}")
    if summary['total_employees_skipped']:
        print(f"  Skipped (geocode fail) : {summary['total_employees_skipped']}")
    print("="*55)

    print("\n  By Shift:")
    for shift, data in summary["by_shift"].items():
        print(f"    {shift}  ->  {data['cabs']} cabs, {data['employees']} employees, Rs. {data['daily_cost']:,.0f}/day")

    print("\n  Top 5 Routes (by distance):")
    for r in sorted(routes, key=lambda x: -x["distance_km"])[:5]:
        print(f"    Cab {r['cab_id']} | Shift {r['shift_time']} | {r['employee_count']} pax | "
              f"{r['distance_km']} km | Rs. {r['daily_cost']:,.0f}/day")

    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CabRoute Optimizer")
    parser.add_argument("--file",        required=True,      help="Path to employee Excel file")
    parser.add_argument("--capacity",    type=int,   default=6,      help="Max employees per cab")
    parser.add_argument("--rate",        type=float, default=18.0,   help="Rate per km in Rs.")
    parser.add_argument("--days",        type=int,   default=26,     help="Working days per month")
    parser.add_argument("--office-lat",  type=float, default=12.9352,help="Office latitude")
    parser.add_argument("--office-lng",  type=float, default=77.6245,help="Office longitude")
    parser.add_argument("--output",      default=None,               help="Save result JSON to file")
    args = parser.parse_args()

    result = run_pipeline(
        filepath=args.file,
        cab_capacity=args.capacity,
        rate_per_km=args.rate,
        working_days=args.days,
        office_lat=args.office_lat,
        office_lng=args.office_lng,
    )

    if args.output:
        with open(args.output, "w") as f:
            json.dump(result, f, indent=2, default=str)
        print(f"\n[main] Result saved to {args.output}")
