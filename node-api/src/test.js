// src/test.js
// Tests all Node.js API endpoints by mocking MongoDB and Flask service.
// Run with: npm test
// No real MongoDB or Flask needed — pure Node logic test.

require("dotenv").config();
const http = require("http");
const path = require("path");
const fs   = require("fs");
const os   = require("os");

// ── Mock Flask service ─────────────────────────────────────────────────
const flaskService = require("./services/flaskService");

const MOCK_FLASK_RESULT = {
  success: true,
  summary: {
    total_cabs: 3,
    total_employees_routed: 8,
    total_employees_skipped: 0,
    total_km_daily: 85.6,
    total_daily_cost_rs: 1540.8,
    total_monthly_cost_rs: 40060.8,
    working_days: 26,
    by_shift: {
      "09:00": { cabs: 2, employees: 5, daily_cost: 800 },
      "10:00": { cabs: 1, employees: 3, daily_cost: 740 },
    },
  },
  routes: [
    {
      cab_id: 1, shift_time: "09:00", employee_count: 3,
      distance_km: 16.18, daily_cost: 291.24, monthly_cost: 7572.24,
      solver: "ortools",
      waypoints: [[12.9352, 77.6245], [12.9116, 77.6473], [12.9352, 77.6245]],
      employees: [
        { employee_id: "EMP001", name: "Rajesh Kumar", area: "Koramangala", address: "Koramangala, Bangalore", lat: 12.9352, lng: 77.6245, pickup_order: 1 },
        { employee_id: "EMP004", name: "Sneha Naidu",  area: "HSR Layout",  address: "HSR Layout, Bangalore",  lat: 12.9116, lng: 77.6473, pickup_order: 2 },
      ],
    },
  ],
  skipped_employees: [],
  config: { cab_capacity: 6, rate_per_km: 18, working_days: 26, office: { lat: 12.9352, lng: 77.6245 } },
};

flaskService.checkHealth    = async () => ({ status: "ok", service: "cabroute-optimizer", version: "1.0.0" });
flaskService.runOptimization = async () => MOCK_FLASK_RESULT;
flaskService.testGeocode    = async (address) => ({ success: true, address, lat: 12.9352, lng: 77.6245 });

// ── Mock MongoDB ───────────────────────────────────────────────────────
const store = {};  // in-memory run store

const mockRun = (data) => ({
  ...data,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  toJSON() { return this; },
});

const Run = require("./models/Run");
Run.create          = async (data) => { const r = mockRun(data); store[data.run_id] = r; return r; };
Run.findOne         = async ({ run_id }) => store[run_id] || null;
Run.findOneAndUpdate = async ({ run_id }, update) => { if (store[run_id]) Object.assign(store[run_id], update); return store[run_id]; };
Run.findOneAndDelete = async ({ run_id }) => { const r = store[run_id]; delete store[run_id]; return r || null; };
const chainable = (result) => ({ select: () => chainable(result), sort: () => chainable(result), limit: () => result });
Run.find            = async () => chainable(Object.values(store));

// ── Start test server ──────────────────────────────────────────────────
const app    = require("./app");
const server = http.createServer(app);
const PORT   = 3099;

// Simple HTTP helper
const req = (method, path, body, isFile = false) =>
  new Promise((resolve, reject) => {
    let postData, headers = {};

    if (isFile) {
      // Simulate multipart upload with a real temp xlsx
      const boundary = "----TestBoundary123";
      const xlsxPath = path.includes("upload") ? body : null;  // body = file path for uploads
      // For simplicity we just send an empty body and test the validation path
      postData = Buffer.from("");
      headers = { "Content-Type": `multipart/form-data; boundary=${boundary}`, "Content-Length": 0 };
    } else if (body) {
      postData = JSON.stringify(body);
      headers = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) };
    }

    const options = { hostname: "localhost", port: PORT, path, method, headers };
    const r = http.request(options, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on("error", reject);
    if (postData) r.write(postData);
    r.end();
  });

