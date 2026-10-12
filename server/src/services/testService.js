const crypto = require('crypto');
const AppError = require('../utils/AppError');
const { parsePaging, pageResult } = require('../utils/pagination');
const testRepository = require('../repositories/testRepository');
const attemptRepository = require('../repositories/attemptRepository');
const questionRepository = require('../repositories/questionRepository');
const userRepository = require('../repositories/userRepository');
const scoringService = require('./scoringService');
const auditService = require('./auditService');
const notificationService = require('./notificationService');

const GRACE_MS = 15 * 1000; // network slack for the final submit of a test that just hit zero
const idOf = (v) => String(v && v._id ? v._id : v);

// Unbiased Fisher-Yates using crypto randomness (IPP-F-014: questions are randomised per attempt).
function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const remainingSeconds = (attempt) => Math.max(0, Math.floor((new Date(attempt.expiresAt) - Date.now()) / 1000));
const timeTaken = (a) => (a.startedAt && a.submittedAt ? Math.max(0, Math.round((new Date(a.submittedAt) - new Date(a.startedAt)) / 1000)) : null);

const testDto = (t) => ({
  id: String(t._id),
  title: t.title,
  description: t.description,
  durationMinutes: t.durationMinutes,
  questionCount: t.questionCount,
  categories: t.categories,
  isActive: t.isActive,
  createdAt: t.createdAt,
});

const summaryDto = (a) => ({
  id: String(a._id),
  test: a.test && a.test.title ? { id: idOf(a.test), title: a.test.title } : { id: idOf(a.test) },
  student: a.student && a.student.name ? { id: idOf(a.student), name: a.student.name, email: a.student.email } : undefined,
  attemptNo: a.attemptNo,
  status: a.status,
  score: a.score,
  maxScore: a.maxScore,
  accuracy: a.accuracy,
  startedAt: a.startedAt,
  submittedAt: a.submittedAt,
  timeTakenSec: timeTaken(a),
});

// Student-facing view of a running attempt. The answer key is never present (questions are loaded without it).
function attemptView(attempt) {
  const base = {
    id: String(attempt._id),
    status: attempt.status,
    test: { id: idOf(attempt.test), title: attempt.test.title, durationMinutes: attempt.test.durationMinutes },
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    remainingSeconds: attempt.status === 'in_progress' ? remainingSeconds(attempt) : 0,
  };
  if (attempt.status !== 'in_progress') return base;
  return {
    ...base,
    questions: [...attempt.questions]
      .sort((x, y) => x.order - y.order)
      .map(({ question: q, order }) => ({ id: String(q._id), order, text: q.text, type: q.type, options: q.options, category: q.category, marks: q.marks })),
    answers: attempt.answers.map((a) => ({ questionId: idOf(a.question), selectedIndex: a.selectedIndex ?? null, codeAnswer: a.codeAnswer || '', timeSpentSec: a.timeSpentSec || 0 })),
  };
}

// ── Finalising ─────────────────────────────────────────────────────────────
// Scores through the scoring service layer and closes the attempt exactly once.
async function finalizeAttempt(attempt, status) {
  const byQuestion = new Map(attempt.answers.map((a) => [idOf(a.question), a]));
  const answers = [...attempt.questions]
    .sort((x, y) => x.order - y.order)
    .map(({ question }) => {
      const a = byQuestion.get(idOf(question));
      return { questionId: idOf(question), selectedIndex: a?.selectedIndex, codeAnswer: a?.codeAnswer, timeSpentSec: a?.timeSpentSec };
    });

  const result = await scoringService.scoreAttempt({ attemptId: String(attempt._id), studentId: idOf(attempt.student), testId: idOf(attempt.test), answers });
  const updated = await attemptRepository.finalize(attempt._id, {
    status,
    submittedAt: status === 'auto_submitted' ? attempt.expiresAt : new Date(),
    score: result.score,
    maxScore: result.maxScore,
    accuracy: result.accuracy,
    correctCount: result.correctCount,
    codingPending: result.codingPending,
    timePerQuestion: result.timePerQuestion,
    categoryBreakdown: result.categoryBreakdown,
  });
  return updated || attemptRepository.findById(attempt._id); // someone else finalised first
}

// Lazily auto-submits an expired attempt (the scheduled job covers attempts nobody touches).
async function settleIfExpired(attempt) {
  if (attempt.status === 'in_progress' && new Date(attempt.expiresAt) <= new Date()) {
    return finalizeAttempt(attempt, 'auto_submitted');
  }
  return attempt;
}

