const { describe, it, before, after, beforeEach } = require('node:test');
const mongoose = require('mongoose');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const Listing = require('../src/models/Listing');
const Application = require('../src/models/Application');
const TestAttempt = require('../src/models/TestAttempt');
const Test = require('../src/models/Test');
const AuditLog = require('../src/models/AuditLog');
const { toCsv, csvCell } = require('../src/services/exportService');
const { resolveRange, months } = require('../src/utils/dateRange');
const { startDb, stopDb, clearDb, createUser, listingBody } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

const utc = (y, m, d = 15) => new Date(Date.UTC(y, m - 1, d, 12));
const now = new Date();
// Month offset helper: monthsAgo(0) = this month.
const monthsAgo = (n, d = 10) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, d, 12));
const key = (d) => d.toISOString().slice(0, 7);

// Raw inserts so createdAt/updatedAt can be back-dated.
async function addListing(recruiter, company, domain = 'Software Development') {
  return Listing.create({ ...listingBody({ domain }), company, recruiter: recruiter.user._id, deadline: new Date(Date.now() + 864e5 * 30), status: 'approved' });
}
async function addApplication({ student, listing, status = 'Applied', at, updatedAt, interview }) {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    student: student.user._id,
    listing: listing._id,
    recruiter: listing.recruiter,
    resumeKey: 'seed',
    resumeOriginalName: 'cv.pdf',
    status,
    statusHistory: [],
    createdAt: at,
    updatedAt: updatedAt || at,
    ...(interview && { interview }),
  };
  await Application.collection.insertOne(doc);
  return doc;
}

async function dataset() {
  const admin = await createUser({ role: 'admin' });
  const r1 = await createUser({ role: 'recruiter' });
  const r2 = await createUser({ role: 'recruiter' });
  const students = [];
  for (let i = 0; i < 4; i += 1) students.push(await createUser({ role: 'student' }));
  const acme = await addListing(r1, 'Acme');
  const globex = await addListing(r2, 'Globex', 'Data Science');
  // 6 applications: this month x3, 2 months ago x2, 5 months ago x1. Months 1, 3, 4 have no data (gaps).
  await addApplication({ student: students[0], listing: acme, status: 'Selected', at: monthsAgo(0), updatedAt: monthsAgo(0, 12) });
  await addApplication({ student: students[1], listing: acme, status: 'Shortlisted', at: monthsAgo(0) });
  await addApplication({ student: students[2], listing: globex, status: 'Applied', at: monthsAgo(0) });
  await addApplication({ student: students[0], listing: globex, status: 'Rejected', at: monthsAgo(2) });
  await addApplication({ student: students[3], listing: globex, status: 'Selected', at: monthsAgo(2), updatedAt: monthsAgo(1, 20) });
  await addApplication({ student: students[1], listing: globex, status: 'Applied', at: monthsAgo(5) });
  return { admin, r1, r2, students, acme, globex };
}

describe('date range helper', () => {
  it('defaults to the last 12 calendar months and lists every month', () => {
    const r = resolveRange({}, utc(2026, 10, 12));
    expect(r.from.toISOString()).toBe('2025-11-01T00:00:00.000Z');
    expect(months(r.from, r.to)).toHaveLength(12);
    expect(months(r.from, r.to)[0].key).toBe('2025-11');
    expect(months(r.from, r.to)[11].key).toBe('2026-10');
  });
  it('rejects reversed, malformed and over-long ranges', () => {
    expect(() => resolveRange({ from: '2026-05-01', to: '2026-01-01' })).toThrow();
    expect(() => resolveRange({ from: '2020-01-01', to: '2026-01-01' })).toThrow();
  });
});

