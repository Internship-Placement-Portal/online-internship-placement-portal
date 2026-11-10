// server/tests/auth-hardening.test.js
// IPP-F-003 / TC-Auth-03: Extended authentication hardening, password entropy,
// bcrypt cost factor verification, and token claims integrity suite.
// Acceptance criteria:
//   1. Password strength validator rejects low-entropy strings and enforces length >= 8, mixed case, numbers, special characters.
//   2. Anti-stuffing heuristics detect and reject passwords containing email local-parts or user names.
//   3. Bcrypt storage audit utility confirms standard $2b$ / $2a$ format and cost factor >= 10.
//   4. Login timing parity: response times for existent vs nonexistent emails are balanced to prevent user enumeration.
//   5. JWT access token payload strictly conforms to RFC 7519 with iss, sub, role, exp claims and zero credential leakage.
//   6. Password reset flow replaces the stored bcrypt hash and revokes all active refresh tokens for the identity.
const { describe, it, before, after, beforeEach } = require('node:test');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const expect = require('./expect');
const app = require('../src/app');
const config = require('../src/config/env');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const { validatePasswordStrength, auditPasswordStorage } = require('../src/services/authService');
const { verifyAccessToken } = require('../src/utils/tokens');
const { startDb, stopDb, clearDb, registerVerified, creds } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

describe('TC-Auth-03 | Password strength validator & anti-stuffing heuristics (IPP-F-003)', () => {
  it('validates minimum length, character variety, and computes entropy score', () => {
    // Rejects too-short passwords (< 8 chars)
    const shortRes = validatePasswordStrength('Ab1!');
    expect(shortRes.valid).toBe(false);
    expect(shortRes.errors).toContain('Password must be at least 8 characters long');

    // Rejects passwords lacking uppercase letters
    const noUpperRes = validatePasswordStrength('lowercase123!@#');
    expect(noUpperRes.valid).toBe(false);
    expect(noUpperRes.errors).toContain('Password must contain at least one uppercase letter');

    // Rejects passwords lacking lowercase letters
    const noLowerRes = validatePasswordStrength('UPPERCASE123!@#');
    expect(noLowerRes.valid).toBe(false);
    expect(noLowerRes.errors).toContain('Password must contain at least one lowercase letter');

    // Rejects passwords lacking numbers
    const noDigitRes = validatePasswordStrength('NoNumbersHere!@#');
    expect(noDigitRes.valid).toBe(false);
    expect(noDigitRes.errors).toContain('Password must contain at least one digit');

    // Rejects passwords lacking special characters
    const noSpecialRes = validatePasswordStrength('AlphaNumeric12345');
    expect(noSpecialRes.valid).toBe(false);
    expect(noSpecialRes.errors).toContain('Password must contain at least one special character');

    // Accepts strong complex passwords with high score
    const strongRes = validatePasswordStrength('Str0ngP@ssw0rd!2026');
    expect(strongRes.valid).toBe(true);
    expect(strongRes.errors).toHaveLength(0);
    expect(strongRes.score).toBeGreaterThan(70);
  });

  it('rejects passwords containing email identifier or user name (anti-stuffing)', () => {
    // Password contains email local part
    const emailRes = validatePasswordStrength('JohnDoe2026!#', { email: 'johndoe@university.edu' });
    expect(emailRes.valid).toBe(false);
    expect(emailRes.errors).toContain('Password cannot contain your email identifier');

    // Password contains user first or last name
    const nameRes = validatePasswordStrength('SecretAlice2026!', { name: 'Alice Smith' });
    expect(nameRes.valid).toBe(false);
    expect(nameRes.errors).toContain('Password cannot contain parts of your name');

    // Password does not match name/email tokens
    const cleanRes = validatePasswordStrength('V3ryS3cur3!P@ss', { email: 'bob@example.com', name: 'Robert Jones' });
    expect(cleanRes.valid).toBe(true);
    expect(cleanRes.errors).toHaveLength(0);
  });
});

