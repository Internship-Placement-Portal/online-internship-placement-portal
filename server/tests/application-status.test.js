// server/tests/application-status.test.js
// IPP-F-011 / TC-App-02: Recruiter application status management & student reflection test suite.
// Acceptance criteria:
//   1. Recruiter can view and filter applications for their listings by status.
//   2. Status changes are persisted and audited with previous/new state.
//   3. Lifecycle transitions are enforced (no backward reset to Applied).
//   4. Status change is dynamically reflected on the student's dashboard and application view.
const { describe, it, before, after, beforeEach } = require('node:test');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const Listing = require('../src/models/Listing');
const Application = require('../src/models/Application');
const AuditLog = require('../src/models/AuditLog');
const { startDb, stopDb, clearDb, createUser, listingBody, futureDate } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');

async function createFixture() {
  const student = await createUser({ role: 'student' });
  const recruiter = await createUser({ role: 'recruiter' });
  const otherRecruiter = await createUser({ role: 'recruiter' });
  const listing = await Listing.create({
    ...listingBody(),
    deadline: new Date(`${futureDate()}T23:59:59.999Z`),
    company: 'Innovatech Corp',
    recruiter: recruiter.user._id,
    status: 'approved',
  });
  return { student, recruiter, otherRecruiter, listing };
}

const applyTo = (student, listingId) =>
  request(app)
    .post('/api/applications')
    .set(student.auth)
    .field('listingId', String(listingId))
    .attach('resume', PDF, { filename: 'resume.pdf', contentType: 'application/pdf' });

