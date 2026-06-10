// src/middleware/errorHandler.js
// Centralised error handler — catches everything Express throws.
// express-async-errors patches async route handlers automatically.

const errorHandler = (err, _req, res, _next) => {
  const status = err.statusCode || err.status || 500;
  const message = err.message || "Internal server error";

  // Multer-specific errors
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      error: `File too large. Maximum allowed size is ${process.env.MAX_FILE_SIZE_MB || 10}MB.`,
    });
  }

  console.error(`[error] ${status} — ${message}`);
  if (status === 500) console.error(err.stack);

  res.status(status).json({ success: false, error: message });
};

module.exports = errorHandler;
