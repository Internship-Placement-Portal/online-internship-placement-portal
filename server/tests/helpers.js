const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const { outbox } = require('../src/services/mailer');

let mongod;

async function startDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

async function stopDb() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

async function clearDb() {
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  outbox.length = 0;
}

const lastOtp = () => {
  const mail = outbox[outbox.length - 1];
  return mail && mail.text.match(/\b(\d{6})\b/)[1];
};

const creds = { name: 'Test User', email: 'user@example.com', password: 'Passw0rd!x', role: 'student' };

// Register + verify through the real API, then return a logged-in agent session.
async function registerVerified(app, overrides = {}) {
  const body = { ...creds, ...overrides };
  const reg = await request(app).post('/api/auth/register').send(body);
  await request(app).post('/api/auth/verify-email').send({ userId: reg.body.userId, otp: lastOtp() });
  return { ...body, userId: reg.body.userId };
}

async function createAdmin(email = 'admin@example.com', password = 'AdminPass1') {
  await User.create({
    name: 'Admin',
    email,
    passwordHash: await bcrypt.hash(password, 4),
    role: 'admin',
    emailVerified: true,
  });
  return { email, password };
}

// Direct (already verified) user creation + token minting: fast path for tests that are not about auth itself.
const { signAccessToken } = require('../src/utils/tokens');
let seq = 0;
async function createUser({ role = 'student', approvalStatus, ...rest } = {}) {
  seq += 1;
  const user = await User.create({
    name: `${role} ${seq}`,
    email: `${role}${seq}@example.com`,
    passwordHash: await bcrypt.hash('Passw0rd!x', 4),
    role,
    emailVerified: true,
    approvalStatus: approvalStatus || 'approved',
    ...rest,
  });
  return { user, token: signAccessToken(user), auth: { Authorization: `Bearer ${signAccessToken(user)}` } };
}

const futureDate = (days = 30) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const listingBody = (over = {}) => ({
  title: 'Backend Developer Intern',
  description: 'Build REST APIs with Node.js and MongoDB alongside the platform team.',
  domain: 'Software Development',
  location: 'Bengaluru',
  stipend: 20000,
  duration: 3,
  skills: ['Node.js', 'MongoDB'],
  eligibility: 'Pre-final year B.E./B.Tech',
  deadline: futureDate(),
  ...over,
});

module.exports = { createUser, futureDate, listingBody, startDb, stopDb, clearDb, lastOtp, registerVerified, createAdmin, creds };
