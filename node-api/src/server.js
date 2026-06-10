// src/server.js
// Entry point — loads env, connects MongoDB, starts Express.

require("dotenv").config();
const app       = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 3001;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n[server] CabRoute API running on http://localhost:${PORT}`);
    console.log(`[server] Flask optimizer expected at ${process.env.FLASK_SERVICE_URL || "http://localhost:5001"}`);
    console.log(`[server] Environment: ${process.env.NODE_ENV || "development"}\n`);
  });
};

start();
