"""
vrp_solver.py - Uses nearest-neighbor heuristic (OR-Tools incompatible with Python 3.14)
"""
from .distance_matrix import get_distance_matrix

DEPOT_INDEX = 0

def solve_route(cluster_employees, depot):
    locations = [depot] + [(e["lat"], e["lng"]) for e in cluster_employees]
    dist_matrix = get_distance_matrix(locations)
    int_matrix = [[int(d) for d in row] for row in dist_matrix]
    return _fallback_route(locations, cluster_employees, int_matrix)

def _fallback_route(locations, employees, int_matrix):
    unvisited = list(range(1, len(locations)))
    route = []
    current = 0
    total_dist = 0
    while unvisited:
        nearest = min(unvisited, key=lambda j: int_matrix[current][j])
        total_dist += int_matrix[current][nearest]
        route.append(nearest)
        unvisited.remove(nearest)
        current = nearest
    total_dist += int_matrix[current][0]
    ordered_employees = [employees[i - 1] for i in route]
    waypoints = [(employees[i - 1]["lat"], employees[i - 1]["lng"]) for i in route]
    waypoints.append(locations[0])
    return {
        "ordered_employees": ordered_employees,
        "waypoints": waypoints,
        "distance_m": total_dist,
        "distance_km": round(total_dist / 1000, 2),
        "solver": "nearest_neighbor",
    }

def solve_all_routes(shift_clusters, depot):
    all_routes = []
    cab_id = 1
    for shift_time, clusters in shift_clusters.items():
        print(f"\n[vrp_solver] Solving routes for shift {shift_time} ({len(clusters)} cabs)...")
        for cluster in clusters:
            print(f"  Cab {cab_id}: {len(cluster)} employees", end=" -> ")
            route = solve_route(cluster, depot)
            route["cab_id"] = cab_id
            route["shift_time"] = shift_time
            route["employee_count"] = len(cluster)
            print(f"{route['distance_km']} km [{route['solver']}]")
            all_routes.append(route)
            cab_id += 1
    return all_routes
