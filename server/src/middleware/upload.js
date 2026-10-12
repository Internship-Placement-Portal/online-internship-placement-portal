const multer = require('multer');
const config = require('../config/env');

// Buffers the single "resume" file in memory (<= 5 MB) so it can be validated and scanned BEFORE anything is written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxBytes, files: 1, fields: 5, parts: 7 },
});

module.exports = { uploadResume: upload.single('resume') };
