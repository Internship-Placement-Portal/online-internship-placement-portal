const AppError = require('../utils/AppError');
const { parsePaging, pageResult } = require('../utils/pagination');
const userRepository = require('../repositories/userRepository');
const listingRepository = require('../repositories/listingRepository');
const auditService = require('./auditService');
const mailer = require('./mailer');
const { toDto } = require('./listingService');

const recruiterDto = (u) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  approvalStatus: u.approvalStatus,
  profile: u.toObject().profile || {},
  createdAt: u.createdAt,
});

// IPP-F-022: list recruiter registrations awaiting (or past) review.
async function listRecruiters(query) {
  const paging = parsePaging(query);
  const { items, total } = await userRepository.listByRole('recruiter', { approvalStatus: query.status }, paging);
  return pageResult(items.map(recruiterDto), total, paging);
}

// IPP-F-022 + IPP-F-024: every decision is audit-logged with the acting admin.
async function decideRecruiter(admin, id, { decision, reason }, ctx = {}) {
  const user = await userRepository.findById(id);
  if (!user || user.role !== 'recruiter') throw new AppError(404, 'RECRUITER_NOT_FOUND', 'Recruiter not found');

  await userRepository.updateById(user._id, { approvalStatus: decision });
  await auditService.record({
    actor: admin._id,
    action: decision === 'approved' ? 'RECRUITER_APPROVED' : 'RECRUITER_REJECTED',
    targetType: 'User',
    targetId: user._id,
    metadata: { reason: reason || undefined },
    ip: ctx.ip,
  });
  await mailer.sendWithRetry({
    to: user.email,
    subject: decision === 'approved' ? 'Your IPP recruiter account is approved' : 'Your IPP recruiter registration was not approved',
    text:
      decision === 'approved'
        ? 'Good news: you can now create and publish internship listings on IPP.'
        : `Your recruiter registration was not approved.${reason ? ` Reason: ${reason}` : ''}`,
  });
  user.approvalStatus = decision;
  return recruiterDto(user);
}

async function listListings(query) {
  const paging = parsePaging(query);
  const { items, total } = await listingRepository.listByStatus(query.status, paging);
  return pageResult(
    items.map((l) => ({ ...toDto(l), recruiterInfo: { name: l.recruiter?.name, email: l.recruiter?.email } })),
    total,
    paging
  );
}

// IPP-F-006 / IPP-F-022: listings become visible to students only after an admin approves them.
async function decideListing(admin, id, { decision, reason }, ctx = {}) {
  const listing = await listingRepository.findById(id);
  if (!listing) throw new AppError(404, 'LISTING_NOT_FOUND', 'Listing not found');
  if (listing.status !== 'pending_approval') {
    throw new AppError(409, 'LISTING_NOT_PENDING', 'Only listings awaiting approval can be reviewed');
  }

  listing.status = decision === 'approved' ? 'approved' : 'rejected';
  listing.approvedBy = decision === 'approved' ? admin._id : undefined;
  listing.reviewedAt = new Date();
  listing.rejectionReason = decision === 'rejected' ? reason || undefined : undefined;
  await listingRepository.save(listing);

  await auditService.record({
    actor: admin._id,
    action: decision === 'approved' ? 'LISTING_APPROVED' : 'LISTING_REJECTED',
    targetType: 'Listing',
    targetId: listing._id,
    metadata: { title: listing.title, reason: reason || undefined },
    ip: ctx.ip,
  });
  return toDto(listing);
}

module.exports = { listRecruiters, decideRecruiter, listListings, decideListing };
