"""
cost_calculator.py
Calculates daily and monthly cab costs based on route distances.
All rates are configurable.
"""


def calculate_costs(routes: list[dict], rate_per_km: float = 18.0, working_days: int = 26) -> list[dict]:
    """
    Adds cost fields to each route dict.
    rate_per_km: Rs. per km (default Rs. 18)
    working_days: working days per month (default 26)
    """
    for route in routes:
        route["daily_cost"] = round(route["distance_km"] * rate_per_km, 2)
        route["monthly_cost"] = round(route["daily_cost"] * working_days, 2)
    return routes


def build_summary(routes: list[dict], employees: list[dict], working_days: int = 26) -> dict:
    """
    Returns top-level summary across all routes.
    """
    total_cabs = len(routes)
    total_employees = sum(r["employee_count"] for r in routes)
    total_km_daily = round(sum(r["distance_km"] for r in routes), 2)
    total_daily_cost = round(sum(r["daily_cost"] for r in routes), 2)
    total_monthly_cost = round(sum(r["monthly_cost"] for r in routes), 2)

    shifts = {}
    for r in routes:
        s = r["shift_time"]
        shifts.setdefault(s, {"cabs": 0, "employees": 0, "daily_cost": 0})
        shifts[s]["cabs"] += 1
        shifts[s]["employees"] += r["employee_count"]
        shifts[s]["daily_cost"] = round(shifts[s]["daily_cost"] + r["daily_cost"], 2)

    skipped = len([e for e in employees if not e.get("geocoded", True)])

    return {
        "total_cabs": total_cabs,
        "total_employees_routed": total_employees,
        "total_employees_skipped": skipped,
        "total_km_daily": total_km_daily,
        "total_daily_cost_rs": total_daily_cost,
        "total_monthly_cost_rs": total_monthly_cost,
        "working_days": working_days,
        "by_shift": shifts,
    }
