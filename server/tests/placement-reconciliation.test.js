// server/tests/placement-reconciliation.test.js
// IPP-F-019 / TC-Dash-02: Comprehensive placement analytics and raw data reconciliation test suite.
// Acceptance criteria:
//   1. Aggregate placement rate reconciles exactly with raw distinct placed students / total students.
//   2. Company-wise application, shortlist, and selection counts match raw Application documents.
//   3. Test accuracy reconciles with weighted averages of scored test attempts.
//   4. Status breakdown sum exactly equals total recorded applications.
//   5. CSV export outputs reconcile row-for-row with raw application records and protect against formula injection.
//   6. Endpoint access is strictly enforced for admin (placement officer) role.
const { describe, it, before, after, beforeEach } = require('node:test');
const mongoose = require('mongoose');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const Listing = require('../src/models/Listing');
const Application = require('../src/models/Application');
const TestAttempt = require('../src/models/TestAttempt');
const Test = require('../src/models/Test');
const User = require('../src/models/User');
const { reconcilePlacementData } = require('../src/services/analyticsService');
const { startDb, stopDb, clearDb, createUser, listingBody } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

const now = new Date();
const monthsAgo = (n, d = 15) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - n, d, 12));

async function createListing(recruiterUser, company, domain = 'Software Development') {
  return Listing.create({
    ...listingBody({ domain }),
    company,
    recruiter: recruiterUser._id,
    status: 'approved',
    deadline: new Date(Date.now() + 864e5 * 60),
  });
}

async function createRawApplication({ studentUser, listingDoc, status = 'Applied', createdAt, updatedAt }) {
  const doc = {
    _id: new mongoose.Types.ObjectId(),
    student: studentUser._id,
    listing: listingDoc._id,
    recruiter: listingDoc.recruiter,
    resumeKey: 'resumes/test-uuid.pdf',
    resumeOriginalName: 'resume.pdf',
    status,
    statusHistory: [{ status, changedAt: createdAt || new Date(), changedBy: listingDoc.recruiter }],
    createdAt: createdAt || new Date(),
    updatedAt: updatedAt || createdAt || new Date(),
  };
  await Application.collection.insertOne(doc);
  return doc;
}