describe('placement analytics (IPP-F-019, IPP-F-020)', () => {
  it('computes KPIs, status breakdown and company-wise figures that reconcile with raw data', async () => {
    const { admin } = await dataset();
    const res = await request(app).get('/api/dashboard/placement').set(admin.auth);
    expect(res.status).toBe(200);
    const { kpis, statusBreakdown, companyWise } = res.body;
    expect(kpis.applications).toBe(6);
    expect(kpis.selections).toBe(2);
    expect(kpis.placedStudents).toBe(2); // students[0] and students[3]
    expect(kpis.totalStudents).toBe(4);
    expect(kpis.placementRate).toBe(50);
    expect(kpis.conversionRate).toBe(33.3);
    expect(kpis.shortlisted).toBe(1);
    expect(kpis.applicants).toBe(4);
    expect(kpis.activeListings).toBe(2);
    expect(Object.fromEntries(statusBreakdown.map((s) => [s.status, s.count]))).toEqual({ Applied: 2, Shortlisted: 1, Selected: 2, Rejected: 1 });
    expect(statusBreakdown.reduce((s, x) => s + x.count, 0)).toBe(kpis.applications);
    expect(companyWise[0]).toEqual({ company: 'Globex', applications: 4, shortlisted: 0, selected: 1 });
    expect(companyWise[1]).toEqual({ company: 'Acme', applications: 2, shortlisted: 1, selected: 1 });
    expect(res.body.domainBreakdown.map((d) => d.domain)).toEqual(['Data Science', 'Software Development']);
  });

  it('returns exactly 12 months, zero-filled where there is no data, and never throws on gaps', async () => {
    const { admin } = await dataset();
    const { monthly } = (await request(app).get('/api/dashboard/placement').set(admin.auth)).body;
    expect(monthly).toHaveLength(12);
    const by = Object.fromEntries(monthly.map((m) => [m.month, m]));
    expect(by[key(monthsAgo(0))].applications).toBe(3);
    expect(by[key(monthsAgo(2))].applications).toBe(2);
    expect(by[key(monthsAgo(5))].applications).toBe(1);
    expect(by[key(monthsAgo(1))].applications).toBe(0); // gap month
    expect(by[key(monthsAgo(3))].applications).toBe(0);
    expect(by[key(monthsAgo(0))].selections).toBe(1);
    expect(by[key(monthsAgo(1))].selections).toBe(1); // selection counted in the month the status changed
    expect(monthly.reduce((s, m) => s + m.applications, 0)).toBe(6);
  });

  it('handles an empty platform: zeros, 12 months, no errors', async () => {
    const admin = await createUser({ role: 'admin' });
    const res = await request(app).get('/api/dashboard/placement').set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.body.kpis.applications).toBe(0);
    expect(res.body.kpis.placementRate).toBe(0);
    expect(res.body.monthly).toHaveLength(12);
    expect(res.body.monthly.every((m) => m.applications === 0 && m.avgAccuracy === null)).toBe(true);
    expect(res.body.companyWise).toEqual([]);
  });

  it('supports date-range and company filters', async () => {
    const { admin } = await dataset();
    const from = monthsAgo(1, 1).toISOString().slice(0, 10);
    const recent = await request(app).get(`/api/dashboard/placement?from=${from}`).set(admin.auth);
    expect(recent.body.kpis.applications).toBe(3);
    expect(recent.body.monthly.length).toBeLessThan(12);
    const acme = await request(app).get('/api/dashboard/placement?company=Acme').set(admin.auth);
    expect(acme.body.kpis.applications).toBe(2);
    expect(acme.body.companyWise).toHaveLength(1);
    expect(acme.body.filters.companies).toEqual(['Acme', 'Globex']);
    expect((await request(app).get('/api/dashboard/placement?from=2026-05-01&to=2026-01-01').set(admin.auth)).status).toBe(400);
    expect((await request(app).get('/api/dashboard/placement?from=2019-01-01&to=2026-01-01').set(admin.auth)).status).toBe(400);
    expect((await request(app).get('/api/dashboard/placement?from=garbage').set(admin.auth)).status).toBe(400);
  });

  it('includes monthly test performance trends with null accuracy for months without attempts', async () => {
    const { admin, students } = await dataset();
    const test = await Test.create({ title: 'T', durationMinutes: 10, questionCount: 5 });
    const mk = (student, accuracy, at) => ({ student: student.user._id, test: test._id, attemptNo: 1, status: 'submitted', accuracy, score: accuracy, maxScore: 100, submittedAt: at, startedAt: at, answers: [], questions: [] });
    await TestAttempt.collection.insertMany([mk(students[0], 40, monthsAgo(3)), mk(students[1], 60, monthsAgo(3)), mk({ user: { _id: students[2].user._id } }, 90, monthsAgo(0))].map((d, i) => ({ ...d, attemptNo: i + 1 })));
    const res = await request(app).get('/api/dashboard/placement').set(admin.auth);
    const by = Object.fromEntries(res.body.monthly.map((m) => [m.month, m]));
    expect(by[key(monthsAgo(3))]).toMatchObject({ testAttempts: 2, avgAccuracy: 50 });
    expect(by[key(monthsAgo(0))]).toMatchObject({ testAttempts: 1, avgAccuracy: 90 });
    expect(by[key(monthsAgo(1))].avgAccuracy).toBe(null);
    expect(res.body.kpis.testAttempts).toBe(3);
    expect(res.body.kpis.avgTestAccuracy).toBe(63.3);
  });

  it('is admin only', async () => {
    const student = await createUser({ role: 'student' });
    const recruiter = await createUser({ role: 'recruiter' });
    expect((await request(app).get('/api/dashboard/placement').set(student.auth)).status).toBe(403);
    expect((await request(app).get('/api/dashboard/placement').set(recruiter.auth)).status).toBe(403);
    expect((await request(app).get('/api/dashboard/placement')).status).toBe(401);
    expect((await request(app).get('/api/dashboard/placement/export?format=csv').set(student.auth)).status).toBe(403);
  });
});

