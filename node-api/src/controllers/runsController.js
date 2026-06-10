// src/controllers/runsController.js
// Business logic for all /api/runs endpoints.
// Handles upload, delegates to Flask, saves to MongoDB, returns JSON.

const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const Run = require("../models/Run");
const { checkHealth, runOptimization, testGeocode } = require("../services/flaskService");

// ── POST /api/runs/upload ──────────────────────────────────────────────
// 1. Validate uploaded file
// 2. Ping Flask health check
// 3. Call Flask /optimize
// 4. Save result to MongoDB
// 5. Return result to React
const uploadAndOptimize = async (req, res) => {
  const filePath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded. Send as multipart/form-data with key 'file'." });
    }

    // Parse config from request body (all optional, fall back to .env defaults)
    const config = {
      cab_capacity: parseFloat(req.body.cab_capacity) || undefined,
      rate_per_km:  parseFloat(req.body.rate_per_km)  || undefined,
      working_days: parseInt(req.body.working_days)   || undefined,
      office_lat:   parseFloat(req.body.office_lat)   || undefined,
      office_lng:   parseFloat(req.body.office_lng)   || undefined,
    };

    // Ping Flask before sending large file
    await checkHealth();

    // Create a pending run record in MongoDB
    const run_id = uuidv4();
    const run = await Run.create({
      run_id,
      original_filename: req.file.originalname,
      status: "processing",
      config,
    });

    console.log(`[runs] Starting optimization run ${run_id} for '${req.file.originalname}'`);

    // Call Flask optimizer
    let flaskResult;
    try {
      flaskResult = await runOptimization(filePath, config);
    } catch (flaskErr) {
      // Save error state to MongoDB so history shows it failed
      await Run.findOneAndUpdate(
        { run_id },
        { status: "error", error_message: flaskErr.message }
      );
      const status = flaskErr.statusCode || 500;
      return res.status(status).json({ success: false, error: flaskErr.message });
    }

    // Save complete result to MongoDB
    await Run.findOneAndUpdate(
      { run_id },
      {
        status: "complete",
        summary: flaskResult.summary,
        routes: flaskResult.routes,
        config: flaskResult.config,
        skipped_employees: flaskResult.skipped_employees || [],
        error_message: null,
      }
    );

    console.log(`[runs] Run ${run_id} complete — ${flaskResult.summary.total_cabs} cabs, Rs. ${flaskResult.summary.total_monthly_cost_rs}/month`);

    return res.status(200).json({
      success: true,
      run_id,
      summary: flaskResult.summary,
      routes: flaskResult.routes,
      skipped_employees: flaskResult.skipped_employees,
      config: flaskResult.config,
    });

  } finally {
    // Always clean up uploaded temp file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
};

// ── GET /api/runs ──────────────────────────────────────────────────────
// Returns list of all runs (for history page) — no routes, just metadata
const getAllRuns = async (_req, res) => {
  const runs = await Run.find({})
    .select("run_id original_filename status summary.total_cabs summary.total_monthly_cost_rs summary.total_employees_routed createdAt config")
    .sort({ createdAt: -1 })
    .limit(50);

  res.json({ success: true, count: runs.length, runs });
};

// ── GET /api/runs/:run_id ──────────────────────────────────────────────
// Returns full run result (routes, summary, config)
const getRunById = async (req, res) => {
  const run = await Run.findOne({ run_id: req.params.run_id });
  if (!run) {
    return res.status(404).json({ success: false, error: `Run '${req.params.run_id}' not found.` });
  }
  res.json({ success: true, run });
};

// ── DELETE /api/runs/:run_id ───────────────────────────────────────────
const deleteRun = async (req, res) => {
  const result = await Run.findOneAndDelete({ run_id: req.params.run_id });
  if (!result) {
    return res.status(404).json({ success: false, error: `Run '${req.params.run_id}' not found.` });
  }
  res.json({ success: true, message: `Run ${req.params.run_id} deleted.` });
};

// ── GET /api/runs/health ───────────────────────────────────────────────
// Checks both Node and Flask are alive — useful for frontend on load
const healthCheck = async (_req, res) => {
  const flask = await checkHealth().catch(err => ({ status: "error", error: err.message }));
  res.json({
    success: true,
    node: { status: "ok", version: process.version },
    flask,
  });
};

// ── POST /api/runs/geocode-test ────────────────────────────────────────
const geocodeTest = async (req, res) => {
  const { address } = req.body;
  if (!address) {
    return res.status(400).json({ success: false, error: "Provide { address } in request body." });
  }
  const result = await testGeocode(address);
  res.json(result);
};

// ── GET /api/runs/config/defaults ─────────────────────────────────────
const getDefaults = async (_req, res) => {
  res.json({
    success: true,
    defaults: {
      cab_capacity:  parseInt(process.env.DEFAULT_CAB_CAPACITY)  || 6,
      rate_per_km:   parseFloat(process.env.DEFAULT_RATE_PER_KM) || 18,
      working_days:  parseInt(process.env.DEFAULT_WORKING_DAYS)  || 26,
      office_lat:    parseFloat(process.env.DEFAULT_OFFICE_LAT)  || 12.9352,
      office_lng:    parseFloat(process.env.DEFAULT_OFFICE_LNG)  || 77.6245,
    },
  });
};

module.exports = {
  uploadAndOptimize,
  getAllRuns,
  getRunById,
  deleteRun,
  healthCheck,
  geocodeTest,
  getDefaults,
};