async function autoSubmitExpired() {
  const expired = await attemptRepository.findExpiredInProgress();
  let n = 0;
  for (const attempt of expired) {
    await finalizeAttempt(attempt, 'auto_submitted');
    n += 1;
  }
  return n;
}

// ── Student flow ───────────────────────────────────────────────────────────
async function listForStudent(student) {
  const [tests, attempts] = await Promise.all([testRepository.listActive(), attemptRepository.listByStudent(student._id)]);
  return tests.map((t) => {
    const mine = attempts.filter((a) => String(a.test) === String(t._id)); // newest first
    const open = mine.find((a) => a.status === 'in_progress' && new Date(a.expiresAt) > new Date());
    const reenabled = mine.find((a) => a.status === 'reenabled');
    const last = mine.find((a) => ['submitted', 'auto_submitted'].includes(a.status));
    let state = 'available';
    if (open) state = 'in_progress';
    else if (!reenabled && last) state = 'completed';
    return {
      ...testDto(t),
      state,
      attemptId: open ? String(open._id) : last ? String(last._id) : null,
      lastResult: last ? { score: last.score, maxScore: last.maxScore, accuracy: last.accuracy, submittedAt: last.submittedAt } : null,
      reenabled: Boolean(reenabled),
    };
  });
}

async function beginAttempt(attempt, test) {
  const ids = shuffle(await questionRepository.poolIds(test.categories)).slice(0, test.questionCount);
  if (!ids.length) throw new AppError(409, 'TEST_UNAVAILABLE', 'This test has no questions available yet');
  const now = new Date();
  const fields = {
    status: 'in_progress',
    questions: ids.map((q, i) => ({ question: q, order: i + 1 })),
    answers: [],
    startedAt: now,
    expiresAt: new Date(now.getTime() + test.durationMinutes * 60 * 1000),
  };
  return attempt.status === 'reenabled' ? attemptRepository.begin(attempt._id, fields) : { ...fields };
}

// IPP-F-014 + IPP-F-016: start (or resume) a test; completed tests stay blocked until an admin re-enables them.
async function start(student, testId) {
  const test = await testRepository.findById(testId);
  if (!test || !test.isActive) throw new AppError(404, 'TEST_NOT_FOUND', 'Test not found');

  let attempts = await attemptRepository.listForStudentAndTest(student._id, test._id);
  const open = attempts.find((a) => a.status === 'in_progress');
  if (open) {
    const settled = await settleIfExpired(open);
    if (settled.status === 'in_progress') return attemptView(await attemptRepository.findByIdFull(open._id));
    attempts = await attemptRepository.listForStudentAndTest(student._id, test._id);
  }

  const reenabled = attempts.find((a) => a.status === 'reenabled');
  if (reenabled) {
    const started = await beginAttempt(reenabled, test);
    if (!started) throw new AppError(409, 'ATTEMPT_CONFLICT', 'Could not start the attempt, please retry');
    return attemptView(await attemptRepository.findByIdFull(reenabled._id));
  }
  if (attempts.length) {
    throw new AppError(409, 'REATTEMPT_BLOCKED', 'You have already completed this test. Ask an administrator to re-enable it.');
  }

  const fields = await beginAttempt({ status: 'new' }, test);
  try {
    const created = await attemptRepository.create({ student: student._id, test: test._id, attemptNo: 1, ...fields });
    return attemptView(await attemptRepository.findByIdFull(created._id));
  } catch (err) {
    if (err.code === 11000) {
      // Double-click / two tabs: return the attempt that won the race.
      const existing = (await attemptRepository.listForStudentAndTest(student._id, test._id))[0];
      return attemptView(await attemptRepository.findByIdFull(existing._id));
    }
    throw err;
  }
}

async function loadOwn(student, id) {
  const attempt = await attemptRepository.findById(id);
  if (!attempt) throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Attempt not found');
  if (idOf(attempt.student) !== idOf(student._id)) throw new AppError(403, 'FORBIDDEN', 'You do not have access to this attempt');
  return attempt;
}

async function getAttempt(student, id) {
  const attempt = await settleIfExpired(await loadOwn(student, id));
  return attemptView(await attemptRepository.findByIdFull(attempt._id));
}

