// src/config/db.js
// MongoDB connection using Mongoose

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`[mongodb] Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`[mongodb] Connection failed: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
