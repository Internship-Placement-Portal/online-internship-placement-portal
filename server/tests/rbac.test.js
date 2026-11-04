// server/tests/rbac.test.js
// IPP-F-023 / TC-Admin-02: Dedicated RBAC hardening tests.
// Covers the enhancements added to server/src/middleware/rbac.js:
//   1. INVALID_ROLE (400) for tokens with an unrecognised role.
//   2. requiredRoles is present in every RBAC_DENIED audit log entry.
//   3. Audit-DB failure does NOT turn a 403 denial into a 500 error.
//   4. Unapproved recruiter receives 403 RECRUITER_NOT_APPROVED.
//   5. Smoke-checks that anonymous → 401 and wrong-role → 403 still hold.
const { describe, it, before, after, afterEach } = require('node:test');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const AuditLog = require('../src/models/AuditLog');
const auditService = require('../src/services/auditService');
const { signAccessToken } = require('../src/utils/tokens');
const { startDb, stopDb, clearDb, createUser } = require('./helpers');

// A protected endpoint that only admins may call — used as a stable test target.
const ADMIN_ONLY = '/api/admin/recruiters';
// A protected endpoint that only students may call.
const STUDENT_ONLY = '/api/tests';

before(async () => {
  await startDb();
  await clearDb();
});
after(stopDb);
afterEach(clearDb);

// ─── 1. Anonymous access ─────────────────────────────────────────────────────
describe('TC-Admin-02 | Anonymous callers (IPP-F-023)', () => {
  it('returns 401 on a protected endpoint when no token is supplied', async () => {
    const res = await request(app).get(ADMIN_ONLY);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });
});

// ─── 2. Wrong-role access + audit log enrichment ─────────────────────────────
describe('TC-Admin-02 | Wrong-role callers (IPP-F-023)', () => {
  it('returns 403 FORBIDDEN when a student calls an admin-only route', async () => {
    const student = await createUser({ role: 'student' });
    const res = await request(app).get(ADMIN_ONLY).set(student.auth);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('returns 403 FORBIDDEN when an admin calls a student-only route', async () => {
    const admin = await createUser({ role: 'admin' });
    const res = await request(app).get(STUDENT_ONLY).set(admin.auth);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('writes an audit entry that includes requiredRoles in metadata', async () => {
    const student = await createUser({ role: 'student' });
    await request(app).get(ADMIN_ONLY).set(student.auth);

    const logs = await AuditLog.find({ action: 'RBAC_DENIED' }).lean();
    expect(logs.length).toBeGreaterThan(0);

    const entry = logs[0];
    expect(entry.metadata.requiredRoles).toBeDefined();
    // The admin-only route requires the 'admin' role.
    expect(entry.metadata.requiredRoles).toEqual(['admin']);
  });

  it('records the actual role of the denied user in audit metadata', async () => {
    const student = await createUser({ role: 'student' });
    await request(app).get(ADMIN_ONLY).set(student.auth);

    const log = await AuditLog.findOne({ action: 'RBAC_DENIED' }).lean();
    expect(log.metadata.role).toBe('student');
  });
});

// ─── 3. Invalid / unknown role ────────────────────────────────────────────────
describe('TC-Admin-02 | Invalid role in token (IPP-F-023)', () => {
  it('returns 400 INVALID_ROLE when the token contains an unrecognised role', async () => {
    // Forge a user object in memory — never saved to DB — with a bogus role.
    const fakeUser = { _id: '64b000000000000000000001', role: 'superuser' };
    const badToken = signAccessToken(fakeUser);

    const res = await request(app)
      .get(ADMIN_ONLY)
      .set('Authorization', `Bearer ${badToken}`);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ROLE');
  });
});

// ─── 4. Unapproved recruiter ──────────────────────────────────────────────────
describe('TC-Admin-02 | Unapproved recruiter (IPP-F-023)', () => {
  it('returns 403 RECRUITER_NOT_APPROVED when recruiter is pending', async () => {
    // Create a recruiter-role user whose approvalStatus is 'pending'.
    const pending = await createUser({ role: 'recruiter', approvalStatus: 'pending' });
    const res = await request(app)
      .get('/api/listings/mine')
      .set(pending.auth);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('RECRUITER_NOT_APPROVED');
  });

  it('allows an approved recruiter through the gate on recruiter-only routes', async () => {
    const approved = await createUser({ role: 'recruiter', approvalStatus: 'approved' });
    const res = await request(app)
      .get('/api/listings/mine')
      .set(approved.auth);

    // Any status other than 401/403 means the RBAC gate was passed successfully.
    expect([401, 403].includes(res.status)).toBe(false);
  });
});

// ─── 5. Audit-DB failure resilience ──────────────────────────────────────────
describe('TC-Admin-02 | Audit-DB failure resilience (IPP-F-023)', () => {
  it('still returns 403 (not 500) when the audit service throws', async () => {
    // Temporarily make auditService.record throw to simulate a DB outage.
    const original = auditService.record;
    auditService.record = async () => { throw new Error('Simulated audit DB failure'); };

    try {
      const student = await createUser({ role: 'student' });
      const res = await request(app).get(ADMIN_ONLY).set(student.auth);
      // The request must still be denied — a broken audit service must not cause 500.
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    } finally {
      // Always restore the original so other tests are unaffected.
      auditService.record = original;
    }
  });
});
