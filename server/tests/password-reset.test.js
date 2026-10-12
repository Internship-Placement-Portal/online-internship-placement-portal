const { describe, it, before, after, beforeEach } = require('node:test');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const User = require('../src/models/User');
const RefreshToken = require('../src/models/RefreshToken');
const { outbox } = require('../src/services/mailer');
const { startDb, stopDb, clearDb, registerVerified, creds } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

const tokenFromMail = () => {
  const mail = outbox[outbox.length - 1];
  return mail && mail.text.match(/token=([\w-]+)/)[1];
};
const forgot = (email) => request(app).post('/api/auth/forgot-password').send({ email });
const reset = (token, password) => request(app).post('/api/auth/reset-password').send({ token, password });

describe('password reset (IPP-F-005)', () => {
  it('answers identically for known and unknown emails, and only mails the real one', async () => {
    await registerVerified(app);
    outbox.length = 0;
    const known = await forgot(creds.email);
    expect(outbox).toHaveLength(1);
    const unknown = await forgot('ghost@example.com');
    expect(outbox).toHaveLength(1);
    expect(known.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it('lets the user choose a new password with the emailed link, then the old one stops working', async () => {
    await registerVerified(app);
    await forgot(creds.email);
    const res = await reset(tokenFromMail(), 'BrandNew123');
    expect(res.status).toBe(200);

    const oldLogin = await request(app).post('/api/auth/login').send({ email: creds.email, password: creds.password });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post('/api/auth/login').send({ email: creds.email, password: 'BrandNew123' });
    expect(newLogin.status).toBe(200);
  });

  it('is single use', async () => {
    await registerVerified(app);
    await forgot(creds.email);
    const token = tokenFromMail();
    expect((await reset(token, 'BrandNew123')).status).toBe(200);
    const again = await reset(token, 'AnotherOne456');
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('INVALID_RESET_TOKEN');
  });

  it('expires after 30 minutes', async () => {
    await registerVerified(app);
    await forgot(creds.email);
    await User.updateOne({ email: creds.email }, { passwordResetExpiresAt: new Date(Date.now() - 1000) });
    expect((await reset(tokenFromMail(), 'BrandNew123')).status).toBe(400);
  });

  it('stores only a hash of the token, with a 30 minute expiry', async () => {
    await registerVerified(app);
    await forgot(creds.email);
    const user = await User.findOne({ email: creds.email }).select('+passwordResetTokenHash +passwordResetExpiresAt');
    const token = tokenFromMail();
    expect(user.passwordResetTokenHash).not.toContain(token);
    const minutes = (user.passwordResetExpiresAt - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(29);
    expect(minutes).toBeLessThan(30.1);
  });

  it('rejects garbage tokens and weak passwords', async () => {
    expect((await reset('x'.repeat(40), 'BrandNew123')).status).toBe(400);
    await registerVerified(app);
    await forgot(creds.email);
    expect((await reset(tokenFromMail(), 'short')).status).toBe(400);
  });

  it('revokes existing sessions and clears an account lockout', async () => {
    await registerVerified(app);
    await request(app).post('/api/auth/login').send({ email: creds.email, password: creds.password });
    for (let i = 0; i < 5; i += 1) await request(app).post('/api/auth/login').send({ email: creds.email, password: 'Wrong1234' });
    await forgot(creds.email);
    await reset(tokenFromMail(), 'BrandNew123');
    expect(await RefreshToken.countDocuments({ revokedAt: { $exists: false } })).toBe(0);
    const login = await request(app).post('/api/auth/login').send({ email: creds.email, password: 'BrandNew123' });
    expect(login.status).toBe(200);
  });
});
