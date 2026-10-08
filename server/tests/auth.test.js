const { describe, it, before, after, beforeEach } = require('node:test');
const request = require('supertest');
const expect = require('./expect');
const express = require('express');
const app = require('../src/app');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const RefreshToken = require('../src/models/RefreshToken');
const { createRateLimiter } = require('../src/middleware/rateLimit');
const { startDb, stopDb, clearDb, lastOtp, registerVerified, createAdmin, creds } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('registration + email OTP (IPP-F-001, IPP-F-003)', () => {
  it('registers a student as pending_verification and stores only a bcrypt hash', async () => {
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending_verification');
    const user = await User.findById(res.body.userId).select('+passwordHash');
    expect(user.role).toBe('student');
    expect(user.emailVerified).toBe(false);
    expect(user.passwordHash).not.toContain(creds.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('recruiters start with approvalStatus pending', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...creds, role: 'recruiter' });
    expect((await User.findById(res.body.userId)).approvalStatus).toBe('pending');
  });

  it('rejects the admin role and invalid input with 400', async () => {
    expect((await request(app).post('/api/auth/register').send({ ...creds, role: 'admin' })).status).toBe(400);
    expect((await request(app).post('/api/auth/register').send({ ...creds, password: 'short' })).status).toBe(400);
    expect((await request(app).post('/api/auth/register').send({ ...creds, email: 'nope' })).status).toBe(400);
  });

  it('returns 409 for a duplicate email', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ status: 'error', code: 'EMAIL_EXISTS' });
  });

  it('blocks login until the OTP is verified, then allows it', async () => {
    const reg = await request(app).post('/api/auth/register').send(creds);
    const blocked = await login(creds.email, creds.password);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('EMAIL_NOT_VERIFIED');

    const bad = await request(app).post('/api/auth/verify-email').send({ userId: reg.body.userId, otp: '000000' });
    expect(bad.status).toBe(400);

    const good = await request(app).post('/api/auth/verify-email').send({ userId: reg.body.userId, otp: lastOtp() });
    expect(good.status).toBe(200);
    expect((await login(creds.email, creds.password)).status).toBe(200);
  });

  it('locks OTP guessing after too many wrong codes', async () => {
    const reg = await request(app).post('/api/auth/register').send(creds);
    const wrong = lastOtp() === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/verify-email').send({ userId: reg.body.userId, otp: wrong });
    }
    const res = await request(app).post('/api/auth/verify-email').send({ userId: reg.body.userId, otp: lastOtp() });
    expect(res.status).toBe(429);
  });
});

describe('login + JWT (IPP-F-002, IPP-SR-002)', () => {
  it('returns { token, expiresIn, role } and a refresh cookie', async () => {
    await registerVerified(app);
    const res = await login(creds.email, creds.password);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: 'student', expiresIn: 900 });
    expect(typeof res.body.token).toBe('string');
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/ipp_rt=.*HttpOnly/);
  });

  it('rejects wrong password and unknown email with the same 401', async () => {
    await registerVerified(app);
    const a = await login(creds.email, 'WrongPass1');
    const b = await login('ghost@example.com', 'WrongPass1');
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });

  it('GET /me requires a valid token', async () => {
    await registerVerified(app);
    const { body } = await login(creds.email, creds.password);
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage')).status).toBe(401);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(creds.email);
  });

  it('is not fooled by NoSQL operator payloads', async () => {
    await registerVerified(app);
    const res = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });
});

describe('account lockout (IPP-F-004)', () => {
  it('locks after 5 failures: 6th attempt gets 423 even with the right password, and an audit entry exists', async () => {
    await registerVerified(app);
    for (let i = 0; i < 5; i += 1) expect((await login(creds.email, 'WrongPass1')).status).toBe(401);

    const sixth = await login(creds.email, creds.password);
    expect(sixth.status).toBe(423);
    expect(sixth.body.code).toBe('ACCOUNT_LOCKED');
    expect(await AuditLog.countDocuments({ action: 'LOGIN_LOCKOUT' })).toBe(1);
  });

  it('unlocks once the lock window has passed and resets the counter', async () => {
    await registerVerified(app);
    for (let i = 0; i < 5; i += 1) await login(creds.email, 'WrongPass1');
    await User.updateOne({ email: creds.email }, { lockUntil: new Date(Date.now() - 1000) });
    expect((await login(creds.email, creds.password)).status).toBe(200);
    expect((await User.findOne({ email: creds.email })).failedLoginAttempts).toBe(0);
  });

  it('a successful login resets the failure counter', async () => {
    await registerVerified(app);
    for (let i = 0; i < 4; i += 1) await login(creds.email, 'WrongPass1');
    await login(creds.email, creds.password);
    for (let i = 0; i < 4; i += 1) expect((await login(creds.email, 'WrongPass1')).status).toBe(401);
  });
});

