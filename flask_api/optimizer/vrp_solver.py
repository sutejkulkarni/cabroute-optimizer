"""
vrp_solver.py
Solves the Vehicle Routing Problem (VRP) per cluster using Google OR-Tools.
Each cluster has exactly 1 vehicle (cab). Finds optimal pickup sequence
that minimizes total travel distance, starting and ending at the office depot.
"""

from ortools.constraint_solver import routing_enums_pb2, pywrapcp
from .distance_matrix import get_distance_matrix


DEPOT_INDEX = 0  # Office is always index 0 in the locations list


def solve_route(cluster_employees: list[dict], depot: tuple[float, float]) -> dict:
    """
    Solves optimal pickup order for a single cab cluster.

    Args:
        cluster_employees: List of employee dicts with lat/lng.
        depot: (lat, lng) of the office.

    Returns dict with:
        - ordered_employees: employees in pickup sequence
        - waypoints: [(lat, lng), ...] in order (depot last)
        - distance_m: total route distance in meters
        - distance_km: total route distance in km
    """
    # Build locations list: depot first, then employees
    locations = [depot] + [(e["lat"], e["lng"]) for e in cluster_employees]
    n = len(locations)

    # Get distance matrix (road network via OSRM)
    dist_matrix = get_distance_matrix(locations)

    # OR-Tools expects integer distances
    int_matrix = [[int(d) for d in row] for row in dist_matrix]

    # Setup OR-Tools routing model
    manager = pywrapcp.RoutingIndexManager(n, 1, DEPOT_INDEX)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_idx, to_idx):
        i = manager.IndexToNode(from_idx)
        j = manager.IndexToNode(to_idx)
        return int_matrix[i][j]

    transit_cb_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_cb_index)

    # Search parameters — guided local search for better solutions
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_params.time_limit.seconds = 10

    solution = routing.SolveWithParameters(search_params)

    if solution:
        return _extract_solution(solution, routing, manager, locations, cluster_employees)
    else:
        # Fallback: return employees in original order if solver fails
        print("  [vrp_solver] OR-Tools found no solution, using original order as fallback")
        return _fallback_route(locations, cluster_employees, int_matrix)


def _extract_solution(solution, routing, manager, locations, employees) -> dict:
    """Extracts the ordered route from OR-Tools solution."""
    index = routing.Start(0)
    ordered_indices = []

    while not routing.IsEnd(index):
        node = manager.IndexToNode(index)
        ordered_indices.append(node)
        index = solution.Value(routing.NextVar(index))

    # ordered_indices[0] is depot (0), rest are employee indices (1-based)
    employee_order = [i - 1 for i in ordered_indices if i != DEPOT_INDEX]
    ordered_employees = [employees[i] for i in employee_order]

    # Build waypoints: pickup stops + depot at end
    waypoints = [(employees[i]["lat"], employees[i]["lng"]) for i in employee_order]
    waypoints.append(locations[DEPOT_INDEX])  # office at end

    # Calculate total distance
    dist_matrix = [
        [0] * len(locations) for _ in range(len(locations))
    ]
    # Re-use the solution's objective value (in meters)
    distance_m = solution.ObjectiveValue()
    distance_km = round(distance_m / 1000, 2)

    return {
        "ordered_employees": ordered_employees,
        "waypoints": waypoints,
        "distance_m": distance_m,
        "distance_km": distance_km,
        "solver": "ortools",
    }


def _fallback_route(locations, employees, int_matrix) -> dict:
    """Nearest-neighbor greedy fallback if OR-Tools fails."""
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

    total_dist += int_matrix[current][0]  # return to depot

    ordered_employees = [employees[i - 1] for i in route]
    waypoints = [(employees[i - 1]["lat"], employees[i - 1]["lng"]) for i in route]
    waypoints.append(locations[0])

    return {
        "ordered_employees": ordered_employees,
        "waypoints": waypoints,
        "distance_m": total_dist,
        "distance_km": round(total_dist / 1000, 2),
        "solver": "fallback_nearest_neighbor",
    }


def solve_all_routes(shift_clusters: dict, depot: tuple[float, float]) -> list[dict]:
    """
    Solves routes for all shifts and clusters.
    Returns a flat list of route dicts, each with cab_id, shift_time, etc.
    """
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
