// src/services/api.js
// All HTTP calls to the Node.js backend.
// React never talks to Flask directly — always through Node.

import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
const api  = axios.create({ baseURL: BASE, timeout: 15 * 60 * 1000 });

// ── Health ─────────────────────────────────────────────────────────────
export const checkHealth = () =>
  api.get("/api/runs/health").then(r => r.data);

// ── Config defaults ────────────────────────────────────────────────────
export const getDefaults = () =>
  api.get("/api/runs/config/defaults").then(r => r.data.defaults);

// ── Upload + optimize ──────────────────────────────────────────────────
export const uploadAndOptimize = (file, config, onUploadProgress) => {
  const form = new FormData();
  form.append("file",         file);
  form.append("cab_capacity", config.cab_capacity);
  form.append("rate_per_km",  config.rate_per_km);
  form.append("working_days", config.working_days);
  form.append("office_lat",   config.office_lat);
  form.append("office_lng",   config.office_lng);

  return api.post("/api/runs/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress,
  }).then(r => r.data);
};

// ── Runs history ───────────────────────────────────────────────────────
export const getAllRuns = () =>
  api.get("/api/runs").then(r => r.data);

export const getRunById = (run_id) =>
  api.get(`/api/runs/${run_id}`).then(r => r.data.run);

export const deleteRun = (run_id) =>
  api.delete(`/api/runs/${run_id}`).then(r => r.data);
