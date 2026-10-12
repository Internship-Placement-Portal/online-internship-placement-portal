const config = require('../config/env');

// IPP-SR-001: plain HTTP is never served for the API. Safe methods are redirected (308) to HTTPS; anything else is refused,
// so credentials or tokens sent over HTTP are not processed. `req.secure` honours X-Forwarded-Proto when TRUST_PROXY=true.
// /health stays reachable over HTTP so load-balancer probes keep working.
module.exports = (req, res, next) => {
  if (!config.forceHttps || req.secure || req.path === '/health') return next();
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  }
  return res.status(403).json({ status: 'error', code: 'HTTPS_REQUIRED', message: 'HTTPS is required' });
};
