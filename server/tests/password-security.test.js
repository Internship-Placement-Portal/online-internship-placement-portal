// server/tests/password-security.test.js
// IPP-F-003 / TC-Auth-03: Password hashing, salting, and plaintext leakage prevention test suite.
// Acceptance criteria:
//   1. Passwords are stored exclusively as bcrypt hashes (never plaintext).
//   2. Unique salts are generated per user (identical passwords produce distinct hashes).
//   3. No endpoint (register, login, me, profile) ever leaks password hashes in the JSON response.
//   4. Bcrypt rounds meet security thresholds.
const { describe, it, before, after, beforeEach } = require('node:test');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const expect = require('./expect');
const app = require('../src/app');
const User = require('../src/models/User');
const { startDb, stopDb, clearDb, registerVerified, lastOtp } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

const BCRYPT_HASH_PATTERN = /^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}$/;

// ─── 1. Password Hashing and Storage Integrity (TC-Auth-03) ──────────────────
describe('TC-Auth-03 | Password hashing & salt uniqueness (IPP-F-003)', () => {
  it('stores passwords as valid bcrypt hashes and never as plaintext', async () => {
    const rawPassword = 'SecurePassword!123';
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Security Tester',
      email: 'sec_test@example.com',
      password: rawPassword,
      role: 'student',
    });
    expect(regRes.status).toBe(201);

    // Fetch the raw user document directly from MongoDB with select('+passwordHash')
    const userDoc = await User.findById(regRes.body.userId).select('+passwordHash').lean();
    expect(userDoc).toBeDefined();
    expect(userDoc.passwordHash).toBeDefined();

    // Verify it matches the bcrypt hash format: $2a$ or $2b$ with cost factor and 53 char salt+hash
    expect(BCRYPT_HASH_PATTERN.test(userDoc.passwordHash)).toBe(true);

    // Verify plaintext is never stored in any field of the document
    const serialized = JSON.stringify(userDoc);
    expect(serialized).not.toContain(rawPassword);

    // Verify bcrypt verifies the password correctly
    const matches = await bcrypt.compare(rawPassword, userDoc.passwordHash);
    expect(matches).toBe(true);

    // Verify wrong password fails
    const wrongMatches = await bcrypt.compare('WrongPassword!123', userDoc.passwordHash);
    expect(wrongMatches).toBe(false);
  });

  it('generates unique salts per user even when identical passwords are used', async () => {
    const commonPassword = 'IdenticalPassword!999';

    const user1 = await request(app).post('/api/auth/register').send({
      name: 'User One',
      email: 'user1@example.com',
      password: commonPassword,
      role: 'student',
    });

    const user2 = await request(app).post('/api/auth/register').send({
      name: 'User Two',
      email: 'user2@example.com',
      password: commonPassword,
      role: 'student',
    });

    const doc1 = await User.findById(user1.body.userId).select('+passwordHash').lean();
    const doc2 = await User.findById(user2.body.userId).select('+passwordHash').lean();

    // Hashes must be completely distinct because unique salts are generated for each user
    expect(doc1.passwordHash).not.toBe(doc2.passwordHash);
  });
});

// ─── 2. Plaintext and Hash Leakage Prevention (TC-Auth-03) ───────────────────
describe('TC-Auth-03 | API response credential hygiene (IPP-F-003)', () => {
  it('never returns password or passwordHash in registration, login, or profile responses', async () => {
    const password = 'HygienePassword!456';
    const email = 'hygiene@example.com';

    // 1. Registration endpoint response
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Hygiene User',
      email,
      password,
      role: 'student',
    });
    expect(JSON.stringify(regRes.body)).not.toContain('password');
    expect(JSON.stringify(regRes.body)).not.toContain('passwordHash');

    // Verify email to enable login
    await request(app).post('/api/auth/verify-email').send({
      userId: regRes.body.userId,
      otp: lastOtp(),
    });

    // 2. Login endpoint response
    const loginRes = await request(app).post('/api/auth/login').send({
      email,
      password,
    });
    expect(loginRes.status).toBe(200);
    expect(JSON.stringify(loginRes.body)).not.toContain('password');
    expect(JSON.stringify(loginRes.body)).not.toContain('passwordHash');

    const authHeader = { Authorization: `Bearer ${loginRes.body.token}` };

    // 3. GET /api/auth/me response
    const meRes = await request(app).get('/api/auth/me').set(authHeader);
    expect(meRes.status).toBe(200);
    expect(JSON.stringify(meRes.body)).not.toContain('password');
    expect(JSON.stringify(meRes.body)).not.toContain('passwordHash');

    // 4. GET /api/users/me response
    const profileRes = await request(app).get('/api/users/me').set(authHeader);
    expect(profileRes.status).toBe(200);
    expect(JSON.stringify(profileRes.body)).not.toContain('password');
    expect(JSON.stringify(profileRes.body)).not.toContain('passwordHash');
  });
});
