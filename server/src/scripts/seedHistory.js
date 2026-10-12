// Back-dated demo history so the analytics dashboards (12-month charts, trends, company-wise figures) have data.
// Deterministic (seeded PRNG) and idempotent: skipped if the first history student already exists.
// Months 4 and 8 ago are deliberately left empty to demonstrate gap handling in the charts.
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const config = require('../config/env');
const User = require('../models/User');
const Listing = require('../models/Listing');
const Application = require('../models/Application');
const Test = require('../models/Test');
const TestAttempt = require('../models/TestAttempt');

const GAP_MONTHS = new Set([4, 8]);
const FIRST = 'seed.student01@ipp.demo';

function rng(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ['Aarav', 'Diya', 'Vihaan', 'Anaya', 'Reyansh', 'Saanvi', 'Ishaan', 'Myra', 'Kabir', 'Anika', 'Arnav', 'Navya', 'Dev', 'Kiara', 'Rudra', 'Meera', 'Vivaan', 'Tara', 'Atharv', 'Ira', 'Zayan', 'Pari', 'Krish', 'Riya'];
const COLLEGES = ['PES University', 'RV College of Engineering', 'BMS College', 'MS Ramaiah Institute'];

async function seedHistory(demoPassword) {
  if (await User.exists({ email: FIRST })) return { skipped: true };
  const rand = rng(42);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const now = new Date();
  const dateIn = (monthsAgo, day) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, day, 9 + Math.floor(rand() * 9), Math.floor(rand() * 60)));

  const passwordHash = await bcrypt.hash(demoPassword, config.bcryptRounds);
  const students = await User.insertMany(
    NAMES.map((name, i) => ({
      name: `${name} ${['Rao', 'Iyer', 'Shah', 'Patel', 'Nair', 'Gupta'][i % 6]}`,
      email: `seed.student${String(i + 1).padStart(2, '0')}@ipp.demo`,
      passwordHash,
      role: 'student',
      emailVerified: true,
      approvalStatus: 'approved',
      profile: { college: COLLEGES[i % COLLEGES.length], branch: i % 3 ? 'Computer Science' : 'Electronics', graduationYear: 2027 },
    }))
  );

  const listings = await Listing.find({ status: 'approved' }).lean();
  const tests = await Test.find({ isActive: true }).lean();
  if (!listings.length) return { skipped: true };

  // ── Applications: volume grows over time, older ones are mostly decided ──
  const used = new Set();
  const apps = [];
  for (let m = 11; m >= 0; m -= 1) {
    if (GAP_MONTHS.has(m)) continue;
    const count = 3 + Math.round((11 - m) * 0.9) + Math.floor(rand() * 4);
    for (let i = 0; i < count; i += 1) {
      const student = pick(students);
      const listing = pick(listings);
      const pair = `${student._id}:${listing._id}`;
      if (used.has(pair)) continue;
      used.add(pair);
      const createdAt = dateIn(m, 1 + Math.floor(rand() * 26));
      const roll = rand();
      const decided = m >= 1;
      const status = decided ? (roll < 0.22 ? 'Selected' : roll < 0.5 ? 'Rejected' : roll < 0.72 ? 'Shortlisted' : 'Applied') : roll < 0.12 ? 'Selected' : roll < 0.4 ? 'Shortlisted' : 'Applied';
      const updatedAt = status === 'Applied' ? createdAt : new Date(createdAt.getTime() + (2 + Math.floor(rand() * 12)) * 86400000);
      const history = [{ status: 'Applied', at: createdAt, by: student._id }];
      if (status !== 'Applied') history.push({ status, at: updatedAt, by: listing.recruiter });
      apps.push({
        student: student._id,
        listing: listing._id,
        recruiter: listing.recruiter,
        resumeKey: 'seed-data',
        resumeOriginalName: 'resume.pdf',
        resumeSize: 120000,
        status,
        statusHistory: history,
        createdAt,
        updatedAt: updatedAt > now ? now : updatedAt,
        __v: 0,
      });
    }
  }
  if (apps.length) await Application.collection.insertMany(apps);

  // ── Test attempts: accuracy improves over time with noise; one attempt per student per test ──
  const attempts = [];
  const per = new Set();
  for (let m = 11; m >= 0; m -= 1) {
    if (GAP_MONTHS.has(m)) continue;
    const n = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < n; i += 1) {
      const student = pick(students);
      const test = pick(tests);
      const pair = `${student._id}:${test._id}`;
      if (per.has(pair)) continue;
      per.add(pair);
      const base = 45 + (11 - m) * 3.2; // upward trend
      const accuracy = Math.max(10, Math.min(98, Math.round((base + (rand() - 0.5) * 24) * 10) / 10));
      const total = test.questionCount;
      const correct = Math.round((accuracy / 100) * total);
      const submittedAt = dateIn(m, 1 + Math.floor(rand() * 26));
      const startedAt = new Date(submittedAt.getTime() - (8 + Math.floor(rand() * 15)) * 60000);
      attempts.push({
        student: student._id,
        test: test._id,
        attemptNo: 1,
        status: 'submitted',
        questions: [],
        answers: [],
        startedAt,
        expiresAt: new Date(startedAt.getTime() + test.durationMinutes * 60000),
        submittedAt,
        score: correct,
        maxScore: total,
        accuracy: Math.round((correct / total) * 1000) / 10,
        correctCount: correct,
        codingPending: 0,
        timePerQuestion: [],
        categoryBreakdown: { 'Seeded summary': { correct, total, accuracy: Math.round((correct / total) * 1000) / 10 } },
        createdAt: startedAt,
        updatedAt: submittedAt,
        __v: 0,
      });
    }
  }
  if (attempts.length) await TestAttempt.collection.insertMany(attempts);
  return { students: students.length, applications: apps.length, attempts: attempts.length };
}

module.exports = { seedHistory };
