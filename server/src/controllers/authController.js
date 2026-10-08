const config = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

const ctxOf = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

// Refresh token travels only in an httpOnly cookie scoped to the auth routes.
const cookieOptions = (expires) => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: process.env.COOKIE_SAMESITE || 'lax',
  path: '/api/auth',
  ...(expires && { expires }),
});

const sendSession = (res, status, issued) => {
  res.cookie(config.refresh.cookieName, issued.refreshToken, cookieOptions(issued.refreshExpiresAt));
  res.status(status).json(issued.body);
};

const register = asyncHandler(async (req, res) => {
  res.status(201).json(await authService.register(req.body, ctxOf(req)));
});

const verifyEmail = asyncHandler(async (req, res) => {
  res.json(await authService.verifyEmail(req.body, ctxOf(req)));
});

const resendOtp = asyncHandler(async (req, res) => {
  res.json(await authService.resendOtp(req.body));
});

const login = asyncHandler(async (req, res) => {
  sendSession(res, 200, await authService.login(req.body, ctxOf(req)));
});

const refresh = asyncHandler(async (req, res) => {
  try {
    sendSession(res, 200, await authService.refresh(req.cookies[config.refresh.cookieName], ctxOf(req)));
  } catch (err) {
    res.clearCookie(config.refresh.cookieName, cookieOptions());
    throw err;
  }
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies[config.refresh.cookieName]);
  res.clearCookie(config.refresh.cookieName, cookieOptions());
  res.status(204).end();
});

const me = (req, res) => res.json({ user: req.user.toSafeJSON() });

module.exports = { register, verifyEmail, resendOtp, login, refresh, logout, me };