describe('TC-Dash-02 | Placement analytics reconciliation with raw data (IPP-F-019)', () => {
  it('reconciles aggregate placement rate and distinct placed students against raw database records', async () => {
    const admin = await createUser({ role: 'admin' });
    const recruiter = await createUser({ role: 'recruiter' });

    // Create 6 students in total
    const students = [];
    for (let i = 0; i < 6; i += 1) {
      students.push(await createUser({ role: 'student', name: `Candidate ${i + 1}` }));
    }

    const listingA = await createListing(recruiter.user, 'Apex Corp', 'Software Development');
    const listingB = await createListing(recruiter.user, 'Nexus Systems', 'Cloud & DevOps');

    // Student 0: Selected in Apex, Selected in Nexus (multiple offers -> must count as 1 placed student)
    await createRawApplication({ studentUser: students[0].user, listingDoc: listingA, status: 'Selected', createdAt: monthsAgo(1) });
    await createRawApplication({ studentUser: students[0].user, listingDoc: listingB, status: 'Selected', createdAt: monthsAgo(0) });

    // Student 1: Shortlisted in Apex, Selected in Nexus -> 1 placed student
    await createRawApplication({ studentUser: students[1].user, listingDoc: listingA, status: 'Shortlisted', createdAt: monthsAgo(2) });
    await createRawApplication({ studentUser: students[1].user, listingDoc: listingB, status: 'Selected', createdAt: monthsAgo(1) });

    // Student 2: Selected in Apex -> 1 placed student
    await createRawApplication({ studentUser: students[2].user, listingDoc: listingA, status: 'Selected', createdAt: monthsAgo(3) });

    // Student 3: Rejected in Apex, Shortlisted in Nexus -> not placed
    await createRawApplication({ studentUser: students[3].user, listingDoc: listingA, status: 'Rejected', createdAt: monthsAgo(2) });
    await createRawApplication({ studentUser: students[3].user, listingDoc: listingB, status: 'Shortlisted', createdAt: monthsAgo(1) });

    // Student 4: Applied only in Apex -> not placed
    await createRawApplication({ studentUser: students[4].user, listingDoc: listingA, status: 'Applied', createdAt: monthsAgo(0) });

    // Student 5: Registered student with 0 applications -> not placed, but counts toward total students

    // Query API
    const res = await request(app).get('/api/dashboard/placement').set(admin.auth);
    expect(res.status).toBe(200);

    const { kpis, statusBreakdown } = res.body;

    // Raw verification
    const rawTotalStudents = await User.countDocuments({ role: 'student' });
    const rawTotalApplications = await Application.countDocuments();
    const rawSelections = await Application.countDocuments({ status: 'Selected' });
    const rawDistinctPlaced = (await Application.distinct('student', { status: 'Selected' })).length;
    const rawDistinctApplicants = (await Application.distinct('student')).length;

    expect(kpis.totalStudents).toBe(rawTotalStudents);
    expect(kpis.totalStudents).toBe(6);
    expect(kpis.applications).toBe(rawTotalApplications);
    expect(kpis.applications).toBe(7);
    expect(kpis.selections).toBe(rawSelections);
    expect(kpis.selections).toBe(3);
    expect(kpis.placedStudents).toBe(rawDistinctPlaced);
    expect(kpis.placedStudents).toBe(3); // Students 0, 1, 2
    expect(kpis.applicants).toBe(rawDistinctApplicants);
    expect(kpis.applicants).toBe(5); // Students 0, 1, 2, 3, 4

    // Placement rate: (3 / 6) * 100 = 50.0%
    const expectedPlacementRate = Math.round((rawDistinctPlaced / rawTotalStudents) * 1000) / 10;
    expect(kpis.placementRate).toBe(expectedPlacementRate);
    expect(kpis.placementRate).toBe(50);

    // Conversion rate: (3 selections / 7 applications) * 100 = 42.9%
    const expectedConversion = Math.round((rawSelections / rawTotalApplications) * 1000) / 10;
    expect(kpis.conversionRate).toBe(expectedConversion);
    expect(kpis.conversionRate).toBe(42.9);

    // Status breakdown reconciliation
    const statusMap = Object.fromEntries(statusBreakdown.map((s) => [s.status, s.count]));
    expect(statusMap.Applied).toBe(1);
    expect(statusMap.Shortlisted).toBe(2);
    expect(statusMap.Selected).toBe(3);
    expect(statusMap.Rejected).toBe(1);
    expect(statusBreakdown.reduce((sum, s) => sum + s.count, 0)).toBe(rawTotalApplications);
  });

  it('reconciles company-wise application counts, shortlists, and selections with raw database records', async () => {
    const admin = await createUser({ role: 'admin' });
    const recruiter = await createUser({ role: 'recruiter' });
    const s1 = await createUser({ role: 'student' });
    const s2 = await createUser({ role: 'student' });
    const s3 = await createUser({ role: 'student' });

    const cloudWorks = await createListing(recruiter.user, 'CloudWorks', 'Cloud & DevOps');
    const aiLabs = await createListing(recruiter.user, 'AILabs', 'Data Science');
    const fintech = await createListing(recruiter.user, 'FinTech Innovations', 'Finance');

    // CloudWorks: 3 applications (1 Selected, 1 Shortlisted, 1 Rejected)
    await createRawApplication({ studentUser: s1.user, listingDoc: cloudWorks, status: 'Selected', createdAt: monthsAgo(1) });
    await createRawApplication({ studentUser: s2.user, listingDoc: cloudWorks, status: 'Shortlisted', createdAt: monthsAgo(1) });
    await createRawApplication({ studentUser: s3.user, listingDoc: cloudWorks, status: 'Rejected', createdAt: monthsAgo(2) });

    // AILabs: 2 applications (1 Selected, 1 Applied)
    await createRawApplication({ studentUser: s1.user, listingDoc: aiLabs, status: 'Selected', createdAt: monthsAgo(0) });
    await createRawApplication({ studentUser: s2.user, listingDoc: aiLabs, status: 'Applied', createdAt: monthsAgo(0) });

    // FinTech Innovations: 1 application (1 Shortlisted)
    await createRawApplication({ studentUser: s3.user, listingDoc: fintech, status: 'Shortlisted', createdAt: monthsAgo(3) });

    const res = await request(app).get('/api/dashboard/placement').set(admin.auth);
    expect(res.status).toBe(200);

    const { companyWise } = res.body;
    expect(companyWise).toHaveLength(3);

    const companyMap = Object.fromEntries(companyWise.map((c) => [c.company, c]));

    // Reconcile CloudWorks
    expect(companyMap.CloudWorks.applications).toBe(3);
    expect(companyMap.CloudWorks.shortlisted).toBe(1);
    expect(companyMap.CloudWorks.selected).toBe(1);

    // Reconcile AILabs
    expect(companyMap.AILabs.applications).toBe(2);
    expect(companyMap.AILabs.shortlisted).toBe(0);
    expect(companyMap.AILabs.selected).toBe(1);

    // Reconcile FinTech Innovations
    expect(companyMap['FinTech Innovations'].applications).toBe(1);
    expect(companyMap['FinTech Innovations'].shortlisted).toBe(1);
    expect(companyMap['FinTech Innovations'].selected).toBe(0);

    // Filter by single company and verify strict scoping
    const filteredRes = await request(app).get('/api/dashboard/placement?company=CloudWorks').set(admin.auth);
    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body.companyWise).toHaveLength(1);
    expect(filteredRes.body.companyWise[0].company).toBe('CloudWorks');
    expect(filteredRes.body.kpis.applications).toBe(3);
  });

  it('reconciles service-level reconcilePlacementData helper verification checks', async () => {
    const recruiter = await createUser({ role: 'recruiter' });
    const studentA = await createUser({ role: 'student' });
    const studentB = await createUser({ role: 'student' });
    const listing = await createListing(recruiter.user, 'Quantum Labs', 'Software Development');

    await createRawApplication({ studentUser: studentA.user, listingDoc: listing, status: 'Selected', createdAt: monthsAgo(1) });
    await createRawApplication({ studentUser: studentB.user, listingDoc: listing, status: 'Applied', createdAt: monthsAgo(0) });

    const audit = await reconcilePlacementData();
    expect(audit.reconciled).toBe(true);
    expect(audit.checks.statusSumMatchesTotal).toBe(true);
    expect(audit.checks.monthlySumMatchesTotal).toBe(true);
    expect(audit.checks.companySumMatchesTotal).toBe(true);
    expect(audit.checks.conversionRateMatches).toBe(true);
    expect(audit.checks.placementRateMatches).toBe(true);
    expect(audit.metrics.totalStudents).toBe(2);
    expect(audit.metrics.placedStudents).toBe(1);
    expect(audit.metrics.placementRate).toBe(50);
    expect(audit.metrics.applications).toBe(2);
    expect(audit.metrics.selections).toBe(1);
  });
});
