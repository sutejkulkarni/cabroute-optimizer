// src/models/Run.js
// Mongoose schema for a single optimization run

const mongoose = require("mongoose");

// Individual employee within a route (pickup order)
const RouteEmployeeSchema = new mongoose.Schema({
  employee_id:  { type: String, required: true },
  name:         { type: String, required: true },
  area:         { type: String },
  address:      { type: String },
  lat:          { type: Number },
  lng:          { type: Number },
  pickup_order: { type: Number },
}, { _id: false });

// A single cab route
const RouteSchema = new mongoose.Schema({
  cab_id:         { type: Number, required: true },
  shift_time:     { type: String, required: true },
  employee_count: { type: Number },
  distance_km:    { type: Number },
  daily_cost:     { type: Number },
  monthly_cost:   { type: Number },
  solver:         { type: String },
  waypoints:      { type: [[Number]] },   // [[lat, lng], ...]
  employees:      [RouteEmployeeSchema],
}, { _id: false });

// Summary across all routes
const SummarySchema = new mongoose.Schema({
  total_cabs:               { type: Number },
  total_employees_routed:   { type: Number },
  total_employees_skipped:  { type: Number },
  total_km_daily:           { type: Number },
  total_daily_cost_rs:      { type: Number },
  total_monthly_cost_rs:    { type: Number },
  working_days:             { type: Number },
  by_shift:                 { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

// Config used for this run
const ConfigSchema = new mongoose.Schema({
  cab_capacity:  { type: Number },
  rate_per_km:   { type: Number },
  working_days:  { type: Number },
  office:        { lat: Number, lng: Number },
}, { _id: false });

// Top-level run document
const RunSchema = new mongoose.Schema({
  run_id:             { type: String, required: true, unique: true, index: true },
  original_filename:  { type: String },
  status:             { type: String, enum: ["processing", "complete", "error"], default: "processing" },
  error_message:      { type: String, default: null },
  config:             ConfigSchema,
  summary:            SummarySchema,
  routes:             [RouteSchema],
  skipped_employees:  { type: mongoose.Schema.Types.Mixed, default: [] },
}, {
  timestamps: true,   // adds createdAt, updatedAt automatically
});

module.exports = mongoose.model("Run", RunSchema);
