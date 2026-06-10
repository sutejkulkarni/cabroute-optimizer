// src/app.js
// Express app setup — middleware, routes, error handler.
// Kept separate from server.js so it's testable without starting a real server.

require("express-async-errors");   // patches async functions — must be first
const express = require("express");
const cors    = require("cors");
const morgan  = require("morgan");

const runsRouter    = require("./routes/runs");
const errorHandler  = require("./middleware/errorHandler");

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP request logging (skip in test)
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ── Routes ─────────────────────────────────────────────────────────────
app.use("/api/runs", runsRouter);

// Root — confirms server is alive
app.get("/", (_req, res) => {
  res.json({ service: "cabroute-api", status: "ok", version: "1.0.0" });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found." });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
