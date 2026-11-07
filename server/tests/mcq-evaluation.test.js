// server/tests/mcq-evaluation.test.js
// IPP-F-015 / TC-Test-02: Comprehensive MCQ evaluation and known answer key reconciliation suite.
// Acceptance criteria:
//   1. Submitting known MCQ answers evaluates accurately against the answer key.
//   2. 100% correct submissions achieve full score and 100% accuracy.
//   3. Partial submissions (mix of correct, incorrect, and omitted answers) score earned marks per question weight.
//   4. Answer key remains masked during active attempts and is only revealed after submission.
//   5. Immediate score display after submission with per-question and category breakdowns.
//   6. Idempotent submission: subsequent submit calls return the persisted score without re-evaluation drift.
const { describe, it, before, after, beforeEach } = require('node:test');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const Question = require('../src/models/Question');
const Test = require('../src/models/Test');
const TestAttempt = require('../src/models/TestAttempt');
const { verifyAnswerKey } = require('../src/services/scoringService');
const { startDb, stopDb, clearDb, createUser } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

// Seeds 8 questions with deterministic properties and varying marks
async function seedQuestionBank() {
  const specs = [
    { text: 'What is the time complexity of binary search?', options: ['O(n)', 'O(log n)', 'O(n^2)', 'O(1)'], correctIndex: 1, category: 'Algorithms', marks: 2 },
    { text: 'Which data structure follows LIFO?', options: ['Queue', 'Stack', 'Array', 'Graph'], correctIndex: 1, category: 'Data Structures', marks: 1 },
    { text: 'Which HTTP method is idempotent?', options: ['POST', 'PUT', 'PATCH', 'CONNECT'], correctIndex: 1, category: 'Web', marks: 2 },
    { text: 'What does SQL stand for?', options: ['Structured Query Language', 'Simple Question Language', 'Standard Query List', 'Sequential Query Loop'], correctIndex: 0, category: 'Databases', marks: 1 },
    { text: 'Which layer of OSI model does TCP operate on?', options: ['Network', 'Data Link', 'Transport', 'Session'], correctIndex: 2, category: 'Networking', marks: 2 },
    { text: 'What is a closure in JavaScript?', options: ['A syntax error', 'A function bundled with lexical scope', 'A loop construct', 'A memory leak'], correctIndex: 1, category: 'Web', marks: 3 },
  ];

  return Question.create(specs.map((s) => ({ ...s, type: 'mcq' })));
}

async function createAptitudeTest(questionCount = 6) {
  return Test.create({
    title: 'Core Computer Science Benchmark',
    description: 'Timed assessment covering DSA, Web, and Networking',
    durationMinutes: 30,
    questionCount,
    isActive: true,
  });
}

