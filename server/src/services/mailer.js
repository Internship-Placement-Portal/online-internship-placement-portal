const config = require('../config/env');
const logger = require('../utils/logger');

// Pluggable transport (SRS 3.3). Swap in SMTP/SendGrid later without touching callers.
// "console" is a development-only convenience (blocked in production by config/env.js) so the
// OTP can be read from the terminal. "memory" is used by tests.
const outbox = [];

async function send({ to, subject, text }) {
  switch (config.mailTransport) {
    case 'console':
      // eslint-disable-next-line no-console
      console.log(`\n--- DEV MAIL ---\nTo: ${to}\nSubject: ${subject}\n${text}\n----------------\n`);
      return;
    case 'memory':
      outbox.push({ to, subject, text });
      return;
    default:
      logger.warn('No mail transport configured; mail not sent', { subject });
  }
}

// SRS 3.4: retry with exponential backoff for transient provider failures. Never throws: a failed email must not
// roll back the action that triggered it (the in-app notification is the source of truth).
async function sendWithRetry(message, { retries = 3, baseDelayMs = config.isTest ? 1 : 300, sender = send } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await sender(message);
      return true;
    } catch (err) {
      logger.warn('mail send failed', { attempt: attempt + 1, error: err.message });
      if (attempt < retries) await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
    }
  }
  return false;
}

module.exports = { send, sendWithRetry, outbox };