// IPP-F-014: progress auto-save. Merges answers by question; rejected once the attempt is closed or out of time.
async function saveAnswers(student, id, { answers }) {
  const attempt = await loadOwn(student, id);
  if (attempt.status !== 'in_progress') throw new AppError(409, 'ATTEMPT_CLOSED', 'This attempt is already finished');
  if (new Date(attempt.expiresAt) <= new Date()) {
    await finalizeAttempt(attempt, 'auto_submitted');
    throw new AppError(409, 'ATTEMPT_EXPIRED', 'Time is up. Your attempt was submitted automatically.');
  }
  attempt.answers = mergeAnswers(attempt, answers);
  await attemptRepository.saveAnswers(attempt._id, attempt.answers);
  return { savedAt: new Date(), remainingSeconds: remainingSeconds(attempt) };
}

function mergeAnswers(attempt, incoming) {
  const allowed = new Set(attempt.questions.map((q) => idOf(q.question)));
  const merged = new Map(attempt.answers.map((a) => [idOf(a.question), a.toObject ? a.toObject() : a]));
  for (const a of incoming || []) {
    if (!allowed.has(a.questionId)) throw new AppError(400, 'VALIDATION_ERROR', 'Answer refers to a question that is not part of this attempt');
    const prev = merged.get(a.questionId) || { question: a.questionId };
    merged.set(a.questionId, {
      question: a.questionId,
      selectedIndex: a.selectedIndex === undefined ? prev.selectedIndex : a.selectedIndex === null ? undefined : a.selectedIndex,
      codeAnswer: a.codeAnswer === undefined ? prev.codeAnswer : a.codeAnswer,
      timeSpentSec: a.timeSpentSec === undefined ? prev.timeSpentSec : Math.min(a.timeSpentSec, 24 * 3600),
    });
  }
  return [...merged.values()];
}

// IPP-F-015: submit (optionally with a final answers flush). Idempotent: resubmitting returns the stored result.
async function submit(student, id, { answers } = {}) {
  const attempt = await loadOwn(student, id);
  if (attempt.status !== 'in_progress') return result(student, id);

  const onTime = Date.now() <= new Date(attempt.expiresAt).getTime() + GRACE_MS;
  if (onTime && answers?.length) {
    attempt.answers = mergeAnswers(attempt, answers);
    await attemptRepository.saveAnswers(attempt._id, attempt.answers);
  }
  // Past the deadline (even inside the grace window) it counts as an automatic submission.
  const expired = new Date(attempt.expiresAt) <= new Date();
  await finalizeAttempt(attempt, expired ? 'auto_submitted' : 'submitted');
  return result(student, id);
}

// Score + analytics + per-question review (answer key is only revealed once the attempt is finished).
async function result(student, id) {
  const attempt = await settleIfExpired(await loadOwn(student, id));
  if (attempt.status === 'in_progress') throw new AppError(409, 'ATTEMPT_IN_PROGRESS', 'The attempt is still in progress');
  const full = await attemptRepository.findByIdFull(attempt._id);
  const ids = full.questions.map((q) => idOf(q.question));
  const keyed = new Map((await questionRepository.findByIdsWithKey(ids)).map((q) => [String(q._id), q]));
  const answerBy = new Map(full.answers.map((a) => [idOf(a.question), a]));
  const seconds = new Map((full.timePerQuestion || []).map((t) => [idOf(t.question), t.seconds]));

  const review = [...full.questions]
    .sort((x, y) => x.order - y.order)
    .map(({ question: q, order }) => {
      const key = keyed.get(String(q._id));
      const a = answerBy.get(String(q._id));
      const answered = a && Number.isInteger(a.selectedIndex);
      return {
        questionId: String(q._id),
        order,
        text: q.text,
        type: q.type,
        category: q.category,
        marks: q.marks,
        options: q.options,
        selectedIndex: answered ? a.selectedIndex : null,
        correctIndex: q.type === 'mcq' ? key.correctIndex : null,
        correct: q.type === 'mcq' ? Boolean(answered && a.selectedIndex === key.correctIndex) : null,
        codeAnswer: q.type === 'coding' ? a?.codeAnswer || '' : undefined,
        timeSpentSec: seconds.get(String(q._id)) || 0,
      };
    });

  const answeredCount = review.filter((r) => (r.type === 'mcq' ? r.selectedIndex !== null : Boolean(r.codeAnswer))).length;
  return {
    ...summaryDto(full),
    test: { id: idOf(full.test), title: full.test.title },
    correctCount: full.correctCount,
    codingPending: full.codingPending,
    totalQuestions: review.length,
    answeredCount,
    avgTimePerQuestionSec: review.length ? Math.round(review.reduce((s, r) => s + r.timeSpentSec, 0) / review.length) : 0,
    categoryBreakdown: Object.entries(full.categoryBreakdown || {}).map(([category, v]) => ({ category, ...v })),
    review,
  };
}

