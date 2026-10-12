const { describe, it, afterEach } = require('node:test');
const expect = require('./expect');
const config = require('../src/config/env');
const mailer = require('../src/services/mailer');

const original = config.mailTransport;
afterEach(() => {
  config.mailTransport = original;
  mailer.setTransporter(null);
});

const message = { to: 'student@example.com', subject: 'Hello', text: 'Body with code 123456' };

describe('mailer transports (SRS 3.3, 3.4)', () => {
  it('smtp: hands the message to the SMTP transporter with the configured sender', async () => {
    const sent = [];
    mailer.setTransporter({ sendMail: async (m) => sent.push(m) });
    config.mailTransport = 'smtp';
    await mailer.send(message);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'student@example.com', subject: 'Hello', from: config.smtp.from });
  });

  it('smtp: retries transient failures with backoff and eventually delivers', async () => {
    let calls = 0;
    mailer.setTransporter({
      sendMail: async () => {
        calls += 1;
        if (calls < 3) throw new Error('421 try again later');
      },
    });
    config.mailTransport = 'smtp';
    expect(await mailer.sendWithRetry(message)).toBe(true);
    expect(calls).toBe(3);
  });

  it('smtp: in development a failing provider falls back to printing the mail to the console', async () => {
    mailer.setTransporter({ sendMail: async () => Promise.reject(new Error('ECONNREFUSED')) });
    config.mailTransport = 'smtp';
    const lines = [];
    const log = console.log;
    console.log = (...a) => lines.push(a.join(' '));
    try {
      expect(await mailer.sendWithRetry(message, { retries: 0 })).toBe(false); // never throws into the caller
    } finally {
      console.log = log;
    }
    expect(lines.join('\n')).toContain('Body with code 123456');
  });

  it('console fallback prints the mail; memory transport stores it', async () => {
    const lines = [];
    const log = console.log;
    console.log = (...a) => lines.push(a.join(' '));
    try {
      config.mailTransport = 'console';
      await mailer.send(message);
    } finally {
      console.log = log;
    }
    expect(lines.join('\n')).toContain('DEV MAIL');

    config.mailTransport = 'memory';
    mailer.outbox.length = 0;
    await mailer.send(message);
    expect(mailer.outbox).toHaveLength(1);
  });

  it('with no transport configured nothing is sent and nothing throws', async () => {
    config.mailTransport = 'none';
    await mailer.send(message);
    expect(await mailer.sendWithRetry(message)).toBe(true);
  });
});