describe('refresh + logout (IPP-SR-002)', () => {
  const cookieOf = (res) => res.headers['set-cookie'][0].split(';')[0];

  it('rotates the refresh token and rejects reuse of the old one', async () => {
    await registerVerified(app);
    const first = await login(creds.email, creds.password);
    const c1 = cookieOf(first);

    const second = await request(app).post('/api/auth/refresh').set('Cookie', c1);
    expect(second.status).toBe(200);
    expect(second.body.token).toBeDefined();
    const c2 = cookieOf(second);
    expect(c2).not.toBe(c1);

    // reusing c1 = theft signal: rejected and the whole family revoked, so c2 stops working too
    expect((await request(app).post('/api/auth/refresh').set('Cookie', c1)).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', c2)).status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    await registerVerified(app);
    const c = cookieOf(await login(creds.email, creds.password));
    expect((await request(app).post('/api/auth/logout').set('Cookie', c)).status).toBe(204);
    expect((await request(app).post('/api/auth/refresh').set('Cookie', c)).status).toBe(401);
    expect(await RefreshToken.countDocuments({ revokedAt: { $exists: false } })).toBe(0);
  });

  it('refresh without a cookie is 401', async () => {
    expect((await request(app).post('/api/auth/refresh')).status).toBe(401);
  });
});

describe('RBAC (IPP-F-023, IPP-SR-006)', () => {
  const tokenFor = async (overrides) => {
    const u = await registerVerified(app, overrides);
    return (await login(u.email, u.password)).body.token;
  };

  it('allows the matching role and returns 403 + audit entry otherwise', async () => {
    const student = await tokenFor();
    const ok = await request(app).get('/api/rbac/student').set('Authorization', `Bearer ${student}`);
    expect(ok.status).toBe(200);

    const denied = await request(app).get('/api/rbac/admin').set('Authorization', `Bearer ${student}`);
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('FORBIDDEN');
    expect(await AuditLog.countDocuments({ action: 'RBAC_DENIED' })).toBe(1);
    expect((await request(app).get('/api/rbac/recruiter').set('Authorization', `Bearer ${student}`)).status).toBe(403);
  });

  it('admin and recruiter only reach their own routes; anonymous gets 401', async () => {
    const admin = await createAdmin();
    const adminToken = (await login(admin.email, admin.password)).body.token;
    const recruiterToken = await tokenFor({ email: 'r@example.com', role: 'recruiter' });

    expect((await request(app).get('/api/rbac/admin').set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
    expect((await request(app).get('/api/rbac/student').set('Authorization', `Bearer ${adminToken}`)).status).toBe(403);
    expect((await request(app).get('/api/rbac/recruiter').set('Authorization', `Bearer ${recruiterToken}`)).status).toBe(200);
    expect((await request(app).get('/api/rbac/admin').set('Authorization', `Bearer ${recruiterToken}`)).status).toBe(403);
    expect((await request(app).get('/api/rbac/student')).status).toBe(401);
  });

  it('a deactivated user is cut off immediately', async () => {
    const token = await tokenFor();
    await User.updateOne({ email: creds.email }, { isActive: false });
    expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(401);
  });
});

describe('rate limiting (IPP-SR-004)', () => {
  it('returns 429 once the threshold is exceeded', async () => {
    const mini = express();
    mini.use(createRateLimiter({ max: 3 }));
    mini.get('/x', (req, res) => res.json({ ok: true }));
    for (let i = 0; i < 3; i += 1) expect((await request(mini).get('/x')).status).toBe(200);
    const res = await request(mini).get('/x');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
  });
});

describe('error handling', () => {
  it('unknown route returns the JSON envelope; malformed JSON returns 400', async () => {
    const nf = await request(app).get('/api/nope');
    expect(nf.status).toBe(404);
    expect(nf.body).toMatchObject({ status: 'error', code: 'NOT_FOUND' });
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{oops');
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('INVALID_JSON');
    expect(bad.body.stack).toBeUndefined();
  });
});
