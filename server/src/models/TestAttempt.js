const mongoose = require('mongoose');

const STATUSES = ['reenabled', 'in_progress', 'submitted', 'auto_submitted'];
const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model });

// One record per attempt (IPP-F-016: an admin override creates a NEW attempt record with status "reenabled").
// Analytics (IPP-F-017) are stored on the attempt itself: accuracy, time per question, category breakdown.
const attemptSchema = new mongoose.Schema(
  {
    student: { ...ref('User'), required: true },
    test: { ...ref('Test'), required: true },
    attemptNo: { type: Number, required: true, default: 1 },
    status: { type: String, enum: STATUSES, required: true },
    questions: [{ question: ref('Question'), order: Number, _id: false }],
    answers: [
      {
        question: ref('Question'),
        selectedIndex: Number,
        codeAnswer: { type: String, maxlength: 5000 },
        timeSpentSec: { type: Number, min: 0 },
        _id: false,
      },
    ],
    startedAt: Date,
    expiresAt: Date,
    submittedAt: Date,
    score: Number,
    maxScore: Number,
    accuracy: Number, // percentage 0-100
    correctCount: Number,
    codingPending: Number, // coding answers awaiting manual review (not auto-scored)
    timePerQuestion: [{ question: ref('Question'), seconds: Number, _id: false }],
    categoryBreakdown: mongoose.Schema.Types.Mixed,
    reenabledBy: ref('User'),
  },
  { timestamps: true }
);

attemptSchema.index({ student: 1, test: 1, attemptNo: 1 }, { unique: true });
attemptSchema.index({ test: 1, status: 1, submittedAt: -1 });
attemptSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('TestAttempt', attemptSchema);
module.exports.STATUSES = STATUSES;
