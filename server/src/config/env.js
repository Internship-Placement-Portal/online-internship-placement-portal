require('dotenv').config({ quiet: true });

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
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    authMax: int(process.env.RATE_LIMIT_AUTH_MAX, 30),
    apiMax: int(process.env.RATE_LIMIT_API_MAX, 300),
  },
  // "console" prints mails (incl. OTPs) for local development only; never allowed in production.
  mailTransport: process.env.MAIL_TRANSPORT || (isProd ? 'none' : isTest ? 'memory' : 'console'),
  trustProxy: process.env.TRUST_PROXY === 'true',
};

if (isProd && config.mailTransport === 'console') {
  throw new Error('MAIL_TRANSPORT=console is not allowed in production');
}

module.exports = config;