describe('export (IPP-F-021)', () => {
  it('CSV contains every filtered record with the correct headers and is audit-logged', async () => {
    const { admin } = await dataset();
    const res = await request(app).get('/api/dashboard/placement/export?format=csv').set(admin.auth);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toContain('attachment');
    const lines = res.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Application ID,Student,Email,College,Company,Internship,Domain,Location,Applied on,Status,Last updated');
    expect(lines).toHaveLength(7); // header + 6 records
    expect(lines.filter((l) => l.includes('Acme'))).toHaveLength(2);

    const filtered = await request(app).get('/api/dashboard/placement/export?format=csv&company=Acme').set(admin.auth);
    expect(filtered.text.trim().split('\r\n')).toHaveLength(3);
    const log = await AuditLog.findOne({ action: 'ANALYTICS_EXPORTED' }).sort({ createdAt: 1 });
    expect(log.metadata.format).toBe('csv');
    expect(log.metadata.records).toBe(6);
  });

  it('neutralises spreadsheet formula injection and escapes quotes/commas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1+1')).toBe("'+1+1");
    expect(csvCell('Smith, John')).toBe('"Smith, John"');
    expect(csvCell(null)).toBe('');
    const csv = toCsv([{ _id: 'x', studentName: '@evil', studentEmail: 'a@b.c', company: 'A', title: 'T', domain: 'D', location: 'L', status: 'Applied' }]);
    expect(csv).toContain("'@evil");
  });

  it('PDF export returns a real PDF and rejects bad formats', async () => {
    const { admin } = await dataset();
    const res = await request(app)
      .get('/api/dashboard/placement/export?format=pdf')
      .set(admin.auth)
      .buffer()
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.body.length).toBeGreaterThan(1500);
    expect((await request(app).get('/api/dashboard/placement/export?format=xls').set(admin.auth)).status).toBe(400);
    expect((await request(app).get('/api/dashboard/placement/export').set(admin.auth)).status).toBe(400);
  });

  it('exports an empty selection without failing', async () => {
    const admin = await createUser({ role: 'admin' });
    const csv = await request(app).get('/api/dashboard/placement/export?format=csv').set(admin.auth);
    expect(csv.text.trim().split('\r\n')).toHaveLength(1);
    expect((await request(app).get('/api/dashboard/placement/export?format=pdf').set(admin.auth)).status).toBe(200);
  });
});

