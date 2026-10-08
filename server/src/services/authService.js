const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config/env');
const AppError = require('../utils/AppError');
const { signAccessToken, randomToken, sha256, generateOtp } = require('../utils/tokens');
const userRepository = require('../repositories/userRepository');
const refreshTokenRepository = require('../repositories/refreshTokenRepository');
const auditService = require('./auditService');
const mailer = require('./mailer');

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', config.bcryptRounds);

const safeEqual = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

async function issueAndSendOtp(user) {
  const otp = generateOtp();
  await userRepository.updateById(user._id, {
    otpHash: sha256(`${user._id}:${otp}`),
    otpExpiresAt: new Date(Date.now() + config.otp.ttlMinutes * MIN),
    otpAttempts: 0,
  });
  await mailer.send({
    to: user.email,
    subject: 'Verify your IPP account',
    text: `Your verification code is ${otp}. It expires in ${config.otp.ttlMinutes} minutes.`,
  });
}

// IPP-F-001: register, then the account stays unusable until the emailed OTP is verified.
async function register({ name, email, password, role }, ctx = {}) {
  if (await userRepository.findByEmail(email)) throw new AppError(409, 'EMAIL_EXISTS', 'Email already registered');

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds); // IPP-F-003
  let user;
  try {
    user = await userRepository.create({
      name,
      email,
      passwordHash,
      role,
      approvalStatus: role === 'recruiter' ? 'pending' : 'approved', // IPP-F-022
    });
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'EMAIL_EXISTS', 'Email already registered');
    throw err;
  }

  await issueAndSendOtp(user);
  await auditService.record({ actor: user._id, action: 'USER_REGISTERED', targetType: 'User', targetId: user._id, metadata: { role }, ip: ctx.ip });
  return { status: 'pending_verification', userId: String(user._id) };
}

async function verifyEmail({ userId, otp }, ctx = {}) {
  const invalid = () => new AppError(400, 'INVALID_OTP', 'Invalid or expired verification code');
  const user = await userRepository.findByIdWithOtp(userId);
  if (!user) throw invalid();
  if (user.emailVerified) throw new AppError(400, 'ALREADY_VERIFIED', 'Email already verified');
  if (!user.otpHash || !user.otpExpiresAt || user.otpExpiresAt < new Date()) throw invalid();
  if (user.otpAttempts >= config.otp.maxAttempts) {
    throw new AppError(429, 'OTP_ATTEMPTS_EXCEEDED', 'Too many incorrect codes. Request a new code.');
  }

  if (!safeEqual(sha256(`${user._id}:${otp}`), user.otpHash)) {
    await userRepository.updateById(user._id, { $inc: { otpAttempts: 1 } });
    throw invalid();
  }

  await userRepository.updateById(user._id, {
    emailVerified: true,
    $unset: { otpHash: 1, otpExpiresAt: 1, otpAttempts: 1 },
  });
  await auditService.record({ actor: user._id, action: 'EMAIL_VERIFIED', targetType: 'User', targetId: user._id, ip: ctx.ip });
  return { status: 'verified' };
}

// Always succeeds from the caller's view so it can't be used to probe which emails exist.
async function resendOtp({ email }) {
  const user = await userRepository.findByEmail(email);
  if (user && !user.emailVerified && user.isActive) await issueAndSendOtp(user);
  return { status: 'sent' };
}

async function issueTokens(user, ctx = {}) {
  const refreshToken = randomToken();
  const expiresAt = new Date(Date.now() + config.refresh.expiresDays * DAY);
  const record = await refreshTokenRepository.create({
    user: user._id,
    tokenHash: sha256(refreshToken),
    expiresAt,
    createdByIp: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return {
    refreshToken,
    refreshExpiresAt: expiresAt,
    refreshRecordId: record._id,
    body: {
      token: signAccessToken(user),
      expiresIn: config.jwt.accessExpiresMin * 60,
      role: user.role,
      user: user.toSafeJSON(),
    },
  };
}

// IPP-F-002 + IPP-F-004
async function login({ email, password }, ctx = {}) {
  const user = await userRepository.findByEmail(email, { withPassword: true });
  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const now = new Date();
  if (user.lockUntil && user.lockUntil > now) {
    const minutes = Math.ceil((user.lockUntil - now) / MIN);
    throw new AppError(423, 'ACCOUNT_LOCKED', `Account locked due to repeated failed logins. Try again in ${minutes} minute(s).`);
  }
  if (user.lockUntil) {
    // Lock window has passed: start counting afresh.
    await userRepository.updateById(user._id, { failedLoginAttempts: 0, $unset: { lockUntil: 1 } });
    user.failedLoginAttempts = 0;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const updated = await userRepository.incrementFailedLogins(user._id);
    if (updated.failedLoginAttempts >= config.lockout.maxAttempts) {
      await userRepository.updateById(user._id, { lockUntil: new Date(Date.now() + config.lockout.lockMinutes * MIN) });
      await auditService.record({
        actor: user._id,
        action: 'LOGIN_LOCKOUT',
        targetType: 'User',
        targetId: user._id,
        metadata: { attempts: updated.failedLoginAttempts, lockMinutes: config.lockout.lockMinutes },
        ip: ctx.ip,
      });
    }
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (!user.isActive) throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  if (!user.emailVerified) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email before logging in', [{ field: 'userId', message: String(user._id) }]);
  }

  if (user.failedLoginAttempts) await userRepository.updateById(user._id, { failedLoginAttempts: 0 });
  return issueTokens(user, ctx);
}

// Rotating refresh tokens (IPP-SR-002). Re-use of a revoked token signals theft: revoke everything for that user.
async function refresh(rawToken, ctx = {}) {
  if (!rawToken) throw new AppError(401, 'NO_REFRESH_TOKEN', 'Refresh token missing');
  const record = await refreshTokenRepository.findByHash(sha256(rawToken));
  if (!record || record.expiresAt < new Date()) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');

  if (record.revokedAt) {
    await refreshTokenRepository.revokeAllForUser(record.user);
    await auditService.record({ actor: record.user, action: 'REFRESH_TOKEN_REUSE', targetType: 'User', targetId: record.user, ip: ctx.ip });
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }

  const user = await userRepository.findById(record.user);
  if (!user || !user.isActive) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');

  const issued = await issueTokens(user, ctx);
  await refreshTokenRepository.revoke(record._id, issued.refreshRecordId);
  return issued;
}

async function logout(rawToken) {
  if (!rawToken) return;
  const record = await refreshTokenRepository.findByHash(sha256(rawToken));
  if (record && !record.revokedAt) await refreshTokenRepository.revoke(record._id);
}

module.exports = { register, verifyEmail, resendOtp, login, refresh, logout };