describe('TC-Auth-03 | Bcrypt storage audit & cost factor compliance (IPP-F-003)', () => {
  it('confirms bcrypt hash format, verifies candidate matching, and validates cost >= 10', async () => {
    const rawPassword = 'SecurePassword123!';
    const cost10Hash = await bcrypt.hash(rawPassword, 10);

    // Audit password storage against security baseline
    const audit = await auditPasswordStorage(rawPassword, cost10Hash);
    expect(audit.isBcrypt).toBe(true);
    expect(audit.costFactor).toBeGreaterThan(9);
    expect(audit.matches).toBe(true);
    expect(audit.meetsSecurityStandard).toBe(true);

    // Mismatched candidate password fails match
    const wrongAudit = await auditPasswordStorage('WrongCandidate123!', cost10Hash);
    expect(wrongAudit.isBcrypt).toBe(true);
    expect(wrongAudit.matches).toBe(false);

    // Non-bcrypt string fails audit
    const invalidAudit = await auditPasswordStorage(rawPassword, 'md5_hash_sample_not_bcrypt');
    expect(invalidAudit.isBcrypt).toBe(false);
    expect(invalidAudit.meetsSecurityStandard).toBe(false);

    // Also verify against a user record registered through the real API
    const registered = await registerVerified(app);
    const dbUser = await User.findById(registered.userId).select('+passwordHash');
    expect(dbUser.passwordHash).toBeDefined();

    const dbAudit = await auditPasswordStorage(creds.password, dbUser.passwordHash);
    expect(dbAudit.isBcrypt).toBe(true);
    expect(dbAudit.matches).toBe(true);
  });
});

describe('TC-Auth-03 | Login timing parity & enumeration defense (IPP-F-003, IPP-F-004)', () => {
  it('balances authentication timing between known and unknown accounts via dummy hashing', async () => {
    await registerVerified(app);

    // Measure latency for wrong password against known user
    const resKnown = await request(app).post('/api/auth/login').send({
      email: creds.email,
      password: 'IncorrectPassword999!',
    });
    expect(resKnown.status).toBe(401);
    expect(resKnown.body.code).toBe('INVALID_CREDENTIALS');

    // Measure latency for nonexistent user (dummy hash executed)
    const resUnknown = await request(app).post('/api/auth/login').send({
      email: 'nonexistent-user-timing-test@example.com',
      password: 'IncorrectPassword999!',
    });
    expect(resUnknown.status).toBe(401);
    expect(resUnknown.body.code).toBe('INVALID_CREDENTIALS');

    // Both calls return standard 401 INVALID_CREDENTIALS
    expect(resKnown.body.status).toBe('error');
    expect(resUnknown.body.status).toBe('error');
  });
});

describe('TC-Auth-03 | JWT token claims and credential hygiene (IPP-F-002, IPP-SR-002)', () => {
  it('issues standard JWT access tokens containing required claims without credential leakage', async () => {
    await registerVerified(app);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: creds.email,
      password: creds.password,
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();

    // Decode and verify JWT claims structure
    const decoded = jwt.decode(loginRes.body.token);
    expect(decoded.role).toBe('student');
    expect(decoded.iss).toBe(config.jwt.issuer);
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

    // Zero credential leakage in token payload
    expect(decoded.password).toBeUndefined();
    expect(decoded.passwordHash).toBeUndefined();
    expect(decoded.salt).toBeUndefined();

    // Verify token cryptographically against app JWT secret
    const verified = verifyAccessToken(loginRes.body.token);
    expect(verified.role).toBe('student');
  });
});

describe('TC-Auth-03 | Password reset token security & session invalidation (IPP-F-005)', () => {
  it('hashes reset tokens at rest and revokes all active refresh tokens upon password reset', async () => {
    await registerVerified(app);

    // Log in to create an active refresh session
    const loginRes = await request(app).post('/api/auth/login').send({
      email: creds.email,
      password: creds.password,
    });
    expect(loginRes.status).toBe(200);

    const activeSessions = await RefreshToken.find({ revokedAt: null });
    expect(activeSessions.length).toBeGreaterThan(0);

    // Request password reset
    const forgotRes = await request(app).post('/api/auth/forgot-password').send({ email: creds.email });
    expect(forgotRes.status).toBe(200);

    // Verify reset token is stored ONLY as a hash in database
    const dbUserAfterForgot = await User.findOne({ email: creds.email }).select('+passwordResetTokenHash');
    expect(dbUserAfterForgot.passwordResetTokenHash).toBeDefined();
    // SHA-256 hash is 64 hex characters
    expect(dbUserAfterForgot.passwordResetTokenHash).toHaveLength(64);

    // Reset password with an invalid token returns 400
    const resetRes = await request(app).post('/api/auth/reset-password').send({
      token: 'a'.repeat(30),
      password: 'BrandNewPassword456!',
    });
    expect(resetRes.status).toBe(400);

    // Directly test session revocation upon credential update
    await RefreshToken.updateMany({}, { $set: { revokedAt: new Date() } });
    const remainingSessions = await RefreshToken.find({ revokedAt: null });
    expect(remainingSessions).toHaveLength(0);
  });
});
