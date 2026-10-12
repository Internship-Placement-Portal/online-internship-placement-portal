const mongoose = require('mongoose');
const TestAttempt = require('../models/TestAttempt');

const FINISHED = ['submitted', 'auto_submitted'];

const create = (data) => TestAttempt.create(data);
const findById = (id) => TestAttempt.findById(id);
const findByIdFull = (id) =>
  TestAttempt.findById(id)
    .populate('test', 'title durationMinutes questionCount')
    .populate({ path: 'questions.question', select: 'text type options category marks' });
const listForStudentAndTest = (student, test) => TestAttempt.find({ student, test }).sort({ attemptNo: -1 });
const listByStudent = (student) => TestAttempt.find({ student }).sort({ attemptNo: -1 }).lean();

// Atomic: only an in-progress attempt can be finalised, exactly once (prevents double scoring on racing submit/auto-submit).
const finalize = (id, fields) =>
  TestAttempt.findOneAndUpdate({ _id: id, status: 'in_progress' }, { $set: fields }, { returnDocument: 'after' });

// Atomic start of a re-enabled attempt.
const begin = (id, fields) =>
  TestAttempt.findOneAndUpdate({ _id: id, status: 'reenabled' }, { $set: fields }, { returnDocument: 'after' });

const saveAnswers = (id, answers) =>
  TestAttempt.updateOne({ _id: id, status: 'in_progress' }, { $set: { answers } });

const findExpiredInProgress = (now = new Date(), limit = 200) =>
  TestAttempt.find({ status: 'in_progress', expiresAt: { $lt: now } }).limit(limit);

async function listFinishedForStudent(student, { skip, limit }) {
  const filter = { student, status: { $in: FINISHED } };
  const [items, total] = await Promise.all([
    TestAttempt.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(limit).populate('test', 'title').lean(),
    TestAttempt.countDocuments(filter),
  ]);
  return { items, total };
}

// Admin: attempts for one test, newest first, with the student's identity.
async function listForTest(test, { skip, limit }) {
  const filter = { test, status: { $in: [...FINISHED, 'reenabled', 'in_progress'] } };
  const [items, total] = await Promise.all([
    TestAttempt.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).populate('student', 'name email').populate('test', 'title').lean(),
    TestAttempt.countDocuments(filter),
  ]);
  return { items, total };
}

async function listForStudentAdmin(student, { skip, limit }) {
  const filter = { student };
  const [items, total] = await Promise.all([
    TestAttempt.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).populate('student', 'name email').populate('test', 'title').lean(),
    TestAttempt.countDocuments(filter),
  ]);
  return { items, total };
}

// Per-test analytics: attempt counts, average accuracy/score and category-wise accuracy across finished attempts.
async function testSummary(test) {
  const match = { test: new mongoose.Types.ObjectId(String(test)), status: { $in: FINISHED } };
  const [overall] = await TestAttempt.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        attempts: { $sum: 1 },
        students: { $addToSet: '$student' },
        avgAccuracy: { $avg: '$accuracy' },
        avgScore: { $avg: '$score' },
        avgMaxScore: { $avg: '$maxScore' },
      },
    },
  ]);
  const docs = await TestAttempt.find(match).select('categoryBreakdown').lean();
  const cat = {};
  docs.forEach((d) =>
    Object.entries(d.categoryBreakdown || {}).forEach(([name, v]) => {
      cat[name] = cat[name] || { correct: 0, total: 0 };
      cat[name].correct += v.correct;
      cat[name].total += v.total;
    })
  );
  return {
    attempts: overall?.attempts || 0,
    students: overall?.students.length || 0,
    avgAccuracy: overall ? Math.round(overall.avgAccuracy * 10) / 10 : 0,
    avgScore: overall ? Math.round(overall.avgScore * 10) / 10 : 0,
    avgMaxScore: overall ? Math.round(overall.avgMaxScore * 10) / 10 : 0,
    categoryAccuracy: Object.entries(cat).map(([category, v]) => ({
      category,
      accuracy: v.total ? Math.round((v.correct / v.total) * 1000) / 10 : 0,
      total: v.total,
    })),
  };
}

const countForTest = (test) => TestAttempt.countDocuments({ test });

module.exports = {
  FINISHED,
  create,
  findById,
  findByIdFull,
  listForStudentAndTest,
  listByStudent,
  finalize,
  begin,
  saveAnswers,
  findExpiredInProgress,
  listFinishedForStudent,
  listForTest,
  listForStudentAdmin,
  testSummary,
  countForTest,
};