describe('student dashboard (IPP-F-018)', () => {
  it('summarises applications, interviews and test scores that match the underlying records', async () => {
    const { students, acme, globex } = await dataset();
    const s = students[0]; // has Selected@acme (this month) and Rejected@globex
    const future = new Date(Date.now() + 5 * 864e5);
    const past = new Date(Date.now() - 5 * 864e5);
    await Application.collection.updateOne({ student: s.user._id, listing: acme._id }, { $set: { interview: { date: future, mode: 'online', link: 'https://x.test' } } });
    await Application.collection.updateOne({ student: s.user._id, listing: globex._id }, { $set: { interview: { date: past, mode: 'in-person' } } });
    const test = await Test.create({ title: 'Quant', durationMinutes: 10, questionCount: 5 });
    await TestAttempt.collection.insertMany([
      { student: s.user._id, test: test._id, attemptNo: 1, status: 'submitted', score: 6, maxScore: 10, accuracy: 60, submittedAt: monthsAgo(1), categoryBreakdown: { Quant: { correct: 3, total: 5, accuracy: 60 } } },
      { student: s.user._id, test: test._id, attemptNo: 2, status: 'auto_submitted', score: 8, maxScore: 10, accuracy: 80, submittedAt: monthsAgo(0), categoryBreakdown: { Quant: { correct: 4, total: 5, accuracy: 80 } } },
    ]);

    const res = await request(app).get('/api/dashboard/student').set(s.auth);
    expect(res.status).toBe(200);
    const d = res.body;
    expect(d.applications.total).toBe(2);
    expect(d.applications.byStatus).toEqual({ Applied: 0, Shortlisted: 0, Selected: 1, Rejected: 1 });
    expect(d.applications.recent).toHaveLength(2);
    expect(d.interviews.scheduled).toBe(2);
    expect(d.interviews.upcoming).toHaveLength(1);
    expect(d.interviews.upcoming[0].company).toBe('Acme');
    expect(d.tests.attempts).toBe(2);
    expect(d.tests.avgAccuracy).toBe(70);
    expect(d.tests.bestAccuracy).toBe(80);
    expect(d.tests.trend.map((t) => t.accuracy)).toEqual([60, 80]); // oldest → newest
    expect(d.tests.categoryAccuracy[0]).toMatchObject({ category: 'Quant', accuracy: 70, total: 10 });
  });

  it('only ever shows the signed-in student their own data, and handles a brand-new account', async () => {
    const { students } = await dataset();
    const fresh = await createUser({ role: 'student' });
    const res = await request(app).get('/api/dashboard/student').set(fresh.auth);
    expect(res.body.applications.total).toBe(0);
    expect(res.body.tests.attempts).toBe(0);
    expect(res.body.interviews.upcoming).toEqual([]);
    expect((await request(app).get('/api/dashboard/student').set(students[0].auth)).body.applications.total).toBe(2);
  });

  it('is student only', async () => {
    const admin = await createUser({ role: 'admin' });
    const recruiter = await createUser({ role: 'recruiter' });
    expect((await request(app).get('/api/dashboard/student').set(admin.auth)).status).toBe(403);
    expect((await request(app).get('/api/dashboard/student').set(recruiter.auth)).status).toBe(403);
    expect((await request(app).get('/api/dashboard/student')).status).toBe(401);
  });
});

describe('audit log viewer (IPP-F-024)', () => {
  it('lists entries newest first with actor, filters by action/actor/date and paginates', async () => {
    const admin = await createUser({ role: 'admin' });
    const other = await createUser({ role: 'admin' });
    await AuditLog.create([
      { actor: admin.user._id, action: 'RECRUITER_APPROVED', targetType: 'User', metadata: { reason: 'ok' }, createdAt: monthsAgo(2) },
      { actor: admin.user._id, action: 'LISTING_REJECTED', targetType: 'Listing', createdAt: monthsAgo(1) },
      { actor: other.user._id, action: 'LISTING_APPROVED', targetType: 'Listing', createdAt: monthsAgo(0) },
    ]);
    const all = await request(app).get('/api/admin/audit-logs').set(admin.auth);
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(3);
    expect(all.body.items[0].action).toBe('LISTING_APPROVED');
    expect(all.body.items[0].actor).toMatchObject({ email: other.user.email, role: 'admin' });
    expect(new Date(all.body.items[0].createdAt).getTime()).toBeGreaterThan(new Date(all.body.items[2].createdAt).getTime());

    expect((await request(app).get('/api/admin/audit-logs?action=LISTING_REJECTED').set(admin.auth)).body.total).toBe(1);
    expect((await request(app).get(`/api/admin/audit-logs?actor=${admin.user._id}`).set(admin.auth)).body.total).toBe(2);
    const from = monthsAgo(1, 1).toISOString().slice(0, 10);
    expect((await request(app).get(`/api/admin/audit-logs?from=${from}`).set(admin.auth)).body.total).toBe(2);
    expect((await request(app).get('/api/admin/audit-logs?limit=2&page=2').set(admin.auth)).body.items).toHaveLength(1);
    const actions = await request(app).get('/api/admin/audit-logs/actions').set(admin.auth);
    expect(actions.body.actions).toContainItem('LISTING_APPROVED');
  });

  it('is admin only', async () => {
    const student = await createUser({ role: 'student' });
    const recruiter = await createUser({ role: 'recruiter' });
    expect((await request(app).get('/api/admin/audit-logs').set(student.auth)).status).toBe(403);
    expect((await request(app).get('/api/admin/audit-logs').set(recruiter.auth)).status).toBe(403);
    expect((await request(app).get('/api/admin/audit-logs')).status).toBe(401);
  });
});