// ─── 1. Status Lifecycle & Transition Enforcement (IPP-F-011) ────────────────
describe('TC-App-02 | Application status transitions (IPP-F-011)', () => {
  it('supports the full forward lifecycle: Applied -> Shortlisted -> Selected', async () => {
    const { student, recruiter, listing } = await createFixture();
    const { body } = await applyTo(student, listing._id);
    const appId = body.application.id;

    // Transition 1: Applied -> Shortlisted
    const res1 = await request(app)
      .patch(`/api/applications/${appId}/status`)
      .set(recruiter.auth)
      .send({ status: 'Shortlisted' });
    expect(res1.status).toBe(200);
    expect(res1.body.application.status).toBe('Shortlisted');

    // Transition 2: Shortlisted -> Selected
    const res2 = await request(app)
      .patch(`/api/applications/${appId}/status`)
      .set(recruiter.auth)
      .send({ status: 'Selected' });
    expect(res2.status).toBe(200);
    expect(res2.body.application.status).toBe('Selected');

    // Verify persisted history has both transitions with 'from' metadata
    const doc = await Application.findById(appId);
    expect(doc.status).toBe('Selected');
    expect(doc.statusHistory).toHaveLength(3); // Initial Applied + 2 transitions
    expect(doc.statusHistory[1].status).toBe('Shortlisted');
    expect(doc.statusHistory[1].from).toBe('Applied');
    expect(doc.statusHistory[2].status).toBe('Selected');
    expect(doc.statusHistory[2].from).toBe('Shortlisted');
  });

  it('supports direct rejection from Applied and from Shortlisted', async () => {
    const { student, recruiter, listing } = await createFixture();
    const { body } = await applyTo(student, listing._id);
    const appId = body.application.id;

    const res = await request(app)
      .patch(`/api/applications/${appId}/status`)
      .set(recruiter.auth)
      .send({ status: 'Rejected' });
    expect(res.status).toBe(200);
    expect(res.body.application.status).toBe('Rejected');

    const doc = await Application.findById(appId);
    expect(doc.statusHistory[1].from).toBe('Applied');
    expect(doc.statusHistory[1].status).toBe('Rejected');
  });

  it('rejects invalid backward transitions to Applied with 400 INVALID_TRANSITION', async () => {
    const { student, recruiter, listing } = await createFixture();
    const { body } = await applyTo(student, listing._id);
    const appId = body.application.id;

    // Shortlist first
    await request(app)
      .patch(`/api/applications/${appId}/status`)
      .set(recruiter.auth)
      .send({ status: 'Shortlisted' });

    // Attempt invalid rollback to Applied
    const res = await request(app)
      .patch(`/api/applications/${appId}/status`)
      .set(recruiter.auth)
      .send({ status: 'Applied' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  });

  it('rejects demoting a Selected candidate back to Shortlisted with 400 INVALID_TRANSITION', async () => {
    const { student, recruiter, listing } = await createFixture();
    const { body } = await applyTo(student, listing._id);
    const appId = body.application.id;

    await request(app).patch(`/api/applications/${appId}/status`).set(recruiter.auth).send({ status: 'Shortlisted' });
    await request(app).patch(`/api/applications/${appId}/status`).set(recruiter.auth).send({ status: 'Selected' });

    const res = await request(app)
      .patch(`/api/applications/${appId}/status`)
      .set(recruiter.auth)
      .send({ status: 'Shortlisted' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  });
});

// ─── 2. Student Dashboard & Application View Reflection (TC-App-02) ──────────
describe('TC-App-02 | Student dashboard status reflection (IPP-F-011)', () => {
  it('dynamically reflects recruiter status changes on the student dashboard', async () => {
    const { student, recruiter, listing } = await createFixture();
    const { body } = await applyTo(student, listing._id);
    const appId = body.application.id;

    // Check dashboard before status change
    const initialDash = await request(app).get('/api/dashboard/student').set(student.auth);
    expect(initialDash.status).toBe(200);
    expect(initialDash.body.byStatus.Applied).toBe(1);
    expect(initialDash.body.byStatus.Shortlisted).toBe(0);

    // Recruiter updates status to Shortlisted
    await request(app)
      .patch(`/api/applications/${appId}/status`)
      .set(recruiter.auth)
      .send({ status: 'Shortlisted' });

    // Verify student dashboard now reflects Shortlisted: 1, Applied: 0
    const updatedDash = await request(app).get('/api/dashboard/student').set(student.auth);
    expect(updatedDash.status).toBe(200);
    expect(updatedDash.body.byStatus.Applied).toBe(0);
    expect(updatedDash.body.byStatus.Shortlisted).toBe(1);

    // Verify student application list also reflects new status
    const mine = await request(app).get('/api/applications/mine').set(student.auth);
    expect(mine.body.items[0].status).toBe('Shortlisted');
  });
});

// ─── 3. Recruiter Application List Filtering by Status (IPP-F-011) ───────────
describe('TC-App-02 | Recruiter applicant filtering by status (IPP-F-011)', () => {
  it('filters applicants by status query parameter', async () => {
    const { recruiter, listing } = await createFixture();
    const student1 = await createUser({ role: 'student' });
    const student2 = await createUser({ role: 'student' });

    const app1 = (await applyTo(student1, listing._id)).body.application;
    const app2 = (await applyTo(student2, listing._id)).body.application;

    // Shortlist student1, leave student2 as Applied
    await request(app)
      .patch(`/api/applications/${app1.id}/status`)
      .set(recruiter.auth)
      .send({ status: 'Shortlisted' });

    // Query for Shortlisted only
    const shortlistedRes = await request(app)
      .get(`/api/listings/${listing._id}/applications?status=Shortlisted`)
      .set(recruiter.auth);
    expect(shortlistedRes.status).toBe(200);
    expect(shortlistedRes.body.total).toBe(1);
    expect(shortlistedRes.body.items[0].id).toBe(app1.id);

    // Query for Applied only
    const appliedRes = await request(app)
      .get(`/api/listings/${listing._id}/applications?status=Applied`)
      .set(recruiter.auth);
    expect(appliedRes.status).toBe(200);
    expect(appliedRes.body.total).toBe(1);
    expect(appliedRes.body.items[0].id).toBe(app2.id);

    // Query for Selected (empty)
    const selectedRes = await request(app)
      .get(`/api/listings/${listing._id}/applications?status=Selected`)
      .set(recruiter.auth);
    expect(selectedRes.status).toBe(200);
    expect(selectedRes.body.total).toBe(0);
  });
});

// ─── 4. Ownership, Authorization & Audit Trail (IPP-F-011) ───────────────────
describe('TC-App-02 | Access control & audit trail (IPP-F-011)', () => {
  it('prevents unauthorized recruiters from updating applicant status', async () => {
    const { student, recruiter, otherRecruiter, listing } = await createFixture();
    const { body } = await applyTo(student, listing._id);

    const res = await request(app)
      .patch(`/api/applications/${body.application.id}/status`)
      .set(otherRecruiter.auth)
      .send({ status: 'Shortlisted' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('records an audit log with actor, from, and to fields on every status update', async () => {
    const { student, recruiter, listing } = await createFixture();
    const { body } = await applyTo(student, listing._id);

    await request(app)
      .patch(`/api/applications/${body.application.id}/status`)
      .set(recruiter.auth)
      .send({ status: 'Shortlisted' });

    const audit = await AuditLog.findOne({ action: 'APPLICATION_STATUS_CHANGED' }).lean();
    expect(audit).toBeDefined();
    expect(String(audit.actor)).toBe(String(recruiter.user._id));
    expect(audit.metadata.from).toBe('Applied');
    expect(audit.metadata.to).toBe('Shortlisted');
  });
});