const pass = (label) => console.log(`  ✅ ${label}`);
const fail = (label, got, expected) => console.log(`  ❌ ${label} — got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
const check = (label, condition, got, expected) => condition ? pass(label) : fail(label, got, expected);

const runTests = async () => {
  console.log("\n" + "=".repeat(55));
  console.log("  CabRoute Node.js API — Test Suite");
  console.log("=".repeat(55));

  // ── Test 1: Root ─────────────────────────────────────────
  console.log("\n[1] Root endpoint");
  const t1 = await req("GET", "/");
  check("GET / returns 200",       t1.status === 200,       t1.status, 200);
  check("service name correct",    t1.body.service === "cabroute-api", t1.body.service, "cabroute-api");

  // ── Test 2: Health ───────────────────────────────────────
  console.log("\n[2] Health check (mocked Flask)");
  const t2 = await req("GET", "/api/runs/health");
  check("GET /health returns 200",         t2.status === 200, t2.status, 200);
  check("node status ok",                  t2.body.node?.status === "ok", t2.body.node?.status, "ok");
  check("flask status ok (mocked)",        t2.body.flask?.status === "ok", t2.body.flask?.status, "ok");

  // ── Test 3: Defaults ─────────────────────────────────────
  console.log("\n[3] Config defaults");
  const t3 = await req("GET", "/api/runs/config/defaults");
  check("GET /config/defaults returns 200",  t3.status === 200, t3.status, 200);
  check("has cab_capacity",                  t3.body.defaults?.cab_capacity !== undefined, t3.body.defaults?.cab_capacity, "defined");
  check("has rate_per_km",                   t3.body.defaults?.rate_per_km !== undefined, t3.body.defaults?.rate_per_km, "defined");

  // ── Test 4: Geocode test ─────────────────────────────────
  console.log("\n[4] Geocode test endpoint");
  const t4a = await req("POST", "/api/runs/geocode-test", { address: "Koramangala, Bangalore" });
  check("POST /geocode-test returns 200",  t4a.status === 200, t4a.status, 200);
  check("returns lat",                     t4a.body.lat !== undefined, t4a.body.lat, "defined");

  const t4b = await req("POST", "/api/runs/geocode-test", {});
  check("missing address returns 400",     t4b.status === 400, t4b.status, 400);

  // ── Test 5: Upload — no file ─────────────────────────────
  console.log("\n[5] Upload validation");
  const t5 = await req("POST", "/api/runs/upload");
  check("no file returns 400",             t5.status === 400, t5.status, 400);
  check("error message present",           !!t5.body.error, t5.body.error, "truthy");

  // ── Test 6: Simulate full upload via mocked Flask ────────
  // Directly call controller logic via a crafted fake request
  console.log("\n[6] Full optimize flow (mocked Flask + MongoDB)");
  const { uploadAndOptimize } = require("./controllers/runsController");

  // Create a minimal temp xlsx so the controller has a real file to clean up
  const tmpFile = path.join(os.tmpdir(), `test_${Date.now()}.xlsx`);
  fs.writeFileSync(tmpFile, Buffer.from("PK")); // minimal bytes

  let capturedResponse;
  const fakeReq = {
    file: { path: tmpFile, originalname: "test_employees.xlsx" },
    body: { cab_capacity: "6", rate_per_km: "18", working_days: "26" },
  };
  const fakeRes = {
    _status: 200,
    _body: null,
    status(code) { this._status = code; return this; },
    json(data)   { this._body = data; capturedResponse = { status: this._status, body: data }; return this; },
  };

  await uploadAndOptimize(fakeReq, fakeRes);
  check("upload returns 200",              capturedResponse.status === 200, capturedResponse.status, 200);
  check("success: true",                   capturedResponse.body.success === true, capturedResponse.body.success, true);
  check("has run_id",                      !!capturedResponse.body.run_id, capturedResponse.body.run_id, "uuid");
  check("has summary",                     !!capturedResponse.body.summary, "present", "present");
  check("has routes array",                Array.isArray(capturedResponse.body.routes), typeof capturedResponse.body.routes, "array");
  check("total_cabs correct",              capturedResponse.body.summary.total_cabs === 3, capturedResponse.body.summary.total_cabs, 3);

  const savedRunId = capturedResponse.body.run_id;

  // ── Test 7: Get run by ID ────────────────────────────────
  console.log("\n[7] Get run by ID");
  const t7 = await req("GET", `/api/runs/${savedRunId}`);
  check("GET /:run_id returns 200",        t7.status === 200, t7.status, 200);
  check("run_id matches",                  t7.body.run?.run_id === savedRunId, t7.body.run?.run_id, savedRunId);

  const t7b = await req("GET", "/api/runs/nonexistent-id");
  check("nonexistent run_id returns 404",  t7b.status === 404, t7b.status, 404);

  // ── Test 8: List all runs ────────────────────────────────
  console.log("\n[8] List all runs");
  const t8 = await req("GET", "/api/runs");
  check("GET / returns 200",               t8.status === 200, t8.status, 200);
  check("runs is array",                   Array.isArray(t8.body.runs), typeof t8.body.runs, "array");

  // ── Test 9: Delete run ───────────────────────────────────
  console.log("\n[9] Delete run");
  const t9 = await req("DELETE", `/api/runs/${savedRunId}`);
  check("DELETE returns 200",              t9.status === 200, t9.status, 200);
  check("success message",                 t9.body.success === true, t9.body.success, true);

  const t9b = await req("DELETE", `/api/runs/${savedRunId}`);
  check("deleting again returns 404",      t9b.status === 404, t9b.status, 404);

  // ── Test 10: 404 ─────────────────────────────────────────
  console.log("\n[10] 404 handler");
  const t10 = await req("GET", "/api/nonexistent");
  check("unknown route returns 404",       t10.status === 404, t10.status, 404);

  console.log("\n" + "=".repeat(55));
  console.log("  All tests complete.");
  console.log("=".repeat(55) + "\n");

  server.close();
};

server.listen(PORT, () => {
  console.log(`[test] Server started on port ${PORT}`);
  runTests().catch(err => {
    console.error("[test] Fatal error:", err);
    server.close();
    process.exit(1);
  });
});
