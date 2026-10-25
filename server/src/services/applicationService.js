const AppError = require('../utils/AppError');
const { parsePaging, pageResult } = require('../utils/pagination');
const { validateResume, safeFileName } = require('../utils/resumeValidation');
const applicationRepository = require('../repositories/applicationRepository');
const listingRepository = require('../repositories/listingRepository');
const storageService = require('./storageService');
const scanService = require('./scanService');
const auditService = require('./auditService');
const notificationService = require('./notificationService');

const idOf = (v) => String(v && v._id ? v._id : v);

function toDto(a, { forRecruiter } = {}) {
  const o = a.toObject ? a.toObject() : a;
  const populatedListing = o.listing && typeof o.listing === 'object' && 'title' in o.listing;
  const populatedStudent = o.student && typeof o.student === 'object' && 'name' in o.student;
  return {
    id: String(o._id),
    status: o.status,
    resumeOriginalName: o.resumeOriginalName,
    resumeSize: o.resumeSize,
    interview: o.interview && o.interview.date ? o.interview : null,
    statusHistory: o.statusHistory,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    listingId: idOf(o.listing),
    listing: populatedListing ? { id: idOf(o.listing), ...o.listing, _id: undefined } : undefined,
    student:
      forRecruiter && populatedStudent
        ? { id: idOf(o.student), name: o.student.name, email: o.student.email, profile: o.student.profile || {} }
        : undefined,
  };
}

// IPP-F-010 + IPP-SR-005: validate, scan, store, then record the application. Duplicates are rejected before anything is stored.
async function apply(student, { listingId }, file) {
  const listing = await listingRepository.findById(listingId);
  if (!listing || listing.status !== 'approved') throw new AppError(404, 'LISTING_NOT_FOUND', 'This internship is not available');
  if (listing.deadline < new Date()) throw new AppError(409, 'LISTING_EXPIRED', 'The application deadline for this internship has passed');
  if (await applicationRepository.exists(student._id, listing._id)) {
    throw new AppError(409, 'ALREADY_APPLIED', 'You have already applied to this internship');
  }

  const problem = validateResume(file);
  if (problem) throw new AppError(400, 'INVALID_FILE', problem);
  const verdict = await scanService.scan(file.buffer);
  if (!verdict.clean) {
    throw new AppError(verdict.unavailable ? 503 : 422, verdict.unavailable ? 'SCAN_UNAVAILABLE' : 'FILE_REJECTED', verdict.reason || 'File rejected');
  }

  const resumeKey = await storageService.save(file.buffer);
  try {
    const app = await applicationRepository.create({
      student: student._id,
      listing: listing._id,
      recruiter: listing.recruiter,
      resumeKey,
      resumeOriginalName: safeFileName(file.originalname),
      resumeSize: file.size,
      statusHistory: [{ status: 'Applied', by: student._id }],
    });
    return toDto(app);
  } catch (err) {
    await storageService.remove(resumeKey); // never leave orphaned files behind
    if (err.code === 11000) throw new AppError(409, 'ALREADY_APPLIED', 'You have already applied to this internship');
    throw err;
  }
}

async function listMine(student, query) {
  const paging = parsePaging(query);
  const { items, total } = await applicationRepository.listForStudent(student._id, paging);
  return pageResult(items.map((a) => toDto(a)), total, paging);
}

// Recruiter's applicants for one of their own listings (IPP-F-011).
async function listForListing(recruiter, listingId, query) {
  const listing = await listingRepository.findById(listingId);
  if (!listing) throw new AppError(404, 'LISTING_NOT_FOUND', 'Listing not found');
  if (idOf(listing.recruiter) !== idOf(recruiter._id)) throw new AppError(403, 'FORBIDDEN', 'You can only view applicants for your own listings');
  const paging = parsePaging(query);
  const { items, total } = await applicationRepository.listForListing(listing._id, query, paging);
  return pageResult(items.map((a) => toDto(a, { forRecruiter: true })), total, paging);
}

async function loadFor(user, id, { withResume = false } = {}) {
  const app = await (withResume ? applicationRepository.findByIdWithResume(id) : applicationRepository.findById(id));
  if (!app) throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
  const mine = user.role === 'student' ? idOf(app.student) === idOf(user._id) : idOf(app.recruiter) === idOf(user._id);
  if (!mine) throw new AppError(403, 'FORBIDDEN', 'You do not have access to this application');
  return app;
}

async function getOne(user, id) {
  const app = await loadFor(user, id);
  await app.populate([
    { path: 'listing', select: 'title company location deadline status stipend duration domain' },
    { path: 'student', select: 'name email profile' },
  ]);
  return toDto(app, { forRecruiter: user.role === 'recruiter' });
}

async function openResume(user, id) {
  const app = await loadFor(user, id, { withResume: true });
  if (!(await storageService.exists(app.resumeKey))) throw new AppError(404, 'RESUME_MISSING', 'The resume file is no longer available');
  return {
  stream: await storageService.open(app.resumeKey),
  filename: app.resumeOriginalName,
};
}

// IPP-F-011 + IPP-F-012: persist the change, audit it, and notify the student (in-app + email).
async function updateStatus(recruiter, id, { status }, ctx = {}) {
  const app = await loadFor(recruiter, id);
  if (app.status === status) throw new AppError(409, 'STATUS_UNCHANGED', `Application is already ${status}`);
  const previous = app.status;
  app.status = status;
  app.statusHistory.push({ status, by: recruiter._id });
  await applicationRepository.save(app);

  await app.populate('listing', 'title company');
  await auditService.record({
    actor: recruiter._id,
    action: 'APPLICATION_STATUS_CHANGED',
    targetType: 'Application',
    targetId: app._id,
    metadata: { from: previous, to: status },
    ip: ctx.ip,
  });
  await notificationService.notify({
    userId: app.student,
    type: 'application_status',
    message: `Your application for "${app.listing.title}" at ${app.listing.company} is now ${status}.`,
    emailSubject: `Application update: ${app.listing.title}`,
    link: `/student/applications/${app._id}`,
  });
  return toDto(app);
}

// IPP-F-013: interviews can only be scheduled for shortlisted candidates.
async function scheduleInterview(recruiter, id, interview, ctx = {}) {
  const app = await loadFor(recruiter, id);
  if (app.status !== 'Shortlisted') throw new AppError(409, 'NOT_SHORTLISTED', 'Interviews can only be scheduled for shortlisted candidates');
  const rescheduled = Boolean(app.interview && app.interview.date);
  app.interview = interview;
  await applicationRepository.save(app);

  await app.populate('listing', 'title company');
  await auditService.record({
    actor: recruiter._id,
    action: 'INTERVIEW_SCHEDULED',
    targetType: 'Application',
    targetId: app._id,
    metadata: { mode: interview.mode, date: interview.date },
    ip: ctx.ip,
  });
  await notificationService.notify({
    userId: app.student,
    type: 'interview_scheduled',
    message: `Interview ${rescheduled ? 'rescheduled' : 'scheduled'} for "${app.listing.title}" on ${new Date(interview.date).toUTCString()} (${interview.mode}).`,
    emailSubject: `Interview ${rescheduled ? 'rescheduled' : 'scheduled'}: ${app.listing.title}`,
    link: `/student/applications/${app._id}`,
  });
  return toDto(app);
}

module.exports = { apply, listMine, listForListing, getOne, openResume, updateStatus, scheduleInterview };
