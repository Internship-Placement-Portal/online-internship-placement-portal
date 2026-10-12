// Runs in its own process (node:test isolates files), so a low upload limit can be set before the app loads.
process.env.RATE_LIMIT_UPLOAD_MAX = '3';

const { describe, it, before, after, beforeEach } = require('node:test');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const { startDb, stopDb, clearDb, createUser } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

describe('upload rate limiting (IPP-SR-004)', () => {
  it('returns 429 once the upload threshold is exceeded', async () => {
    const student = await createUser({ role: 'student' });
    const statuses = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post('/api/applications').set(student.auth).field('listingId', '64b000000000000000000000');
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 3).every((s) => s !== 429)).toBe(true);
    expect(statuses[3]).toBe(429);
    expect(statuses[4]).toBe(429);
  });
});
