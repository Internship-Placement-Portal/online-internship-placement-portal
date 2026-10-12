const { describe, it, before, after, beforeEach } = require('node:test');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const Listing = require('../src/models/Listing');
const expireJob = require('../src/jobs/expireListings');
const { startDb, stopDb, clearDb, createUser, listingBody, futureDate } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

const post = (path, who, body) => request(app).post(path).set(who.auth).send(body);
const patch = (path, who, body) => request(app).patch(path).set(who.auth).send(body);
const get = (path, who) => request(app).get(path).set(who.auth);

async function approvedListing(recruiter, over = {}) {
  return Listing.create({
    ...listingBody(over),
    deadline: new Date(`${futureDate()}T23:59:59.999Z`),
    company: 'Acme',
    recruiter: recruiter.user._id,
    status: 'approved',
  });
}

describe('listing CRUD + ownership (IPP-F-006)', () => {
  it('lets an approved recruiter create a draft, then publish it for approval', async () => {
    const r = await createUser({ role: 'recruiter' });
    const res = await post('/api/listings', r, listingBody());
    expect(res.status).toBe(201);
    expect(res.body.listing.status).toBe('draft');
    expect(res.body.listing.company).toBe(r.user.name);

    const pub = await patch(`/api/listings/${res.body.listing.id}`, r, { publish: true });
    expect(pub.status).toBe(200);
    expect(pub.body.listing.status).toBe('pending_approval');
  });

  it('creates directly as pending_approval with publish=true', async () => {
    const r = await createUser({ role: 'recruiter' });
    const res = await post('/api/listings', r, { ...listingBody(), publish: true });
    expect(res.body.listing.status).toBe('pending_approval');
  });

  it('blocks recruiters who are not approved', async () => {
    const r = await createUser({ role: 'recruiter', approvalStatus: 'pending' });
    const res = await post('/api/listings', r, listingBody());
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('RECRUITER_NOT_APPROVED');
  });

  it('validates input: missing fields, past deadline, bad domain, negative stipend', async () => {
    const r = await createUser({ role: 'recruiter' });
    expect((await post('/api/listings', r, { title: 'x' })).status).toBe(400);
    expect((await post('/api/listings', r, listingBody({ deadline: '2020-01-01' }))).status).toBe(400);
    expect((await post('/api/listings', r, listingBody({ domain: 'Nope' }))).status).toBe(400);
    expect((await post('/api/listings', r, listingBody({ stipend: -5 }))).status).toBe(400);
  });

  it('only the owner can edit; others get 403 and unknown ids 404', async () => {
    const owner = await createUser({ role: 'recruiter' });
    const other = await createUser({ role: 'recruiter' });
    const { body } = await post('/api/listings', owner, listingBody());
    const id = body.listing.id;

    expect((await patch(`/api/listings/${id}`, other, { title: 'Hijacked title' })).status).toBe(403);
    expect((await patch(`/api/listings/${id}`, owner, { title: 'New title here' })).body.listing.title).toBe('New title here');
    expect((await patch('/api/listings/64b000000000000000000000', owner, { title: 'Whatever' })).status).toBe(404);
    expect((await request(app).post(`/api/listings/${id}/close`).set(other.auth)).status).toBe(403);
  });

  it('editing an approved listing sends it back for re-approval', async () => {
    const r = await createUser({ role: 'recruiter' });
    const l = await approvedListing(r);
    const res = await patch(`/api/listings/${l._id}`, r, { stipend: 30000 });
    expect(res.body.listing.status).toBe('pending_approval');
  });

  it('closed listings cannot be edited', async () => {
    const r = await createUser({ role: 'recruiter' });
    const l = await approvedListing(r);
    await request(app).post(`/api/listings/${l._id}/close`).set(r.auth);
    expect((await patch(`/api/listings/${l._id}`, r, { title: 'Reopen attempt' })).status).toBe(409);
  });

  it('GET /listings/mine returns only the recruiter own listings, filterable by status', async () => {
    const a = await createUser({ role: 'recruiter' });
    const b = await createUser({ role: 'recruiter' });
    await post('/api/listings', a, listingBody());
    await post('/api/listings', a, { ...listingBody(), publish: true });
    await post('/api/listings', b, listingBody());
    expect((await get('/api/listings/mine', a)).body.total).toBe(2);
    expect((await get('/api/listings/mine?status=draft', a)).body.total).toBe(1);
  });

  it('students and anonymous users cannot create or list "mine"', async () => {
    const s = await createUser({ role: 'student' });
    expect((await post('/api/listings', s, listingBody())).status).toBe(403);
    expect((await get('/api/listings/mine', s)).status).toBe(403);
    expect((await request(app).post('/api/listings').send(listingBody())).status).toBe(401);
  });
});