async function listMine(student, query) {
  const paging = parsePaging(query);
  const { items, total } = await attemptRepository.listFinishedForStudent(student._id, paging);
  return pageResult(items.map(summaryDto), total, paging);
}

// ── Admin: tests, analytics, re-enable ─────────────────────────────────────
async function createTest(admin, data, ctx = {}) {
  const t = await testRepository.create({ ...data, createdBy: admin._id });
  await auditService.record({ actor: admin._id, action: 'TEST_CREATED', targetType: 'Test', targetId: t._id, metadata: { title: t.title }, ip: ctx.ip });
  return testDto(t);
}

async function updateTest(admin, id, data, ctx = {}) {
  const t = await testRepository.findById(id);
  if (!t) throw new AppError(404, 'TEST_NOT_FOUND', 'Test not found');
  Object.assign(t, data);
  await testRepository.save(t);
  await auditService.record({ actor: admin._id, action: 'TEST_UPDATED', targetType: 'Test', targetId: t._id, ip: ctx.ip });
  return testDto(t);
}

async function listTests(query) {
  const paging = parsePaging(query, { defaultLimit: 20 });
  const { items, total } = await testRepository.list(paging);
  return pageResult(items.map(testDto), total, paging);
}

// IPP-F-017: analytics are queryable per test and per student.
async function attemptsForTest(testId, query) {
  const test = await testRepository.findById(testId);
  if (!test) throw new AppError(404, 'TEST_NOT_FOUND', 'Test not found');
  const paging = parsePaging(query);
  const [{ items, total }, summary] = await Promise.all([attemptRepository.listForTest(test._id, paging), attemptRepository.testSummary(test._id)]);
  return { ...pageResult(items.map(summaryDto), total, paging), test: testDto(test), summary };
}

async function attemptsForStudent(studentId, query) {
  const student = await userRepository.findById(studentId);
  if (!student || student.role !== 'student') throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  const paging = parsePaging(query);
  const { items, total } = await attemptRepository.listForStudentAdmin(student._id, paging);
  return pageResult(items.map(summaryDto), total, paging);
}

// IPP-F-016: an administrator override creates a NEW attempt record; the student can then start it once.
async function reenable(admin, attemptId, ctx = {}) {
  const attempt = await attemptRepository.findById(attemptId);
  if (!attempt) throw new AppError(404, 'ATTEMPT_NOT_FOUND', 'Attempt not found');
  if (!attemptRepository.FINISHED.includes(attempt.status)) throw new AppError(409, 'ATTEMPT_NOT_FINISHED', 'Only completed attempts can be re-enabled');

  const all = await attemptRepository.listForStudentAndTest(attempt.student, attempt.test); // newest first
  if (all.some((a) => ['reenabled', 'in_progress'].includes(a.status))) {
    throw new AppError(409, 'ALREADY_REENABLED', 'This student already has an open or re-enabled attempt for this test');
  }
  const created = await attemptRepository.create({
    student: attempt.student,
    test: attempt.test,
    attemptNo: all[0].attemptNo + 1,
    status: 'reenabled',
    reenabledBy: admin._id,
  });
  const test = await testRepository.findById(attempt.test);
  await auditService.record({
    actor: admin._id,
    action: 'ATTEMPT_REENABLED',
    targetType: 'TestAttempt',
    targetId: created._id,
    metadata: { student: String(attempt.student), test: String(attempt.test), attemptNo: created.attemptNo },
    ip: ctx.ip,
  });
  await notificationService.notify({
    userId: attempt.student,
    type: 'test_reenabled',
    message: `An administrator re-enabled the test "${test.title}". You can attempt it again.`,
    emailSubject: `Test re-enabled: ${test.title}`,
    link: '/student/tests',
  });
  return summaryDto(created);
}

module.exports = {
  listForStudent,
  start,
  getAttempt,
  saveAnswers,
  submit,
  result,
  listMine,
  createTest,
  updateTest,
  listTests,
  attemptsForTest,
  attemptsForStudent,
  reenable,
  autoSubmitExpired,
  finalizeAttempt,
};
