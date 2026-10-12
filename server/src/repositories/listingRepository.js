const Listing = require('../models/Listing');
const { escapeRegex } = require('../utils/pagination');

const SORTS = {
  newest: { createdAt: -1 },
  stipend_desc: { stipend: -1, createdAt: -1 },
  deadline_asc: { deadline: 1 },
};

const create = (data) => Listing.create(data);
const findById = (id) => Listing.findById(id);
const findByIdPopulated = (id) => Listing.findById(id).populate('recruiter', 'name profile');

// IPP-F-009: expired listings are excluded at query time as well as by the scheduled job.
function buildStudentFilter({ q, domain, location, minStipend, maxStipend, minDuration, maxDuration }, now = new Date()) {
  const filter = { status: 'approved', deadline: { $gte: now } };
  if (q) filter.$text = { $search: q };
  if (domain) filter.domain = domain;
  if (location) filter.location = new RegExp(escapeRegex(location), 'i');
  if (minStipend !== undefined || maxStipend !== undefined) {
    filter.stipend = {};
    if (minStipend !== undefined) filter.stipend.$gte = minStipend;
    if (maxStipend !== undefined) filter.stipend.$lte = maxStipend;
  }
  if (minDuration !== undefined || maxDuration !== undefined) {
    filter.duration = {};
    if (minDuration !== undefined) filter.duration.$gte = minDuration;
    if (maxDuration !== undefined) filter.duration.$lte = maxDuration;
  }
  return filter;
}

async function search(query, { skip, limit }) {
  const filter = buildStudentFilter(query);
  const useScore = query.q && (!query.sort || query.sort === 'relevance');
  let cursor = Listing.find(filter, useScore ? { score: { $meta: 'textScore' } } : undefined);
  cursor = cursor.sort(useScore ? { score: { $meta: 'textScore' } } : SORTS[query.sort] || SORTS.newest);
  const [items, total] = await Promise.all([cursor.skip(skip).limit(limit).lean(), Listing.countDocuments(filter)]);
  return { items, total };
}

async function listForRecruiter(recruiter, { status }, { skip, limit }) {
  const filter = { recruiter, ...(status && { status }) };
  const [items, total] = await Promise.all([
    Listing.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Listing.countDocuments(filter),
  ]);
  return { items, total };
}

async function listByStatus(status, { skip, limit }) {
  const [items, total] = await Promise.all([
    Listing.find({ status }).sort({ updatedAt: -1 }).skip(skip).limit(limit).populate('recruiter', 'name email profile').lean(),
    Listing.countDocuments({ status }),
  ]);
  return { items, total };
}

const save = (doc) => doc.save();
const closeExpired = (now = new Date()) =>
  Listing.updateMany({ status: 'approved', deadline: { $lt: now } }, { status: 'closed' });

module.exports = { create, findById, findByIdPopulated, search, listForRecruiter, listByStatus, save, closeExpired, buildStudentFilter };
