const { describe, it, before, after, beforeEach } = require('node:test');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const AuditLog = require('../src/models/AuditLog');
const User = require('../src/models/User');
const Listing = require('../src/models/Listing');
const { outbox } = require('../src/services/mailer');
const { startDb, stopDb, clearDb, createUser, listingBody } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

describe('recruiter approval (IPP-F-022)', () => {
  it('lists pending recruiters and approves them, with audit log + email', async () => {
    const admin = await createUser({ role: 'admin' });
    const rec = await createUser({ role: 'recruiter', approvalStatus: 'pending' });
    await createUser({ role: 'recruiter', approvalStatus: 'approved' });

    const list = await request(app).get('/api/admin/recruiters').set(admin.auth);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].email).toBe(rec.user.email);
    expect(JSON.stringify(list.body)).not.toContain('passwordHash');

    outbox.length = 0;
    const res = await request(app).patch(`/api/admin/recruiters/${rec.user._id}`).set(admin.auth).send({ decision: 'approved' });
    expect(res.status).toBe(200);
    expect((await User.findById(rec.user._id)).approvalStatus).toBe('approved');
    expect(outbox).toHaveLength(1);
    const log = await AuditLog.findOne({ action: 'RECRUITER_APPROVED' });
    expect(String(log.actor)).toBe(String(admin.user._id));
    expect(String(log.targetId)).toBe(String(rec.user._id));
  });

  it('rejects with a reason and the recruiter then cannot create listings', async () => {
    const admin = await createUser({ role: 'admin' });
    const rec = await createUser({ role: 'recruiter', approvalStatus: 'pending' });
    await request(app).patch(`/api/admin/recruiters/${rec.user._id}`).set(admin.auth).send({ decision: 'rejected', reason: 'Unverified company' });
    expect(await AuditLog.countDocuments({ action: 'RECRUITER_REJECTED' })).toBe(1);
    const res = await request(app).post('/api/listings').set(rec.auth).send(listingBody());
    expect(res.status).toBe(403);
  });

  it('404s for unknown or non-recruiter targets and validates the decision', async () => {
    const admin = await createUser({ role: 'admin' });
    const student = await createUser({ role: 'student' });
    expect((await request(app).patch(`/api/admin/recruiters/${student.user._id}`).set(admin.auth).send({ decision: 'approved' })).status).toBe(404);
    expect((await request(app).patch('/api/admin/recruiters/64b000000000000000000000').set(admin.auth).send({ decision: 'approved' })).status).toBe(404);
    const rec = await createUser({ role: 'recruiter', approvalStatus: 'pending' });
    expect((await request(app).patch(`/api/admin/recruiters/${rec.user._id}`).set(admin.auth).send({ decision: 'maybe' })).status).toBe(400);
  });

  it('is admin-only', async () => {
    const rec = await createUser({ role: 'recruiter' });
    const student = await createUser({ role: 'student' });
    expect((await request(app).get('/api/admin/recruiters').set(rec.auth)).status).toBe(403);
    expect((await request(app).get('/api/admin/recruiters').set(student.auth)).status).toBe(403);
    expect((await request(app).get('/api/admin/recruiters')).status).toBe(401);
    expect((await request(app).patch(`/api/admin/recruiters/${rec.user._id}`).set(rec.auth).send({ decision: 'approved' })).status).toBe(403);
  });
});

describe('listing approval workflow (IPP-F-006, IPP-F-022)', () => {
  it('a published listing is invisible to students until an admin approves it', async () => {
    const admin = await createUser({ role: 'admin' });
    const rec = await createUser({ role: 'recruiter' });
    const student = await createUser({ role: 'student' });
    const created = await request(app).post('/api/listings').set(rec.auth).send({ ...listingBody(), publish: true });
    const id = created.body.listing.id;

    expect((await request(app).get('/api/listings').set(student.auth)).body.total).toBe(0);
    const pending = await request(app).get('/api/admin/listings').set(admin.auth);
    expect(pending.body.total).toBe(1);
    expect(pending.body.items[0].recruiterInfo.name).toBe(rec.user.name);

    const res = await request(app).patch(`/api/admin/listings/${id}`).set(admin.auth).send({ decision: 'approved' });
    expect(res.body.listing.status).toBe('approved');
    expect((await request(app).get('/api/listings').set(student.auth)).body.total).toBe(1);
    expect(await AuditLog.countDocuments({ action: 'LISTING_APPROVED' })).toBe(1);
  });

  it('rejection stores the reason and the recruiter can fix and resubmit', async () => {
    const admin = await createUser({ role: 'admin' });
    const rec = await createUser({ role: 'recruiter' });
    const { body } = await request(app).post('/api/listings').set(rec.auth).send({ ...listingBody(), publish: true });
    const id = body.listing.id;
    const rej = await request(app).patch(`/api/admin/listings/${id}`).set(admin.auth).send({ decision: 'rejected', reason: 'Add stipend details' });
    expect(rej.body.listing.rejectionReason).toBe('Add stipend details');

    const fix = await request(app).patch(`/api/listings/${id}`).set(rec.auth).send({ description: 'Updated description with enough detail to pass.', publish: true });
    expect(fix.body.listing.status).toBe('pending_approval');
    expect(fix.body.listing.rejectionReason).toBeUndefined();
  });

  it('only listings awaiting approval can be reviewed', async () => {
    const admin = await createUser({ role: 'admin' });
    const rec = await createUser({ role: 'recruiter' });
    const draft = await Listing.create({ ...listingBody(), company: 'X', recruiter: rec.user._id, deadline: new Date(Date.now() + 864e5), status: 'draft' });
    const res = await request(app).patch(`/api/admin/listings/${draft._id}`).set(admin.auth).send({ decision: 'approved' });
    expect(res.status).toBe(409);
  });

  it('is admin-only', async () => {
    const rec = await createUser({ role: 'recruiter' });
    expect((await request(app).get('/api/admin/listings').set(rec.auth)).status).toBe(403);
  });
});

describe('profile (IPP-F-008 company profile)', () => {
  it('lets a user update their profile partially and keeps unrelated fields', async () => {
    const rec = await createUser({ role: 'recruiter' });
    const a = await request(app).patch('/api/users/me').set(rec.auth).send({ profile: { companyName: 'Acme', website: 'https://acme.test' } });
    expect(a.status).toBe(200);
    const b = await request(app).patch('/api/users/me').set(rec.auth).send({ profile: { companyDescription: 'Rockets' } });
    expect(b.body.user.profile.companyName).toBe('Acme');
    expect(b.body.user.profile.companyDescription).toBe('Rockets');
    expect((await request(app).get('/api/users/me').set(rec.auth)).body.user.profile.website).toBe('https://acme.test');
  });

  it('validates input and cannot change role or approval status', async () => {
    const rec = await createUser({ role: 'recruiter', approvalStatus: 'pending' });
    expect((await request(app).patch('/api/users/me').set(rec.auth).send({ profile: { website: 'javascript:alert(1)' } })).status).toBe(400);
    const res = await request(app).patch('/api/users/me').set(rec.auth).send({ name: 'New Name', role: 'admin', approvalStatus: 'approved' });
    expect(res.body.user.role).toBe('recruiter');
    expect(res.body.user.approvalStatus).toBe('pending');
    expect(res.body.user.name).toBe('New Name');
  });
});
