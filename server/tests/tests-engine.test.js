const { describe, it, before, after, beforeEach } = require('node:test');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const Question = require('../src/models/Question');
const Test = require('../src/models/Test');
const TestAttempt = require('../src/models/TestAttempt');
const AuditLog = require('../src/models/AuditLog');
const Notification = require('../src/models/Notification');
const scoringService = require('../src/services/scoringService');
const testService = require('../src/services/testService');
const autoSubmitJob = require('../src/jobs/autoSubmitAttempts');
const { startDb, stopDb, clearDb, createUser } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

// Known answer key: question i has correct option (i % 4); categories alternate Quant / Logic.
async function seedBank(n = 10) {
  const docs = [];
  for (let i = 0; i < n; i += 1) {
    docs.push({
      text: `Question number ${i}?`,
      type: 'mcq',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: i % 4,
      category: i % 2 === 0 ? 'Quant' : 'Logic',
      marks: 1 + (i % 2), // 1 or 2 marks
    });
  }
  return Question.create(docs);
}
const makeTest = (over = {}) => Test.create({ title: 'Aptitude 1', durationMinutes: 30, questionCount: 5, ...over });

async function setup({ bank = 10, test = {} } = {}) {
  const [student, admin] = await Promise.all([createUser({ role: 'student' }), createUser({ role: 'admin' })]);
  await seedBank(bank);
  const t = await makeTest(test);
  return { student, admin, test: t };
}
const start = (who, test) => request(app).post(`/api/tests/${test._id}/start`).set(who.auth);
const keyOf = async (id) => (await Question.findById(id).select('+correctIndex')).correctIndex;

