// src/services/flaskService.js
// Handles all HTTP communication with the Python Flask optimizer service.
// Node.js never touches optimization logic directly — it just calls Flask.

const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const FLASK_URL = process.env.FLASK_SERVICE_URL || "http://localhost:5001";
const TIMEOUT_MS = 10 * 60 * 1000; // 10 min — geocoding 1000 employees can take a while

// ── Health check ───────────────────────────────────────────────────────
const checkHealth = async () => {
  try {
    const res = await axios.get(`${FLASK_URL}/health`, { timeout: 5000 });
    return res.data;
  } catch (err) {
    throw new Error(`Flask service is unreachable at ${FLASK_URL}. Is it running?`);
  }
};

// ── Run full optimization ──────────────────────────────────────────────
const runOptimization = async (filePath, config = {}) => {
  const {
    cab_capacity  = process.env.DEFAULT_CAB_CAPACITY  || 6,
    rate_per_km   = process.env.DEFAULT_RATE_PER_KM   || 18,
    working_days  = process.env.DEFAULT_WORKING_DAYS  || 26,
    office_lat    = process.env.DEFAULT_OFFICE_LAT    || 12.9352,
    office_lng    = process.env.DEFAULT_OFFICE_LNG    || 77.6245,
  } = config;

  // Build multipart form — same format Flask expects
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));
  form.append("cab_capacity",  String(cab_capacity));
  form.append("rate_per_km",   String(rate_per_km));
  form.append("working_days",  String(working_days));
  form.append("office_lat",    String(office_lat));
  form.append("office_lng",    String(office_lng));

  try {
    const res = await axios.post(`${FLASK_URL}/optimize`, form, {
      headers: form.getHeaders(),
      timeout: TIMEOUT_MS,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    return res.data;  // { success, summary, routes, skipped_employees, config }
  } catch (err) {
    // Flask returned a 4xx/5xx with JSON error body
    if (err.response?.data) {
      const msg = err.response.data.error || "Optimization failed";
      const status = err.response.status;
      const error = new Error(msg);
      error.statusCode = status;
      throw error;
    }
    throw new Error(`Could not reach Flask optimizer: ${err.message}`);
  }
};

// ── Test geocode a single address ──────────────────────────────────────
const testGeocode = async (address) => {
  try {
    const res = await axios.post(
      `${FLASK_URL}/geocode-test`,
      { address },
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );
    return res.data;
  } catch (err) {
    if (err.response?.data) throw new Error(err.response.data.error);
    throw new Error(`Geocode test failed: ${err.message}`);
  }
};

module.exports = { checkHealth, runOptimization, testGeocode };
