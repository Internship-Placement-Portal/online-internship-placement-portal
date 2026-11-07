// server/tests/search-filters.test.js
// IPP-F-007 / TC-List-02: Comprehensive search & multi-filter criteria combination test suite.
// Acceptance criteria:
//   1. Results match all applied criteria simultaneously (domain, location, stipend range, duration range).
//   2. Filtering by single criteria or any combination yields exact matches.
//   3. Non-matching combinations gracefully return empty results (200 OK with total: 0).
//   4. Sorting orders (newest, stipend_desc, deadline_asc) sort filtered items accurately.
//   5. Invalid range filters (min > max) are rejected with 400.
//   6. Endpoint is restricted to authenticated students (RBAC).
const { describe, it, before, after, beforeEach } = require('node:test');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const Listing = require('../src/models/Listing');
const { startDb, stopDb, clearDb, createUser, listingBody, futureDate } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

async function seedListings(recruiterId) {
  const future = (days) => new Date(`${futureDate(days)}T23:59:59.999Z`);
  return Listing.create([
    {
      ...listingBody(),
      title: 'Backend Node.js Developer',
      company: 'AlphaTech',
      domain: 'Software Development',
      location: 'Bengaluru',
      stipend: 25000,
      duration: 6,
      deadline: future(20),
      recruiter: recruiterId,
      status: 'approved',
    },
    {
      ...listingBody(),
      title: 'Frontend React Developer',
      company: 'BetaSoft',
      domain: 'Software Development',
      location: 'Hyderabad',
      stipend: 20000,
      duration: 3,
      deadline: future(15),
      recruiter: recruiterId,
      status: 'approved',
    },
    {
      ...listingBody(),
      title: 'ML Research Intern',
      company: 'DataLabs',
      domain: 'Data Science',
      location: 'Bengaluru',
      stipend: 35000,
      duration: 6,
      deadline: future(30),
      recruiter: recruiterId,
      status: 'approved',
    },
    {
      ...listingBody(),
      title: 'Marketing Associate Intern',
      company: 'GammaCorp',
      domain: 'Business & Marketing',
      location: 'Pune',
      stipend: 15000,
      duration: 4,
      deadline: future(25),
      recruiter: recruiterId,
      status: 'approved',
    },
  ]);
}

// ─── 1. Single-Criterion Filtering (IPP-F-007) ───────────────────────────────
describe('TC-List-02 | Single criterion filtering (IPP-F-007)', () => {
  it('filters listings strictly by domain', async () => {
    const student = await createUser({ role: 'student' });
    const recruiter = await createUser({ role: 'recruiter' });
    await seedListings(recruiter.user._id);

    const res = await request(app)
      .get('/api/listings?domain=Data Science')
      .set(student.auth);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].domain).toBe('Data Science');
    expect(res.body.items[0].company).toBe('DataLabs');
  });

  it('filters listings case-insensitively by location substring', async () => {
    const student = await createUser({ role: 'student' });
    const recruiter = await createUser({ role: 'recruiter' });
    await seedListings(recruiter.user._id);

    const resLower = await request(app)
      .get('/api/listings?location=bengaluru')
      .set(student.auth);
    expect(resLower.status).toBe(200);
    expect(resLower.body.total).toBe(2);

    const resUpper = await request(app)
      .get('/api/listings?location=BENGALURU')
      .set(student.auth);
    expect(resUpper.status).toBe(200);
    expect(resUpper.body.total).toBe(2);
  });

  it('filters listings by stipend boundaries (minStipend and maxStipend)', async () => {
    const student = await createUser({ role: 'student' });
    const recruiter = await createUser({ role: 'recruiter' });
    await seedListings(recruiter.user._id);

    const res = await request(app)
      .get('/api/listings?minStipend=20000&maxStipend=30000')
      .set(student.auth);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2); // 25000 and 20000
    res.body.items.forEach((item) => {
      expect(item.stipend).toBeGreaterThan(19999);
      expect(item.stipend).toBeLessThan(30001);
    });
  });

  it('filters listings by duration boundaries (minDuration and maxDuration)', async () => {
    const student = await createUser({ role: 'student' });
    const recruiter = await createUser({ role: 'recruiter' });
    await seedListings(recruiter.user._id);

    const res = await request(app)
      .get('/api/listings?minDuration=5&maxDuration=12')
      .set(student.auth);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2); // duration 6 (AlphaTech) and 6 (DataLabs)
    res.body.items.forEach((item) => {
      expect(item.duration).toBeGreaterThan(4);
    });
  });
});

// ─── 2. Multi-Filter Combinations (TC-List-02) ──────────────────────────────
describe('TC-List-02 | Multi-filter combinations (IPP-F-007)', () => {
  it('combines domain, location, stipend range, and duration in a single search', async () => {
    const student = await createUser({ role: 'student' });
    const recruiter = await createUser({ role: 'recruiter' });
    await seedListings(recruiter.user._id);

    // Filter target: Software Development in Bengaluru, stipend between 20k and 30k, duration 5-10 months
    const url = '/api/listings?domain=Software Development&location=bengaluru&minStipend=20000&maxStipend=30000&minDuration=5&maxDuration=10';
    const res = await request(app).get(url).set(student.auth);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    const match = res.body.items[0];
    expect(match.company).toBe('AlphaTech');
    expect(match.domain).toBe('Software Development');
    expect(match.location).toBe('Bengaluru');
    expect(match.stipend).toBe(25000);
    expect(match.duration).toBe(6);
  });

  it('returns empty results when multi-filter criteria have no overlap', async () => {
    const student = await createUser({ role: 'student' });
    const recruiter = await createUser({ role: 'recruiter' });
    await seedListings(recruiter.user._id);

    // Data Science in Hyderabad (DataLabs is in Bengaluru, not Hyderabad)
    const url = '/api/listings?domain=Data Science&location=Hyderabad';
    const res = await request(app).get(url).set(student.auth);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.items).toEqual([]);
  });
});

// ─── 3. Sorting & Range Validation (IPP-F-007) ───────────────────────────────
describe('TC-List-02 | Sorting and range validation (IPP-F-007)', () => {
  it('sorts listings by stipend in descending order', async () => {
    const student = await createUser({ role: 'student' });
    const recruiter = await createUser({ role: 'recruiter' });
    await seedListings(recruiter.user._id);

    const res = await request(app)
      .get('/api/listings?sort=stipend_desc')
      .set(student.auth);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.items[0].stipend).toBe(35000);
    expect(res.body.items[1].stipend).toBe(25000);
    expect(res.body.items[2].stipend).toBe(20000);
    expect(res.body.items[3].stipend).toBe(15000);
  });

  it('rejects minStipend > maxStipend with 400', async () => {
    const student = await createUser({ role: 'student' });
    const res = await request(app)
      .get('/api/listings?minStipend=50000&maxStipend=20000')
      .set(student.auth);

    expect(res.status).toBe(400);
  });

  it('rejects minDuration > maxDuration with 400', async () => {
    const student = await createUser({ role: 'student' });
    const res = await request(app)
      .get('/api/listings?minDuration=10&maxDuration=3')
      .set(student.auth);

    expect(res.status).toBe(400);
  });

  it('blocks recruiters and unauthenticated users from searching listings', async () => {
    const recruiter = await createUser({ role: 'recruiter' });
    expect((await request(app).get('/api/listings').set(recruiter.auth)).status).toBe(403);
    expect((await request(app).get('/api/listings')).status).toBe(401);
  });
});
