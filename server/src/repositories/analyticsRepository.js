const mongoose = require('mongoose');
const Application = require('../models/Application');
const TestAttempt = require('../models/TestAttempt');
const User = require('../models/User');
const Listing = require('../models/Listing');

// All aggregate reads for dashboards / analytics live here (services never touch the models directly).
const FINISHED = ['submitted', 'auto_submitted'];
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const byMonth = (field) => ({ $dateToString: { format: '%Y-%m', date: field, timezone: 'UTC' } });

// Applications in the date range (by applied date), joined to their listing so we can filter/group by company & domain.
const applicationsBase = ({ from, to, company }) => [
  { $match: { createdAt: { $gte: from, $lte: to } } },
  { $lookup: { from: 'listings', localField: 'listing', foreignField: '_id', as: 'l' } },
  { $unwind: '$l' },
  ...(company ? [{ $match: { 'l.company': company } }] : []),
];

async function placementFacets(range) {
  const [res] = await Application.aggregate([
    ...applicationsBase(range),
    {
      $facet: {
        status: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        company: [
          {
            $group: {
              _id: '$l.company',
              applications: { $sum: 1 },
              shortlisted: { $sum: { $cond: [{ $eq: ['$status', 'Shortlisted'] }, 1, 0] } },
              selected: { $sum: { $cond: [{ $eq: ['$status', 'Selected'] }, 1, 0] } },
            },
          },
          { $sort: { applications: -1, _id: 1 } },
          { $limit: 10 },
        ],
        domain: [{ $group: { _id: '$l.domain', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
        monthlyApplications: [{ $group: { _id: byMonth('$createdAt'), count: { $sum: 1 } } }],
        monthlySelections: [
          { $match: { status: 'Selected', updatedAt: { $gte: range.from, $lte: range.to } } },
          { $group: { _id: byMonth('$updatedAt'), count: { $sum: 1 } } },
        ],
        placed: [{ $match: { status: 'Selected' } }, { $group: { _id: '$student' } }, { $count: 'n' }],
        applicants: [{ $group: { _id: '$student' } }, { $count: 'n' }],
      },
    },
  ]);
  return res;
}

async function monthlyTests({ from, to }) {
  return TestAttempt.aggregate([
    { $match: { status: { $in: FINISHED }, submittedAt: { $gte: from, $lte: to } } },
    { $group: { _id: byMonth('$submittedAt'), attempts: { $sum: 1 }, avgAccuracy: { $avg: '$accuracy' } } },
  ]);
}

const companies = () => Listing.distinct('company');

async function platformCounts(now = new Date()) {
  const [students, recruiters, activeListings] = await Promise.all([
    User.countDocuments({ role: 'student', emailVerified: true, isActive: true }),
    User.countDocuments({ role: 'recruiter', approvalStatus: 'approved', isActive: true }),
    Listing.countDocuments({ status: 'approved', deadline: { $gte: now } }),
  ]);
  return { students, recruiters, activeListings };
}

// Raw filtered records for CSV/PDF export (IPP-F-021): one row per application in the filter.
async function exportRows(range, limit = 10000) {
  return Application.aggregate([
    ...applicationsBase(range),
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    { $lookup: { from: 'users', localField: 'student', foreignField: '_id', as: 's' } },
    { $unwind: '$s' },
    {
      $project: {
        _id: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        studentName: '$s.name',
        studentEmail: '$s.email',
        college: '$s.profile.college',
        company: '$l.company',
        title: '$l.title',
        domain: '$l.domain',
        location: '$l.location',
      },
    },
  ]);
}

// ── Student dashboard (IPP-F-018) ───────────────────────────────────────────
const studentApplications = (student) =>
  Application.find({ student }).sort({ createdAt: -1 }).populate('listing', 'title company location').lean();

const studentAttempts = (student) =>
  TestAttempt.find({ student, status: { $in: FINISHED } }).sort({ submittedAt: -1 }).populate('test', 'title').lean();

module.exports = {
  FINISHED,
  oid,
  placementFacets,
  monthlyTests,
  companies,
  platformCounts,
  exportRows,
  studentApplications,
  studentAttempts,
};
