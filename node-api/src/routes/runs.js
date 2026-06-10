// src/routes/runs.js
// All /api/runs routes wired to controller functions

const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const {
  uploadAndOptimize,
  getAllRuns,
  getRunById,
  deleteRun,
  healthCheck,
  geocodeTest,
  getDefaults,
} = require("../controllers/runsController");

// Health + utils
router.get(  "/health",          healthCheck);
router.post( "/geocode-test",    geocodeTest);
router.get(  "/config/defaults", getDefaults);

// Core run CRUD
router.post( "/upload",          upload.single("file"), uploadAndOptimize);
router.get(  "/",                getAllRuns);
router.get(  "/:run_id",         getRunById);
router.delete("/:run_id",        deleteRun);

module.exports = router;
