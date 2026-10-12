const AppError = require('../utils/AppError');
const { parsePaging, pageResult } = require('../utils/pagination');
const listingRepository = require('../repositories/listingRepository');
const applicationRepository = require('../repositories/applicationRepository');
const { DOMAINS } = require('../models/Listing');

const EDITABLE = ['title', 'company', 'description', 'domain', 'location', 'stipend', 'duration', 'skills', 'eligibility', 'deadline'];

// Public shape of a listing. The recruiter block carries the company profile shown on the details page (IPP-F-008).
function toDto(listing) {
  const l = listing.toObject ? listing.toObject() : listing;
  const r = l.recruiter && typeof l.recruiter === 'object' && 'name' in l.recruiter ? l.recruiter : null; // populated?
  const { score, __v, approvedBy, ...rest } = l;
  return {
    ...rest,
    id: String(l._id),
    _id: undefined,
    recruiter: r ? String(r._id) : String(l.recruiter),
    companyProfile: r
      ? {
          name: r.profile?.companyName || l.company,
          description: r.profile?.companyDescription || '',
          website: r.profile?.website || '',
        }
      : undefined,
  };
}

const requireApprovedRecruiter = (user) => {
  if (user.approvalStatus !== 'approved') {
    throw new AppError(403, 'RECRUITER_NOT_APPROVED', 'Your recruiter account must be approved by a placement officer first');
  }
};

async function loadOwned(user, id) {
  const listing = await listingRepository.findById(id);
  if (!listing) throw new AppError(404, 'LISTING_NOT_FOUND', 'Listing not found');
  if (String(listing.recruiter) !== String(user._id)) throw new AppError(403, 'FORBIDDEN', 'You can only manage your own listings');
  return listing;
}

// IPP-F-006
async function create(user, data) {
  requireApprovedRecruiter(user);
  const { publish, ...fields } = data;
  const listing = await listingRepository.create({
    ...fields,
    company: fields.company || user.profile?.companyName || user.name,
    recruiter: user._id,
    status: publish ? 'pending_approval' : 'draft',
  });
  return toDto(listing);
}

async function update(user, id, data) {
  const listing = await loadOwned(user, id);
  if (listing.status === 'closed') throw new AppError(409, 'LISTING_CLOSED', 'Closed listings cannot be edited');

  const { publish, ...fields } = data;
  EDITABLE.forEach((k) => {
    if (fields[k] !== undefined) listing[k] = fields[k];
  });

  // Any change to a reviewed listing sends it back for re-approval; drafts stay drafts until published.
  if (publish) {
    requireApprovedRecruiter(user);
    listing.status = 'pending_approval';
  } else if (listing.status === 'approved') {
    listing.status = 'pending_approval';
  } else if (listing.status === 'rejected') {
    listing.status = 'draft';
  }
  if (listing.status === 'pending_approval' || listing.status === 'draft') listing.rejectionReason = undefined;

  await listingRepository.save(listing);
  return toDto(listing);
}

async function close(user, id) {
  const listing = await loadOwned(user, id);
  listing.status = 'closed';
  await listingRepository.save(listing);
  return toDto(listing);
}

// IPP-F-007
async function search(query) {
  const paging = parsePaging(query, { defaultLimit: 9, maxLimit: 50 });
  const { items, total } = await listingRepository.search(query, paging);
  return pageResult(items.map(toDto), total, paging);
}

async function listMine(user, query) {
  const paging = parsePaging(query);
  const { items, total } = await listingRepository.listForRecruiter(user._id, query, paging);
  return pageResult(items.map(toDto), total, paging);
}

// IPP-F-008 + IPP-F-009: students only ever see approved, unexpired listings; others get a not-found state.
async function getById(user, id) {
  const listing = await listingRepository.findByIdPopulated(id);
  if (!listing) throw new AppError(404, 'LISTING_NOT_FOUND', 'This internship is not available');

  if (user.role === 'student') {
    if (listing.status !== 'approved' || listing.deadline < new Date()) {
      throw new AppError(404, 'LISTING_NOT_FOUND', 'This internship is not available');
    }
    // Lets the UI show "Applied" instead of the apply form.
    const existing = await applicationRepository.findByStudentAndListing(user._id, listing._id);
    return { ...toDto(listing), application: existing ? { id: String(existing._id), status: existing.status } : null };
  } else if (user.role === 'recruiter' && String(listing.recruiter._id) !== String(user._id)) {
    throw new AppError(403, 'FORBIDDEN', 'You can only view your own listings');
  }
  return toDto(listing);
}

const domains = () => DOMAINS;

module.exports = { create, update, close, search, listMine, getById, domains, toDto };
