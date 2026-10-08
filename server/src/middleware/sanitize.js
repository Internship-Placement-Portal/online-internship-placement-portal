const xss = require('xss');

// IPP-SR-003: block NoSQL operator injection and strip HTML from user-supplied strings.
const stripTags = (s) => xss(s, { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script', 'style'] });
const SKIP_KEYS = new Set(['password', 'currentPassword', 'newPassword', 'otp']);

function clean(value, key) {
  if (typeof value === 'string') return SKIP_KEYS.has(key) ? value : stripTags(value);
  if (Array.isArray(value)) return value.map((v) => clean(v, key));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('$') || k.includes('.')) continue; // drop operator / path-injection keys
      out[k] = clean(v, k);
    }
    return out;
  }
  return value;
}

module.exports = (req, res, next) => {
  if (req.body) req.body = clean(req.body);
  if (req.query) {
    const q = clean(req.query);
    Object.keys(req.query).forEach((k) => delete req.query[k]);
    Object.assign(req.query, q);
  }
  if (req.params) req.params = clean(req.params);
  next();
};
