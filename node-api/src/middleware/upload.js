// src/middleware/upload.js
// Multer config for Excel file uploads.
// Stores file to /tmp, validates extension before saving.

const multer = require("multer");
const path = require("path");
const os = require("os");

const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];
const MAX_SIZE_BYTES = (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, os.tmpdir()),
  filename: (_req, file, cb) => {
    const unique = `cabroute_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type '${ext}'. Only .xlsx and .xls are accepted.`), false);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE_BYTES } });

module.exports = upload;
