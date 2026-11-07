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

// IPP-F-007: multi-filter criteria conjunction builder (domain, location, stipend range, duration range, full-text).
// IPP-F-009: expired listings are excluded at query time as well as by the scheduled job.
function buildStudentFilter({ q, domain, location, minStipend, maxStipend, minDuration, maxDuration }, now = new Date()) {
  const filter = { status: 'approved', deadline: { $gte: now } };
  if (q && q.trim()) filter.$text = { $search: q.trim() };
  if (domain && domain.trim()) filter.domain = domain.trim();
  if (location && location.trim()) filter.location = new RegExp(escapeRegex(location.trim()), 'i');

  const stipendFilter = {};
  if (minStipend !== undefined && minStipend !== null && minStipend !== '') {
    const num = Number(minStipend);
    if (!Number.isNaN(num)) stipendFilter.$gte = num;
  }
  if (maxStipend !== undefined && maxStipend !== null && maxStipend !== '') {
    const num = Number(maxStipend);
    if (!Number.isNaN(num)) stipendFilter.$lte = num;
  }
  if (Object.keys(stipendFilter).length > 0) {
    filter.stipend = stipendFilter;
  }

  const durationFilter = {};
  if (minDuration !== undefined && minDuration !== null && minDuration !== '') {
    const num = Number(minDuration);
    if (!Number.isNaN(num)) durationFilter.$gte = num;
  }
  if (maxDuration !== undefined && maxDuration !== null && maxDuration !== '') {
    const num = Number(maxDuration);
    if (!Number.isNaN(num)) durationFilter.$lte = num;
  }
  if (Object.keys(durationFilter).length > 0) {
    filter.duration = durationFilter;
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
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    Listing.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).populate('recruiter', 'name email profile').lean(),
    Listing.countDocuments(filter),
  ]);
  return { items, total };
}

const save = (listing) => listing.save();
const closeExpired = (now = new Date()) =>
  Listing.updateMany({ status: 'approved', deadline: { $lt: now } }, { status: 'closed' });

module.exports = {
  create,
  findById,
  findByIdPopulated,
  search,
  listForRecruiter,
  listByStatus,
  save,
  closeExpired,
  buildStudentFilter,
};
