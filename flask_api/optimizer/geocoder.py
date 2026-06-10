"""
geocoder.py
Converts address strings to lat/lng using Nominatim (OpenStreetMap).
Free, no API key needed. Rate limited to 1 req/sec per OSM policy.
Includes in-memory cache to avoid re-geocoding duplicate addresses.
"""

import time
import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {"User-Agent": "CabRouteOptimizer/1.0 (portfolio-project)"}

_cache = {}

def geocode_address(address: str) -> tuple[float, float] | None:
    """
    Returns (lat, lng) for a given address string.
    Returns None if geocoding fails.
    """
    if address in _cache:
        return _cache[address]

    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={"q": address, "format": "json", "limit": 1},
            headers=HEADERS,
            timeout=10,
        )
        data = resp.json()
        if data:
            lat = float(data[0]["lat"])
            lng = float(data[0]["lon"])
            _cache[address] = (lat, lng)
            time.sleep(1.1)  # OSM fair use: max 1 req/sec
            return (lat, lng)
    except Exception as e:
        print(f"  [geocoder] Failed for '{address}': {e}")

    _cache[address] = None
    return None


def geocode_employees(employees: list[dict]) -> list[dict]:
    """
    Adds 'lat' and 'lng' fields to each employee dict.
    Skips employees where geocoding fails (flags them with geocoded=False).
    """
    print(f"[geocoder] Geocoding {len(employees)} employees...")
    success, failed = 0, 0

    for i, emp in enumerate(employees):
        coords = geocode_address(emp["address"])
        if coords:
            emp["lat"], emp["lng"] = coords
            emp["geocoded"] = True
            success += 1
        else:
            emp["lat"], emp["lng"] = None, None
            emp["geocoded"] = False
            failed += 1
        print(f"  [{i+1}/{len(employees)}] {emp['name']} ({emp['area']}) -> {coords}")

    print(f"[geocoder] Done. Success: {success}, Failed: {failed}")
    return employees
