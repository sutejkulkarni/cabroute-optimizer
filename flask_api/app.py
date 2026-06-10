"""
app.py
CabRoute Optimizer — Flask API Server

Endpoints:
    POST /optimize        — Upload Excel, run full pipeline, return routes + summary
    POST /geocode-test    — Test geocoding a single address (debug utility)
    GET  /health          — Health check for Node.js to ping before calling

Run locally:
    python app.py

Production (via gunicorn):
    gunicorn -w 2 -b 0.0.0.0:5001 app:app
"""

import os
import uuid
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS

from optimizer.excel_reader import read_employees
from optimizer.geocoder import geocode_employees
from optimizer.clusterer import cluster_by_shift
from optimizer.vrp_solver import solve_all_routes
from optimizer.cost_calculator import calculate_costs, build_summary

app = Flask(__name__)
CORS(app)  # Allow Node.js backend on different port to call this

ALLOWED_EXTENSIONS = {"xlsx", "xls"}
MAX_EMPLOYEES = 1000


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ── POST /optimize ─────────────────────────────────────────────────────
@app.route("/optimize", methods=["POST"])
def optimize():
    """
    Accepts multipart/form-data with:
        file         — Excel file (required)
        cab_capacity — int, default 6
        rate_per_km  — float, default 18.0
        working_days — int, default 26
        office_lat   — float, default 12.9352
        office_lng   — float, default 77.6245

    Returns JSON:
        { success, summary, routes, config, skipped_employees }
    """
    # --- Validate file ---
    if "file" not in request.files:
        return jsonify({"success": False, "error": "No file provided. Send as multipart/form-data with key 'file'."}), 400

    file = request.files["file"]
    if not file.filename or not allowed_file(file.filename):
        return jsonify({"success": False, "error": "Invalid file type. Only .xlsx and .xls are accepted."}), 400

    # --- Parse config from form fields ---
    try:
        cab_capacity  = int(request.form.get("cab_capacity", 6))
        rate_per_km   = float(request.form.get("rate_per_km", 18.0))
        working_days  = int(request.form.get("working_days", 26))
        office_lat    = float(request.form.get("office_lat", 12.9352))
        office_lng    = float(request.form.get("office_lng", 77.6245))
    except ValueError as e:
        return jsonify({"success": False, "error": f"Invalid config parameter: {e}"}), 400

    if not (1 <= cab_capacity <= 20):
        return jsonify({"success": False, "error": "cab_capacity must be between 1 and 20."}), 400
    if not (5 <= rate_per_km <= 200):
        return jsonify({"success": False, "error": "rate_per_km must be between 5 and 200."}), 400

    # --- Save uploaded file to temp location ---
    tmp_path = os.path.join(tempfile.gettempdir(), f"cabroute_{uuid.uuid4().hex}.xlsx")
    try:
        file.save(tmp_path)

        # --- Step 1: Read Excel ---
        try:
            employees = read_employees(tmp_path)
        except ValueError as e:
            return jsonify({"success": False, "error": str(e)}), 422

        if len(employees) > MAX_EMPLOYEES:
            return jsonify({"success": False, "error": f"Too many employees ({len(employees)}). Max allowed: {MAX_EMPLOYEES}."}), 422

        if len(employees) < 2:
            return jsonify({"success": False, "error": "At least 2 employees are required to optimize routes."}), 422

        # --- Step 2: Geocode ---
        employees = geocode_employees(employees)

        geocoded_count = sum(1 for e in employees if e.get("geocoded"))
        if geocoded_count < 1:
            return jsonify({
                "success": False,
                "error": "Geocoding failed for almost all employees. Check that addresses include locality and city (e.g. 'Koramangala, Bangalore')."
            }), 422

        # --- Step 3: Cluster ---
        shift_clusters = cluster_by_shift(employees, cab_capacity=cab_capacity)

        # --- Step 4: Solve routes ---
        depot = (office_lat, office_lng)
        routes = solve_all_routes(shift_clusters, depot=depot)

        # --- Step 5: Costs ---
        routes = calculate_costs(routes, rate_per_km=rate_per_km, working_days=working_days)
        summary = build_summary(routes, employees, working_days=working_days)

        # --- Serialize routes for JSON ---
        serialized_routes = _serialize_routes(routes)

        # --- Skipped employees (geocode failed) ---
        skipped = [
            {"employee_id": e["employee_id"], "name": e["name"], "address": e["address"]}
            for e in employees if not e.get("geocoded")
        ]

        return jsonify({
            "success": True,
            "summary": summary,
            "routes": serialized_routes,
            "skipped_employees": skipped,
            "config": {
                "cab_capacity": cab_capacity,
                "rate_per_km": rate_per_km,
                "working_days": working_days,
                "office": {"lat": office_lat, "lng": office_lng},
            }
        }), 200

    except Exception as e:
        app.logger.error(f"Unexpected error in /optimize: {e}", exc_info=True)
        return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500

    finally:
        # Always clean up temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# ── POST /geocode-test ─────────────────────────────────────────────────
@app.route("/geocode-test", methods=["POST"])
def geocode_test():
    """
    Debug endpoint. Tests geocoding a single address.
    Body: { "address": "14, Koramangala 5th Block, Bangalore" }
    """
    data = request.get_json()
    if not data or "address" not in data:
        return jsonify({"success": False, "error": "Provide { address: '...' } in JSON body."}), 400

    from optimizer.geocoder import geocode_address
    coords = geocode_address(data["address"])

    if coords:
        return jsonify({"success": True, "address": data["address"], "lat": coords[0], "lng": coords[1]}), 200
    else:
        return jsonify({"success": False, "error": "Could not geocode this address. Try adding area and city."}), 422


# ── GET /health ────────────────────────────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    """Node.js pings this before sending a job to check Python service is up."""
    return jsonify({"status": "ok", "service": "cabroute-optimizer", "version": "1.0.0"}), 200


# ── Helpers ────────────────────────────────────────────────────────────
def _serialize_routes(routes: list[dict]) -> list[dict]:
    """
    Converts route dicts to JSON-safe format.
    Trims employee data to only what the frontend needs.
    """
    serialized = []
    for r in routes:
        serialized.append({
            "cab_id": r["cab_id"],
            "shift_time": r["shift_time"],
            "employee_count": r["employee_count"],
            "distance_km": r["distance_km"],
            "daily_cost": r["daily_cost"],
            "monthly_cost": r["monthly_cost"],
            "solver": r.get("solver", "ortools"),
            "waypoints": r["waypoints"],  # [(lat, lng), ...]
            "employees": [
                {
                    "employee_id": e["employee_id"],
                    "name": e["name"],
                    "area": e["area"],
                    "address": e["address"],
                    "lat": e["lat"],
                    "lng": e["lng"],
                    "pickup_order": idx + 1,
                }
                for idx, e in enumerate(r["ordered_employees"])
            ],
        })
    return serialized


if __name__ == "__main__":
    print("\n CabRoute Optimizer — Flask API")
    print(" Running on http://localhost:5001\n")
    app.run(host="0.0.0.0", port=5001, debug=True)
