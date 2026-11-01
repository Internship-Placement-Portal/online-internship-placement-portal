// Runs in its own process so the low authentication limit is set before the app loads.
process.env.RATE_LIMIT_AUTH_MAX = '3';

const { describe, it } = require('node:test');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');

describe('authentication endpoint rate limiting (IPP-SR-004)', () => {
  it('returns 429 when the login request threshold is exceeded', async () => {
    const statuses = [];
    let lastResponse;

    for (let i = 0; i < 5; i += 1) {
      lastResponse = await request(app)
        .post('/api/auth/login')
        .send({});
      statuses.push(lastResponse.status);
    }

    expect(statuses.slice(0, 3).every((status) => status !== 429)).toBe(true);
    expect(statuses[3]).toBe(429);
    expect(statuses[4]).toBe(429);
    expect(lastResponse.body).toMatchObject({
      status: 'error',
      code: 'RATE_LIMITED',
    });
  });
});
