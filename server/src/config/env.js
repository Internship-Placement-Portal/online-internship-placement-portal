require('dotenv').config({ quiet: true });
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const required = ['MONGODB_URI', 'JWT_ACCESS_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length && !isTest) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}
if (isProd && process.env.JWT_ACCESS_SECRET.length < 32) {
  throw new Error('JWT_ACCESS_SECRET must be at least 32 characters in production');
}

const int = (v, d) => (v === undefined || v === '' ? d : parseInt(v, 10));

// IPP-SR-002: access tokens live at most 60 minutes.
const accessMinutes = Math.min(int(process.env.JWT_ACCESS_EXPIRES_MIN, 15), 60);

const config = {
  env: process.env.NODE_ENV || 'development',
  isProd,
  isTest,
  port: int(process.env.PORT, 5000),
  mongoUri: process.env.MONGODB_URI,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'test-secret-test-secret-test-secret-123',
    accessExpiresMin: accessMinutes,
    issuer: 'ipp-api',
  },
  refresh: {
    expiresDays: int(process.env.REFRESH_TOKEN_EXPIRES_DAYS, 7),
    cookieName: 'ipp_rt',
  },
  bcryptRounds: int(process.env.BCRYPT_ROUNDS, isTest ? 4 : 12),
  lockout: { maxAttempts: 5, lockMinutes: 15 }, // IPP-F-004
  otp: { ttlMinutes: 10, maxAttempts: 5 },
  passwordReset: { ttlMinutes: 30 }, // IPP-F-005
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    authMax: int(process.env.RATE_LIMIT_AUTH_MAX, 30),
    apiMax: int(process.env.RATE_LIMIT_API_MAX, 300),
    uploadMax: int(process.env.RATE_LIMIT_UPLOAD_MAX, 10), // IPP-SR-004: resume uploads per window
  },
  // Resume storage (local disk in development; swap StorageService for cloud storage later).
  upload: {
    dir: path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads')),
    maxBytes: 5 * 1024 * 1024, // IPP-SR-005 / IPP-F-010: 5 MB
  },
  clamav: { host: process.env.CLAMAV_HOST || '', port: int(process.env.CLAMAV_PORT, 3310) },
  // "console" prints mails (incl. OTPs) for local development only; never allowed in production.
  mailTransport: process.env.MAIL_TRANSPORT || (process.env.SMTP_HOST ? 'smtp' : isProd ? 'none' : isTest ? 'memory' : 'console'),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: int(process.env.SMTP_PORT, 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'IPP <no-reply@ipp.local>',
  },
  dnsServers: (process.env.DNS_SERVERS || '').split(',').map((x) => x.trim()).filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === 'true',
  // IPP-SR-001 / IPP-NF-003: TLS 1.2+ everywhere. Either terminate TLS in Node (TLS_CERT_FILE + TLS_KEY_FILE) or behind a
  // reverse proxy / load balancer (then set TRUST_PROXY=true and keep FORCE_HTTPS on so plain HTTP is never served).
  forceHttps: process.env.FORCE_HTTPS ? process.env.FORCE_HTTPS === 'true' : isProd,
  tls: { certFile: process.env.TLS_CERT_FILE || '', keyFile: process.env.TLS_KEY_FILE || '', minVersion: 'TLSv1.2' },
  // Background jobs (listing expiry, test auto-submit) can be limited to one instance when scaling out (IPP-NF-005).
  jobsEnabled: process.env.JOBS_ENABLED !== 'false',
};

if (config.mailTransport === 'smtp' && !config.smtp.host) {
  throw new Error('MAIL_TRANSPORT=smtp requires SMTP_HOST');
}
if (isProd && config.mailTransport === 'console') {
  throw new Error('MAIL_TRANSPORT=console is not allowed in production');
}

module.exports = config;
