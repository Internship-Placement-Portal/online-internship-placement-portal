const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('../utils/logger');

// Pluggable transport (SRS 3.3), selected by MAIL_TRANSPORT:
//   smtp    real delivery through any SMTP provider (SMTP_HOST/PORT/USER/PASS/SECURE, MAIL_FROM). Default when SMTP_HOST is set.
//   console development fallback: prints the mail (incl. OTPs and reset links) to the server console. Blocked in production.
//   memory  collects mails in `outbox` (tests).
// In development, if SMTP delivery fails the mail is ALSO printed to the console so sign-up flows never get stuck.
const outbox = [];
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure, // true = implicit TLS (port 465); false = STARTTLS upgrade when offered
      requireTLS: config.isProd, // never send credentials or mail over plaintext in production (SR-001)
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
      tls: { minVersion: 'TLSv1.2' },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
};
// Test seam: inject a fake transporter (anything with sendMail()).
const setTransporter = (t) => {
  transporter = t;
};

const printToConsole = ({ to, subject, text }) => {
  // eslint-disable-next-line no-console
  console.log(`\n--- DEV MAIL ---\nTo: ${to}\nSubject: ${subject}\n${text}\n----------------\n`);
};

async function send({ to, subject, text }) {
  switch (config.mailTransport) {
    case 'smtp':
      try {
        await getTransporter().sendMail({ from: config.smtp.from, to, subject, text });
      } catch (err) {
        if (!config.isProd) printToConsole({ to, subject, text }); // dev fallback: keep OTPs visible
        throw err; // let the retry wrapper handle/log it
      }
      return;
    case 'console':
      printToConsole({ to, subject, text });
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

module.exports = { send, sendWithRetry, setTransporter, outbox };
