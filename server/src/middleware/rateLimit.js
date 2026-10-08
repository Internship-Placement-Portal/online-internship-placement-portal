const rateLimit = require('express-rate-limit');
const config = require('../config/env');

// IPP-SR-004: rate limiting; excess requests get HTTP 429 in the standard error envelope.
function createRateLimiter({ windowMs = config.rateLimit.windowMs, max, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({ status: 'error', code: 'RATE_LIMITED', message: message || 'Too many requests, please try again later.' }),
  });
}

const apiLimiter = createRateLimiter({ max: config.rateLimit.apiMax });
const authLimiter = createRateLimiter({
  max: config.rateLimit.authMax,
  message: 'Too many authentication attempts, please try again later.',
});

module.exports = { createRateLimiter, apiLimiter, authLimiter };
