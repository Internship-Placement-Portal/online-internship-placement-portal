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

module.exports = { send, outbox };
