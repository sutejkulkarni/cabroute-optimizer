"""
clusterer.py
Groups employees into cab clusters using K-Means.
K = ceil(employee_count / cab_capacity) — one cluster = one cab.
Employees are first split by shift_time, then clustered within each shift.
"""

import math
from sklearn.cluster import KMeans
import numpy as np


def cluster_by_shift(employees: list[dict], cab_capacity: int = 6) -> dict[str, list[list[dict]]]:
    """
    Main entry point. Returns a dict keyed by shift_time.
    Each value is a list of clusters (each cluster = list of employee dicts).

    Example output:
    {
        "09:00": [ [emp1, emp2, emp3], [emp4, emp5, emp6] ],
        "10:00": [ [emp7, emp8] ]
    }
    """
    # Filter to only geocoded employees
    valid = [e for e in employees if e.get("geocoded")]
    skipped = len(employees) - len(valid)
    if skipped:
        print(f"[clusterer] Skipping {skipped} employees with failed geocoding")

    # Group by shift_time first
    shift_groups: dict[str, list[dict]] = {}
    for emp in valid:
        shift = emp.get("shift_time", "09:00")
        shift_groups.setdefault(shift, []).append(emp)

    result = {}
    for shift, group in shift_groups.items():
        print(f"[clusterer] Shift {shift}: {len(group)} employees -> ", end="")
        clusters = _kmeans_cluster(group, cab_capacity)
        print(f"{len(clusters)} cabs (capacity {cab_capacity})")
        result[shift] = clusters

    return result


def _kmeans_cluster(employees: list[dict], cab_capacity: int) -> list[list[dict]]:
    """
    Runs K-Means on a single shift group.
    Returns list of clusters.
    """
    n = len(employees)

    # Edge case: fits in one cab
    if n <= cab_capacity:
        return [employees]

    k = math.ceil(n / cab_capacity)
    coords = np.array([[e["lat"], e["lng"]] for e in employees])

    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(coords)

    clusters: dict[int, list[dict]] = {}
    for emp, label in zip(employees, labels):
        emp["cluster_id"] = int(label)
        clusters.setdefault(int(label), []).append(emp)

    return list(clusters.values())


def print_cluster_summary(shift_clusters: dict) -> None:
    total_cabs = sum(len(clusters) for clusters in shift_clusters.values())
    print(f"\n[clusterer] Summary: {total_cabs} total cabs across {len(shift_clusters)} shift(s)")
    for shift, clusters in shift_clusters.items():
        for i, cluster in enumerate(clusters):
            areas = list({e["area"] for e in cluster})
            print(f"  Shift {shift} | Cab {i+1}: {len(cluster)} employees | Areas: {', '.join(areas)}")
