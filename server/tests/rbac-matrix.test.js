// IPP-SR-006 / IPP-F-023: automated RBAC test suite over EVERY endpoint.
//  1. The route table is read from the live Express app, so a new endpoint without a declared access rule fails this suite.
//  2. For every protected endpoint: anonymous → 401; each role outside the allowed set → 403 (and audited);
//     each allowed role gets past the gate (anything except 401/403).
const { describe, it, before, after } = require('node:test');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const AuditLog = require('../src/models/AuditLog');
const { listRoutes } = require('./routeList');
const { startDb, stopDb, clearDb, createUser } = require('./helpers');

const S = 'student';
const R = 'recruiter';
const A = 'admin';
const ANY = [S, R, A];
const PUBLIC = 'public';

// The access-control matrix: who may call what. This is the single source of truth for RBAC in the API.
const MATRIX = {
  'GET /health': PUBLIC,
  'GET /api/health': PUBLIC,
  'POST /api/auth/register': PUBLIC,
  'POST /api/auth/verify-email': PUBLIC,
  'POST /api/auth/resend-otp': PUBLIC,
  'POST /api/auth/login': PUBLIC,
  'POST /api/auth/refresh': PUBLIC, // authenticated by the httpOnly refresh cookie, not a bearer token
  'POST /api/auth/logout': PUBLIC,
  'POST /api/auth/forgot-password': PUBLIC,
  'POST /api/auth/reset-password': PUBLIC,

  'GET /api/auth/me': ANY,
  'GET /api/users/me': ANY,
  'PATCH /api/users/me': ANY,
  'GET /api/notifications': ANY,
  'POST /api/notifications/read-all': ANY,
  'PATCH /api/notifications/:id/read': ANY,

  'GET /api/listings/domains': ANY,
  'GET /api/listings': [S],
  'GET /api/listings/mine': [R],
  'POST /api/listings': [R],
  'GET /api/listings/:id': ANY,
  'PATCH /api/listings/:id': [R],
  'POST /api/listings/:id/close': [R],
  'GET /api/listings/:id/applications': [R],

  'POST /api/applications': [S],
  'GET /api/applications/mine': [S],
  'GET /api/applications/:id': [S, R],
  'GET /api/applications/:id/resume': [S, R],
  'PATCH /api/applications/:id/status': [R],
  'PUT /api/applications/:id/interview': [R],

  'GET /api/tests': [S],
  'POST /api/tests/:id/start': [S],
  'GET /api/attempts/mine': [S],
  'GET /api/attempts/:id': [S],
  'PUT /api/attempts/:id/answers': [S],
  'POST /api/attempts/:id/submit': [S],
  'GET /api/attempts/:id/result': [S],

  'GET /api/dashboard/student': [S],
  'GET /api/dashboard/placement': [A],
  'GET /api/dashboard/placement/export': [A],

  'GET /api/admin/recruiters': [A],
  'PATCH /api/admin/recruiters/:id': [A],
  'GET /api/admin/listings': [A],
  'PATCH /api/admin/listings/:id': [A],
  'GET /api/admin/questions': [A],
  'GET /api/admin/questions/categories': [A],
  'POST /api/admin/questions': [A],
  'PATCH /api/admin/questions/:id': [A],
  'DELETE /api/admin/questions/:id': [A],
  'GET /api/admin/tests': [A],
  'POST /api/admin/tests': [A],
  'PATCH /api/admin/tests/:id': [A],
  'GET /api/admin/tests/:id/attempts': [A],
  'GET /api/admin/students/:id/attempts': [A],
  'POST /api/admin/attempts/:id/reenable': [A],
  'GET /api/admin/audit-logs': [A],
  'GET /api/admin/audit-logs/actions': [A],
};

const ID = '64b000000000000000000000';
const concrete = (path) => path.replace(/:\w+/g, ID);
const send = (method, path, auth) => {
  const req = request(app)[method.toLowerCase()](concrete(path));
  if (auth) req.set(auth);
  // Bodies are intentionally empty/invalid: authentication + RBAC must reject BEFORE validation or business logic runs.
  return ['POST', 'PUT', 'PATCH'].includes(method) ? req.send({}) : req;
};

let users;
before(async () => {
  await startDb();
  await clearDb();
  users = { [S]: await createUser({ role: S }), [R]: await createUser({ role: R }), [A]: await createUser({ role: A }) };
});
after(stopDb);

describe('RBAC matrix covers every endpoint (IPP-SR-006)', () => {
  const routes = listRoutes(app);

  it('every registered route has a declared access rule, and no rule is stale', () => {
    const undeclared = routes.filter((r) => !(r in MATRIX));
    const stale = Object.keys(MATRIX).filter((r) => !routes.includes(r));
    expect(undeclared).toEqual([]);
    expect(stale).toEqual([]);
    expect(routes.length).toBeGreaterThan(50);
  });

  it('the temporary /api/rbac probe routes are gone', () => {
    expect(routes.filter((r) => r.includes('/rbac'))).toEqual([]);
  });
});

describe('RBAC matrix: enforcement per endpoint (IPP-F-023)', () => {
  const protectedRoutes = Object.entries(MATRIX).filter(([, roles]) => roles !== PUBLIC);

  it(`rejects anonymous callers with 401 on all ${protectedRoutes.length} protected endpoints`, async () => {
    const failures = [];
    for (const [route] of protectedRoutes) {
      const [method, path] = route.split(' ');
      const res = await send(method, path);
      if (res.status !== 401) failures.push(`${route} → ${res.status}`);
    }
    expect(failures).toEqual([]);
  });

  it('rejects every role outside the allowed set with 403 on every protected endpoint', async () => {
    const failures = [];
    let checks = 0;
    for (const [route, allowed] of protectedRoutes) {
      const [method, path] = route.split(' ');
      for (const role of ANY.filter((r) => !allowed.includes(r))) {
        checks += 1;
        const res = await send(method, path, users[role].auth);
        if (res.status !== 403) failures.push(`${route} as ${role} → ${res.status}`);
      }
    }
    expect(failures).toEqual([]);
    expect(checks).toBeGreaterThan(60);
    expect(await AuditLog.countDocuments({ action: 'RBAC_DENIED' })).toBe(checks); // every denial is logged
  });

  it('lets every allowed role through the gate (any status other than 401/403)', async () => {
    const failures = [];
    for (const [route, allowed] of protectedRoutes) {
      const [method, path] = route.split(' ');
      for (const role of allowed) {
        const res = await send(method, path, users[role].auth);
        if ([401, 403].includes(res.status)) failures.push(`${route} as ${role} → ${res.status}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('rejects malformed, expired-looking and tampered bearer tokens on a protected endpoint', async () => {
    for (const header of ['Bearer', 'Bearer not.a.jwt', 'Basic abc', `Bearer ${users[S].token.slice(0, -3)}xyz`]) {
      expect((await request(app).get('/api/applications/mine').set('Authorization', header)).status).toBe(401);
    }
  });
});
