const path = require('path');
const config = require('../config/env');

// IPP-SR-005: structural checks on an uploaded resume. Returns an error message or null.
// The declared type is never trusted on its own: the bytes must actually look like a PDF.
function validateResume(file) {
  if (!file) return 'A PDF resume is required';
  if (path.extname(file.originalname || '').toLowerCase() !== '.pdf') return 'Only PDF files are accepted';
  if (file.mimetype !== 'application/pdf') return 'Only PDF files are accepted';
  if (!file.buffer || file.buffer.length < 16) return 'The file is empty or too small to be a PDF';
  if (file.buffer.length > config.upload.maxBytes) return 'Resume must be 5 MB or smaller';
  if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') return 'The file content is not a valid PDF';
  if (!file.buffer.subarray(-2048).toString('latin1').includes('%%EOF')) return 'The PDF appears to be truncated or corrupt';
  return null;
}

// Display name only (never used as a path): strip directories, control characters and markup.
function safeFileName(name) {
  const base = path.basename(String(name || 'resume.pdf')).replace(/[\u0000-\u001f<>:"/\\|?*]+/g, '_');
  return base.slice(0, 100) || 'resume.pdf';
}

module.exports = { validateResume, safeFileName };
