"""
distance_matrix.py
Fetches real road-network distances between points using OSRM.
Uses the free public OSRM instance (router.project-osrm.org).
No API key needed.

Falls back to Haversine (straight-line) distance if OSRM is unavailable.
"""

import math
import requests

OSRM_TABLE_URL = "http://router.project-osrm.org/table/v1/driving/"


def get_distance_matrix(locations: list[tuple[float, float]]) -> list[list[float]]:
    """
    locations: list of (lat, lng) tuples — includes depot as index 0.
    Returns NxN matrix of distances in meters (road network via OSRM).
    Falls back to Haversine if OSRM call fails.
    """
    # OSRM expects lng,lat order
    coords_str = ";".join(f"{lng},{lat}" for lat, lng in locations)
    url = f"{OSRM_TABLE_URL}{coords_str}?annotations=distance"

    try:
        resp = requests.get(url, timeout=15)
        data = resp.json()
        if data.get("code") == "Ok":
            return data["distances"]
    except Exception as e:
        print(f"  [distance_matrix] OSRM failed: {e}. Falling back to Haversine.")

    return _haversine_matrix(locations)


def _haversine(lat1, lng1, lat2, lng2) -> float:
    """Straight-line distance in meters between two lat/lng points."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return 2 * R * math.asin(math.sqrt(a))


def _haversine_matrix(locations: list[tuple[float, float]]) -> list[list[float]]:
    n = len(locations)
    return [
        [_haversine(locations[i][0], locations[i][1], locations[j][0], locations[j][1]) for j in range(n)]
        for i in range(n)
    ]