describe('search, filter, pagination (IPP-F-007)', () => {
  let student;
  let recruiter;
  beforeEach(async () => {
    student = await createUser({ role: 'student' });
    recruiter = await createUser({ role: 'recruiter' });
    await approvedListing(recruiter, { title: 'React Frontend Intern', domain: 'Web Development', location: 'Mumbai', stipend: 15000, duration: 2, skills: ['React'] });
    await approvedListing(recruiter, { title: 'Data Analyst Intern', domain: 'Data Science', location: 'Bengaluru', stipend: 25000, duration: 6, skills: ['Python', 'SQL'] });
    await approvedListing(recruiter, { title: 'Cloud Ops Intern', domain: 'Cloud & DevOps', location: 'Remote', stipend: 0, duration: 3, skills: ['AWS'] });
  });

  it('lists approved listings only (drafts, pending, rejected and closed are hidden)', async () => {
    for (const status of ['draft', 'pending_approval', 'rejected', 'closed']) {
      await Listing.create({ ...listingBody({ title: `Hidden ${status}` }), company: 'X', recruiter: recruiter.user._id, deadline: new Date(Date.now() + 864e5), status });
    }
    const res = await get('/api/listings', student);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
  });

  it('filters by domain, location, stipend range and duration', async () => {
    expect((await get('/api/listings?domain=Data%20Science', student)).body.total).toBe(1);
    expect((await get('/api/listings?location=bengal', student)).body.total).toBe(1);
    expect((await get('/api/listings?minStipend=10000&maxStipend=20000', student)).body.items[0].title).toBe('React Frontend Intern');
    expect((await get('/api/listings?minDuration=3', student)).body.total).toBe(2);
    expect((await get('/api/listings?maxDuration=2', student)).body.total).toBe(1);
  });

  it('full-text search matches title and skills', async () => {
    expect((await get('/api/listings?q=python', student)).body.items[0].title).toBe('Data Analyst Intern');
    expect((await get('/api/listings?q=react', student)).body.total).toBe(1);
  });

  it('paginates and sorts', async () => {
    const p1 = await get('/api/listings?limit=2&page=1&sort=stipend_desc', student);
    expect(p1.body.items).toHaveLength(2);
    expect(p1.body.items[0].stipend).toBe(25000);
    expect(p1.body.totalPages).toBe(2);
    const p2 = await get('/api/listings?limit=2&page=2&sort=stipend_desc', student);
    expect(p2.body.items).toHaveLength(1);
  });

  it('treats regex characters in location literally and rejects operator injection', async () => {
    expect((await get('/api/listings?location=.*', student)).body.total).toBe(0);
    expect((await get('/api/listings?domain[$ne]=x', student)).status).toBe(400);
  });

  it('only students can search; recruiters/admins are forbidden and anonymous is 401', async () => {
    expect((await get('/api/listings', recruiter)).status).toBe(403);
    expect((await request(app).get('/api/listings')).status).toBe(401);
  });

  it('treats empty filter values as "no filter" instead of rejecting them', async () => {
    const res = await get('/api/listings?q=&domain=&location=&minStipend=&sort=&page=&limit=', student);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect((await get('/api/listings/mine?status=', recruiter)).status).toBe(200);
  });

  it('exposes the domain list', async () => {
    const res = await get('/api/listings/domains', student);
    expect(res.body.domains.length).toBeGreaterThan(5);
  });
});

describe('listing details (IPP-F-008)', () => {
  it('returns every field plus the company profile', async () => {
    const student = await createUser({ role: 'student' });
    const recruiter = await createUser({
      role: 'recruiter',
      profile: { companyName: 'Acme Corp', companyDescription: 'We build rockets', website: 'https://acme.test' },
    });
    const l = await approvedListing(recruiter);
    const res = await get(`/api/listings/${l._id}`, student);
    expect(res.status).toBe(200);
    const d = res.body.listing;
    expect(d.title).toBe('Backend Developer Intern');
    expect(d.eligibility).toBe('Pre-final year B.E./B.Tech');
    expect(d.skills).toEqual(['Node.js', 'MongoDB']);
    expect(d.companyProfile.name).toBe('Acme Corp');
    expect(d.companyProfile.website).toBe('https://acme.test');
    expect(JSON.stringify(d)).not.toContain('@example.com'); // no recruiter email leak
  });

  it('gives students a 404 for unknown, malformed, unapproved and expired listings', async () => {
    const student = await createUser({ role: 'student' });
    const recruiter = await createUser({ role: 'recruiter' });
    const draft = await Listing.create({ ...listingBody(), company: 'X', recruiter: recruiter.user._id, deadline: new Date(Date.now() + 864e5), status: 'draft' });
    const expired = await Listing.create({ ...listingBody(), company: 'X', recruiter: recruiter.user._id, deadline: new Date(Date.now() - 864e5), status: 'approved' });
    expect((await get(`/api/listings/${draft._id}`, student)).status).toBe(404);
    expect((await get(`/api/listings/${expired._id}`, student)).status).toBe(404);
    expect((await get('/api/listings/64b000000000000000000000', student)).status).toBe(404);
    expect((await get('/api/listings/not-an-id', student)).status).toBe(400);
  });

  it('lets the owner see their draft but not another recruiter', async () => {
    const owner = await createUser({ role: 'recruiter' });
    const other = await createUser({ role: 'recruiter' });
    const admin = await createUser({ role: 'admin' });
    const { body } = await post('/api/listings', owner, listingBody());
    expect((await get(`/api/listings/${body.listing.id}`, owner)).status).toBe(200);
    expect((await get(`/api/listings/${body.listing.id}`, other)).status).toBe(403);
    expect((await get(`/api/listings/${body.listing.id}`, admin)).status).toBe(200);
  });
});

describe('expired listings are hidden (IPP-F-009)', () => {
  it('drops listings from search the moment the deadline passes, and the job closes them', async () => {
    const student = await createUser({ role: 'student' });
    const recruiter = await createUser({ role: 'recruiter' });
    const l = await approvedListing(recruiter);
    expect((await get('/api/listings', student)).body.total).toBe(1);

    await Listing.updateOne({ _id: l._id }, { deadline: new Date(Date.now() - 1000) });
    expect((await get('/api/listings', student)).body.total).toBe(0);

    expect(await expireJob.run()).toBe(1);
    expect((await Listing.findById(l._id)).status).toBe('closed');
  });
});