describe('test engine: start, randomisation, timer (IPP-F-014)', () => {
  it('starts an attempt with the configured question count, duration and no answer key', async () => {
    const { student, test } = await setup();
    const res = await start(student, test);
    expect(res.status).toBe(201);
    const a = res.body.attempt;
    expect(a.status).toBe('in_progress');
    expect(a.questions).toHaveLength(5);
    expect(JSON.stringify(a)).not.toContain('correctIndex');
    expect(a.remainingSeconds).toBeGreaterThan(30 * 60 - 5);
    expect(a.remainingSeconds).toBeLessThan(30 * 60 + 1);
    expect(new Set(a.questions.map((q) => q.id)).size).toBe(5);
  });

  it('randomises question selection/order across attempts', async () => {
    const { test } = await setup({ bank: 30, test: { questionCount: 10 } });
    const orders = new Set();
    for (let i = 0; i < 6; i += 1) {
      const s = await createUser({ role: 'student' });
      const res = await start(s, test);
      orders.add(res.body.attempt.questions.map((q) => q.id).join(','));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('draws only from the configured categories and active questions', async () => {
    const { student, test } = await setup({ test: { categories: ['Logic'], questionCount: 50 } });
    await Question.updateOne({ category: 'Logic' }, { active: false });
    const res = await start(student, test);
    expect(res.body.attempt.questions.length).toBe(4); // 5 Logic questions, 1 archived
    expect(res.body.attempt.questions.every((q) => q.category === 'Logic')).toBe(true);
  });

  it('resumes the same attempt when started twice (no second attempt)', async () => {
    const { student, test } = await setup();
    const a = await start(student, test);
    const b = await start(student, test);
    expect(b.body.attempt.id).toBe(a.body.attempt.id);
    expect(await TestAttempt.countDocuments()).toBe(1);
  });

  it('404s for inactive/unknown tests, 409 when the bank is empty, and is student only', async () => {
    const { student, admin, test } = await setup();
    await Test.updateOne({ _id: test._id }, { isActive: false });
    expect((await start(student, test)).status).toBe(404);
    expect((await request(app).post('/api/tests/64b000000000000000000000/start').set(student.auth)).status).toBe(404);
    const empty = await Test.create({ title: 'Empty', durationMinutes: 5, questionCount: 3, categories: ['Nothing'] });
    expect((await start(student, empty)).body.code).toBe('TEST_UNAVAILABLE');
    expect((await start(admin, test)).status).toBe(403);
    expect((await request(app).post(`/api/tests/${test._id}/start`)).status).toBe(401);
  });

  it('lists tests with the student state', async () => {
    const { student, test } = await setup();
    expect((await request(app).get('/api/tests').set(student.auth)).body.tests[0].state).toBe('available');
    await start(student, test);
    expect((await request(app).get('/api/tests').set(student.auth)).body.tests[0].state).toBe('in_progress');
  });
});

describe('auto-save (IPP-F-014)', () => {
  it('persists answers incrementally and returns them when the attempt is reopened', async () => {
    const { student, test } = await setup();
    const { attempt } = (await start(student, test)).body;
    const [q1, q2] = attempt.questions;
    const put = (answers) => request(app).put(`/api/attempts/${attempt.id}/answers`).set(student.auth).send({ answers });

    expect((await put([{ questionId: q1.id, selectedIndex: 2, timeSpentSec: 7 }])).status).toBe(200);
    expect((await put([{ questionId: q2.id, selectedIndex: 1 }])).status).toBe(200);
    expect((await put([{ questionId: q1.id, selectedIndex: 3 }])).status).toBe(200); // change an answer; keeps timeSpent

    const reopened = (await request(app).get(`/api/attempts/${attempt.id}`).set(student.auth)).body.attempt;
    const byQ = Object.fromEntries(reopened.answers.map((a) => [a.questionId, a]));
    expect(byQ[q1.id].selectedIndex).toBe(3);
    expect(byQ[q1.id].timeSpentSec).toBe(7);
    expect(byQ[q2.id].selectedIndex).toBe(1);
  });

  it('rejects answers for questions outside the attempt, bad indexes, and other students', async () => {
    const { student, test } = await setup();
    const other = await createUser({ role: 'student' });
    const { attempt } = (await start(student, test)).body;
    const outside = await Question.findOne({ _id: { $nin: attempt.questions.map((q) => q.id) } });
    const put = (who, answers) => request(app).put(`/api/attempts/${attempt.id}/answers`).set(who.auth).send({ answers });
    expect((await put(student, [{ questionId: String(outside._id), selectedIndex: 0 }])).status).toBe(400);
    expect((await put(student, [{ questionId: attempt.questions[0].id, selectedIndex: 99 }])).status).toBe(400);
    expect((await put(other, [{ questionId: attempt.questions[0].id, selectedIndex: 0 }])).status).toBe(403);
    expect((await request(app).get(`/api/attempts/${attempt.id}`).set(other.auth)).status).toBe(403);
  });
});

describe('MCQ auto-scoring (IPP-F-015)', () => {
  it('scores to the known answer key and returns the result immediately', async () => {
    const { student, test } = await setup();
    const { attempt } = (await start(student, test)).body;
    // Answer every question correctly except the first (wrong) and the last (skipped).
    const answers = [];
    let expectedScore = 0;
    let expectedMax = 0;
    for (let i = 0; i < attempt.questions.length; i += 1) {
      const q = attempt.questions[i];
      const key = await keyOf(q.id);
      expectedMax += q.marks;
      if (i === attempt.questions.length - 1) continue; // unanswered
      if (i === 0) answers.push({ questionId: q.id, selectedIndex: (key + 1) % 4, timeSpentSec: 10 });
      else {
        answers.push({ questionId: q.id, selectedIndex: key, timeSpentSec: 20 });
        expectedScore += q.marks;
      }
    }
    const res = await request(app).post(`/api/attempts/${attempt.id}/submit`).set(student.auth).send({ answers });
    expect(res.status).toBe(200);
    const r = res.body.result;
    expect(r.status).toBe('submitted');
    expect(r.score).toBe(expectedScore);
    expect(r.maxScore).toBe(expectedMax);
    expect(r.correctCount).toBe(3);
    expect(r.accuracy).toBe(60); // 3 of 5
    expect(r.totalQuestions).toBe(5);
    expect(r.answeredCount).toBe(4);
    expect(r.review.filter((x) => x.correct === true)).toHaveLength(3);
    expect(r.review.find((x) => x.selectedIndex === null).correct).toBe(false);
    expect(r.review.every((x) => Number.isInteger(x.correctIndex))).toBe(true);
  });

  it('computes category-wise analytics and time per question (IPP-F-017)', async () => {
    const { student, test } = await setup({ bank: 10, test: { questionCount: 10 } });
    const { attempt } = (await start(student, test)).body;
    const answers = [];
    for (const q of attempt.questions) {
      const key = await keyOf(q.id);
      // Everything in Quant right, everything in Logic wrong.
      answers.push({ questionId: q.id, selectedIndex: q.category === 'Quant' ? key : (key + 1) % 4, timeSpentSec: 12 });
    }
    const r = (await request(app).post(`/api/attempts/${attempt.id}/submit`).set(student.auth).send({ answers })).body.result;
    const cat = Object.fromEntries(r.categoryBreakdown.map((c) => [c.category, c]));
    expect(cat.Quant).toMatchObject({ correct: 5, total: 5, accuracy: 100 });
    expect(cat.Logic).toMatchObject({ correct: 0, total: 5, accuracy: 0 });
    expect(r.accuracy).toBe(50);
    expect(r.avgTimePerQuestionSec).toBe(12);
    const stored = await TestAttempt.findById(attempt.id);
    expect(stored.timePerQuestion).toHaveLength(10);
    expect(stored.timePerQuestion[0].seconds).toBe(12);
  });

  it('is idempotent: resubmitting returns the stored result and cannot change it', async () => {
    const { student, test } = await setup();
    const { attempt } = (await start(student, test)).body;
    const first = (await request(app).post(`/api/attempts/${attempt.id}/submit`).set(student.auth).send({})).body.result;
    const key = await keyOf(attempt.questions[0].id);
    const again = (await request(app).post(`/api/attempts/${attempt.id}/submit`).set(student.auth).send({ answers: [{ questionId: attempt.questions[0].id, selectedIndex: key }] })).body.result;
    expect(again.score).toBe(first.score);
    expect(again.answeredCount).toBe(first.answeredCount);
    const late = await request(app).put(`/api/attempts/${attempt.id}/answers`).set(student.auth).send({ answers: [] });
    expect(late.status).toBe(409);
  });

  it('result is hidden while in progress and only visible to the owner', async () => {
    const { student, test } = await setup();
    const other = await createUser({ role: 'student' });
    const { attempt } = (await start(student, test)).body;
    expect((await request(app).get(`/api/attempts/${attempt.id}/result`).set(student.auth)).body.code).toBe('ATTEMPT_IN_PROGRESS');
    await request(app).post(`/api/attempts/${attempt.id}/submit`).set(student.auth).send({});
    expect((await request(app).get(`/api/attempts/${attempt.id}/result`).set(student.auth)).status).toBe(200);
    expect((await request(app).get(`/api/attempts/${attempt.id}/result`).set(other.auth)).status).toBe(403);
    const mine = await request(app).get('/api/attempts/mine').set(student.auth);
    expect(mine.body.total).toBe(1);
  });

  it('coding answers are recorded but not auto-scored', async () => {
    const student = await createUser({ role: 'student' });
    await Question.create([
      { text: 'Reverse a string in your language.', type: 'coding', category: 'Coding', marks: 5 },
      { text: 'What is 2 + 2?', type: 'mcq', options: ['3', '4'], correctIndex: 1, category: 'Quant' },
    ]);
    const test = await makeTest({ questionCount: 2 });
    const { attempt } = (await start(student, test)).body;
    const coding = attempt.questions.find((q) => q.type === 'coding');
    const mcq = attempt.questions.find((q) => q.type === 'mcq');
    const code = 'for (let i = 0; i < n; i++) { if (a<b && c>d) {} }';
    const r = (await request(app).post(`/api/attempts/${attempt.id}/submit`).set(student.auth).send({
      answers: [{ questionId: coding.id, codeAnswer: code }, { questionId: mcq.id, selectedIndex: 1 }],
    })).body.result;
    expect(r.score).toBe(1);
    expect(r.maxScore).toBe(1); // coding marks are not part of the auto-scored total
    expect(r.codingPending).toBe(1);
    expect(r.review.find((x) => x.type === 'coding').codeAnswer).toBe(code); // "<" and ">" survive sanitisation
  });
});

describe('timer and auto-submit (IPP-F-014)', () => {
  it('auto-submits when the timer has reached zero and rejects late saves', async () => {
    const { student, test } = await setup();
    const { attempt } = (await start(student, test)).body;
    const key = await keyOf(attempt.questions[0].id);
    await request(app).put(`/api/attempts/${attempt.id}/answers`).set(student.auth).send({ answers: [{ questionId: attempt.questions[0].id, selectedIndex: key }] });

    await TestAttempt.updateOne({ _id: attempt.id }, { expiresAt: new Date(Date.now() - 1000) });
    const late = await request(app).put(`/api/attempts/${attempt.id}/answers`).set(student.auth).send({ answers: [{ questionId: attempt.questions[1].id, selectedIndex: 0 }] });
    expect(late.status).toBe(409);
    expect(late.body.code).toBe('ATTEMPT_EXPIRED');

    const done = await TestAttempt.findById(attempt.id);
    expect(done.status).toBe('auto_submitted');
    expect(done.score).toBeGreaterThan(0); // the answer saved before time ran out still counts
    expect(done.submittedAt.getTime()).toBe(done.expiresAt.getTime());
  });

  it('the scheduled job submits expired attempts nobody touched', async () => {
    const { student, test } = await setup();
    const { attempt } = (await start(student, test)).body;
    await TestAttempt.updateOne({ _id: attempt.id }, { expiresAt: new Date(Date.now() - 5000) });
    expect(await autoSubmitJob.run()).toBe(1);
    expect((await TestAttempt.findById(attempt.id)).status).toBe('auto_submitted');
    expect(await autoSubmitJob.run()).toBe(0);
  });

  it('a submit after the grace period ignores the late answers', async () => {
    const { student, test } = await setup();
    const { attempt } = (await start(student, test)).body;
    await TestAttempt.updateOne({ _id: attempt.id }, { expiresAt: new Date(Date.now() - 60 * 1000) });
    const key = await keyOf(attempt.questions[0].id);
    const res = await request(app).post(`/api/attempts/${attempt.id}/submit`).set(student.auth).send({ answers: [{ questionId: attempt.questions[0].id, selectedIndex: key }] });
    expect(res.body.result.status).toBe('auto_submitted');
    expect(res.body.result.correctCount).toBe(0);
  });

  it('GET on an expired attempt settles it and reports the finished status', async () => {
    const { student, test } = await setup();
    const { attempt } = (await start(student, test)).body;
    await TestAttempt.updateOne({ _id: attempt.id }, { expiresAt: new Date(Date.now() - 1000) });
    const res = await request(app).get(`/api/attempts/${attempt.id}`).set(student.auth);
    expect(res.body.attempt.status).toBe('auto_submitted');
    expect(res.body.attempt.questions).toBeUndefined();
  });
});

describe('reattempt block + admin override (IPP-F-016)', () => {
  async function finished() {
    const ctx = await setup();
    const { attempt } = (await start(ctx.student, ctx.test)).body;
    await request(app).post(`/api/attempts/${attempt.id}/submit`).set(ctx.student.auth).send({});
    return { ...ctx, attemptId: attempt.id };
  }

  it('blocks a completed test with a clear message', async () => {
    const { student, test } = await finished();
    const res = await start(student, test);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REATTEMPT_BLOCKED');
    expect(res.body.message).toContain('administrator');
    expect((await request(app).get('/api/tests').set(student.auth)).body.tests[0].state).toBe('completed');
  });

  it('admin override creates a NEW attempt record that the student can run once', async () => {
    const { student, admin, test, attemptId } = await finished();
    const res = await request(app).post(`/api/admin/attempts/${attemptId}/reenable`).set(admin.auth);
    expect(res.status).toBe(201);
    expect(res.body.attempt.attemptNo).toBe(2);
    expect(res.body.attempt.status).toBe('reenabled');
    expect(await TestAttempt.countDocuments()).toBe(2);
    expect(await AuditLog.countDocuments({ action: 'ATTEMPT_REENABLED' })).toBe(1);
    expect(await Notification.countDocuments({ type: 'test_reenabled' })).toBe(1);

    const second = await start(student, test);
    expect(second.status).toBe(201);
    expect(second.body.attempt.id).toBe(res.body.attempt.id);
    expect(second.body.attempt.status).toBe('in_progress');
    await request(app).post(`/api/attempts/${second.body.attempt.id}/submit`).set(student.auth).send({});
    expect((await start(student, test)).status).toBe(409); // blocked again until re-enabled again
    expect(await TestAttempt.countDocuments()).toBe(2);
  });

  it('refuses invalid overrides and non-admins', async () => {
    const { student, admin, test, attemptId } = await finished();
    expect((await request(app).post(`/api/admin/attempts/${attemptId}/reenable`).set(student.auth)).status).toBe(403);
    await request(app).post(`/api/admin/attempts/${attemptId}/reenable`).set(admin.auth);
    expect((await request(app).post(`/api/admin/attempts/${attemptId}/reenable`).set(admin.auth)).body.code).toBe('ALREADY_REENABLED');
    expect((await request(app).post('/api/admin/attempts/64b000000000000000000000/reenable').set(admin.auth)).status).toBe(404);
    const open = await Test.create({ title: 'Other', durationMinutes: 5, questionCount: 2 });
    const { attempt } = (await start(student, open)).body;
    expect((await request(app).post(`/api/admin/attempts/${attempt.id}/reenable`).set(admin.auth)).body.code).toBe('ATTEMPT_NOT_FINISHED');
  });
});

describe('analytics per student and per test (IPP-F-017)', () => {
  it('admin can query attempts and aggregates per test and per student', async () => {
    const { student, admin, test } = await setup({ test: { questionCount: 10 }, bank: 10 });
    const s2 = await createUser({ role: 'student' });
    for (const [who, right] of [[student, true], [s2, false]]) {
      const { attempt } = (await start(who, test)).body;
      const answers = [];
      for (const q of attempt.questions) {
        const key = await keyOf(q.id);
        answers.push({ questionId: q.id, selectedIndex: right ? key : (key + 1) % 4, timeSpentSec: 5 });
      }
      await request(app).post(`/api/attempts/${attempt.id}/submit`).set(who.auth).send({ answers });
    }
    const perTest = await request(app).get(`/api/admin/tests/${test._id}/attempts`).set(admin.auth);
    expect(perTest.status).toBe(200);
    expect(perTest.body.total).toBe(2);
    expect(perTest.body.summary).toMatchObject({ attempts: 2, students: 2, avgAccuracy: 50 });
    expect(perTest.body.summary.categoryAccuracy).toHaveLength(2);
    expect(perTest.body.items[0].student.email).toBeDefined();

    const perStudent = await request(app).get(`/api/admin/students/${student.user._id}/attempts`).set(admin.auth);
    expect(perStudent.body.total).toBe(1);
    expect(perStudent.body.items[0].accuracy).toBe(100);
    expect((await request(app).get(`/api/admin/students/${admin.user._id}/attempts`).set(admin.auth)).status).toBe(404);
    expect((await request(app).get(`/api/admin/tests/${test._id}/attempts`).set(student.auth)).status).toBe(403);
  });
});

describe('scoring service layer (swap point)', () => {
  it('testService scores through scoringService, so a replacement implementation takes over', async () => {
    const { student, test } = await setup();
    const { attempt } = (await start(student, test)).body;
    let received;
    scoringService.setScorer(async (payload) => {
      received = payload;
      return { score: 42, maxScore: 50, accuracy: 84, correctCount: 0, codingPending: 0, timePerQuestion: [], categoryBreakdown: {}, perQuestion: [] };
    });
    try {
      const r = (await request(app).post(`/api/attempts/${attempt.id}/submit`).set(student.auth).send({})).body.result;
      expect(r.score).toBe(42);
      expect(r.accuracy).toBe(84);
      expect(received.answers).toHaveLength(5);
      expect(received.attemptId).toBe(attempt.id);
      expect(received.studentId).toBe(String(student.user._id));
      expect(received.testId).toBe(String(test._id));
    } finally {
      scoringService.setScorer(null);
    }
  });

  it('rejects unknown question ids with 422 as in the SAD contract', async () => {
    let err;
    await scoringService.nodeScorer({ answers: [{ questionId: '64b000000000000000000000' }] }).catch((e) => {
      err = e;
    });
    expect(err.statusCode).toBe(422);
  });

  it('exposes autoSubmitExpired for operations', async () => {
    expect(await testService.autoSubmitExpired()).toBe(0);
  });
});