describe('TC-Test-02 | Automatic MCQ evaluation and answer key reconciliation (IPP-F-015)', () => {
  it('evaluates a 100% correct submission against the known answer key and displays exact scores', async () => {
    const student = await createUser({ role: 'student' });
    await seedQuestionBank();
    const test = await createAptitudeTest(6);

    // 1. Student starts the test
    const startRes = await request(app).post(`/api/tests/${test._id}/start`).set(student.auth);
    expect(startRes.status).toBe(201);

    const attempt = startRes.body.attempt;
    const attemptId = attempt.id;
    expect(attempt.status).toBe('in_progress');
    expect(attempt.questions).toHaveLength(6);

    // Verify answer key is strictly masked during in-progress attempt
    for (const q of attempt.questions) {
      expect(q.correctIndex).toBeUndefined();
    }

    // 2. Look up the true answer key directly from the database
    const questionIds = attempt.questions.map((q) => q.id);
    const dbQuestions = await Question.find({ _id: { $in: questionIds } }).select('+correctIndex');
    const answerKeyMap = Object.fromEntries(dbQuestions.map((q) => [String(q._id), q.correctIndex]));
    const totalPossibleMarks = dbQuestions.reduce((sum, q) => sum + q.marks, 0);

    // 3. Prepare answers matching the answer key exactly
    const perfectAnswers = attempt.questions.map((q) => ({
      questionId: q.id,
      selectedIndex: answerKeyMap[q.id],
      timeSpentSec: 25,
    }));

    // Verify verifyAnswerKey utility reconciliation
    const preCheck = verifyAnswerKey(perfectAnswers, answerKeyMap);
    expect(preCheck.matchedCount).toBe(6);
    expect(preCheck.reconciledAccuracy).toBe(100);

    // 4. Save answers
    const saveRes = await request(app).put(`/api/attempts/${attemptId}/answers`).set(student.auth).send({ answers: perfectAnswers });
    expect(saveRes.status).toBe(200);

    // 5. Submit the test
    const submitRes = await request(app).post(`/api/attempts/${attemptId}/submit`).set(student.auth).send();
    expect(submitRes.status).toBe(200);

    const result = submitRes.body.result;
    expect(result.status).toBe('submitted');
    expect(result.score).toBe(totalPossibleMarks);
    expect(result.maxScore).toBe(totalPossibleMarks);
    expect(result.accuracy).toBe(100);
    expect(result.correctCount).toBe(6);

    // 6. Inspect per-question review and answer key reveal post-submission
    // review items use field `correct` (not `isCorrect`)
    expect(result.review).toHaveLength(6);
    for (const r of result.review) {
      // selectedIndex is non-null when answered
      expect(r.selectedIndex).not.toBe(null);
      expect(r.correct).toBe(true);
      expect(r.selectedIndex).toBe(answerKeyMap[r.questionId]);
      expect(r.correctIndex).toBe(answerKeyMap[r.questionId]);
    }
  });

  it('evaluates partial submissions with correct, incorrect, and omitted answers accurately', async () => {
    const student = await createUser({ role: 'student' });
    await seedQuestionBank();
    const test = await createAptitudeTest(6);

    const startRes = await request(app).post(`/api/tests/${test._id}/start`).set(student.auth);
    expect(startRes.status).toBe(201);
    const attempt = startRes.body.attempt;
    const attemptId = attempt.id;

    const questionIds = attempt.questions.map((q) => q.id);
    const dbQuestions = await Question.find({ _id: { $in: questionIds } }).select('+correctIndex');
    const answerKeyMap = Object.fromEntries(dbQuestions.map((q) => [String(q._id), q.correctIndex]));
    const marksMap = Object.fromEntries(dbQuestions.map((q) => [String(q._id), q.marks]));
    const totalPossibleMarks = dbQuestions.reduce((sum, q) => sum + q.marks, 0);

    // Question 0, 1, 2: Correct answers
    // Question 3, 4: Wrong answers (pick (correct + 1) % 4)
    // Question 5: Omitted / unanswered
    const mixedAnswers = [];
    let expectedEarnedScore = 0;

    attempt.questions.forEach((q, index) => {
      const correctIdx = answerKeyMap[q.id];
      if (index < 3) {
        // Correct
        mixedAnswers.push({ questionId: q.id, selectedIndex: correctIdx, timeSpentSec: 20 });
        expectedEarnedScore += marksMap[q.id];
      } else if (index < 5) {
        // Incorrect
        const wrongIdx = (correctIdx + 1) % 4;
        mixedAnswers.push({ questionId: q.id, selectedIndex: wrongIdx, timeSpentSec: 30 });
      }
      // Index 5 omitted completely from submission
    });

    const submitRes = await request(app).post(`/api/attempts/${attemptId}/submit`).set(student.auth).send({ answers: mixedAnswers });
    expect(submitRes.status).toBe(200);

    const result = submitRes.body.result;
    expect(result.score).toBe(expectedEarnedScore);
    expect(result.maxScore).toBe(totalPossibleMarks);
    expect(result.correctCount).toBe(3);
    // Accuracy = (3 correct / 6 MCQ) * 100 = 50.0%
    expect(result.accuracy).toBe(50.0);

    // Verify per-question review; field is `correct`, not `isCorrect`
    // `selectedIndex` is null when unanswered (omitted)
    const reviewByQ = Object.fromEntries(result.review.map((r) => [r.questionId, r]));
    expect(reviewByQ[attempt.questions[0].id].correct).toBe(true);
    expect(reviewByQ[attempt.questions[1].id].correct).toBe(true);
    expect(reviewByQ[attempt.questions[2].id].correct).toBe(true);
    expect(reviewByQ[attempt.questions[3].id].correct).toBe(false);
    expect(reviewByQ[attempt.questions[4].id].correct).toBe(false);
    // Question 5 was omitted — selectedIndex is null and correct is false
    expect(reviewByQ[attempt.questions[5].id].selectedIndex).toBe(null);
    expect(reviewByQ[attempt.questions[5].id].correct).toBe(false);
  });

  it('guarantees idempotency on repeated submit calls and blocks unauthorized access', async () => {
    const student1 = await createUser({ role: 'student' });
    const student2 = await createUser({ role: 'student' });
    await seedQuestionBank();
    const test = await createAptitudeTest(4);

    const startRes = await request(app).post(`/api/tests/${test._id}/start`).set(student1.auth);
    const attemptId = startRes.body.attempt.id;

    // Submit attempt
    const submit1 = await request(app).post(`/api/attempts/${attemptId}/submit`).set(student1.auth).send();
    expect(submit1.status).toBe(200);
    const score1 = submit1.body.result.score;

    // Resubmit same attempt -> returns identical result idempotently
    const submit2 = await request(app).post(`/api/attempts/${attemptId}/submit`).set(student1.auth).send();
    expect(submit2.status).toBe(200);
    expect(submit2.body.result.score).toBe(score1);

    // Another student cannot view or tamper with this attempt
    const otherGet = await request(app).get(`/api/attempts/${attemptId}`).set(student2.auth);
    expect(otherGet.status).toBe(403);

    const otherResult = await request(app).get(`/api/attempts/${attemptId}/result`).set(student2.auth);
    expect(otherResult.status).toBe(403);
  });

  it('computes category-level accuracy breakdown and time spent metrics', async () => {
    const student = await createUser({ role: 'student' });
    await seedQuestionBank();
    const test = await createAptitudeTest(6);

    const startRes = await request(app).post(`/api/tests/${test._id}/start`).set(student.auth);
    const attempt = startRes.body.attempt;
    const attemptId = attempt.id;

    const questionIds = attempt.questions.map((q) => q.id);
    const dbQuestions = await Question.find({ _id: { $in: questionIds } }).select('+correctIndex');
    const answerKeyMap = Object.fromEntries(dbQuestions.map((q) => [String(q._id), q.correctIndex]));

    // Answer with explicit timeSpentSec per question
    const answers = attempt.questions.map((q, idx) => ({
      questionId: q.id,
      selectedIndex: answerKeyMap[q.id],
      timeSpentSec: (idx + 1) * 10,
    }));

    const submitRes = await request(app).post(`/api/attempts/${attemptId}/submit`).set(student.auth).send({ answers });
    expect(submitRes.status).toBe(200);

    const result = submitRes.body.result;
    expect(result.accuracy).toBe(100);
    // categoryBreakdown is returned as an array: [{ category, total, correct, accuracy }]
    expect(result.categoryBreakdown).toBeDefined();
    expect(Array.isArray(result.categoryBreakdown)).toBe(true);

    // Verify all present categories have 100% accuracy
    for (const stats of result.categoryBreakdown) {
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.correct).toBe(stats.total);
      expect(stats.accuracy).toBe(100);
    }
  });

  it('rejects answers targeting foreign questions outside the active attempt', async () => {
    const student = await createUser({ role: 'student' });
    await seedQuestionBank();
    const test = await createAptitudeTest(4);

    const startRes = await request(app).post(`/api/tests/${test._id}/start`).set(student.auth);
    const attemptId = startRes.body.attempt.id;

    // Create an unassigned question not in this attempt
    const foreignQuestion = await Question.create({
      text: 'What is foreign key?',
      type: 'mcq',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      category: 'Databases',
      marks: 1,
    });

    // Try to save an answer targeting the foreign question
    const badSave = await request(app)
      .put(`/api/attempts/${attemptId}/answers`)
      .set(student.auth)
      .send({ answers: [{ questionId: String(foreignQuestion._id), selectedIndex: 0 }] });

    expect(badSave.status).toBe(400);
    // Error response shape: { status: 'error', code: '...', message: '...' } (flat, not nested under .error)
    expect(badSave.body.code).toBe('VALIDATION_ERROR');
  });
});
