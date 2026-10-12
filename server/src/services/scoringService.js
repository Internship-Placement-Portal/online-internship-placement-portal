const AppError = require('../utils/AppError');
const questionRepository = require('../repositories/questionRepository');

// IPP-F-015 / IPP-F-017 scoring service layer.
//
// Contract (mirrors POST /internal/analytics/score-test in the SAD):
//   scoreAttempt({ attemptId, studentId, testId, answers: [{ questionId, selectedIndex?, codeAnswer?, timeSpentSec? }] })
//     -> { score, maxScore, accuracy, correctCount, codingPending, timePerQuestion[], categoryBreakdown, perQuestion[] }
//   `answers` lists EVERY question of the attempt (unanswered ones carry no selection).
//
// Scoring runs inside Node today. A Flask-backed implementation only has to expose the same function and be
// installed with setScorer(); controllers and testService never change. Errors: 422 for unknown question ids.
const round1 = (n) => Math.round(n * 10) / 10;

async function nodeScorer({ answers }) {
  const ids = answers.map((a) => a.questionId);
  const questions = await questionRepository.findByIdsWithKey(ids);
  const byId = new Map(questions.map((q) => [String(q._id), q]));
  if (ids.some((id) => !byId.has(String(id)))) throw new AppError(422, 'UNKNOWN_QUESTION', 'Answers reference an unknown question');

  let score = 0;
  let maxScore = 0;
  let correctCount = 0;
  let mcqCount = 0;
  let codingPending = 0;
  const timePerQuestion = [];
  const categoryBreakdown = {};
  const perQuestion = [];

  for (const a of answers) {
    const q = byId.get(String(a.questionId));
    timePerQuestion.push({ question: q._id, seconds: a.timeSpentSec || 0 });
    categoryBreakdown[q.category] = categoryBreakdown[q.category] || { correct: 0, total: 0, accuracy: 0 };

    if (q.type === 'mcq') {
      mcqCount += 1;
      maxScore += q.marks;
      const answered = Number.isInteger(a.selectedIndex);
      const correct = answered && a.selectedIndex === q.correctIndex;
      if (correct) {
        score += q.marks;
        correctCount += 1;
      }
      categoryBreakdown[q.category].total += 1;
      if (correct) categoryBreakdown[q.category].correct += 1;
      perQuestion.push({ questionId: String(q._id), correct, answered, selectedIndex: answered ? a.selectedIndex : null, correctIndex: q.correctIndex });
    } else {
      // Coding answers are recorded but not auto-evaluated (SRS 4.4 only requires MCQ auto-scoring).
      if (a.codeAnswer && a.codeAnswer.trim()) codingPending += 1;
      perQuestion.push({ questionId: String(q._id), correct: null, answered: Boolean(a.codeAnswer && a.codeAnswer.trim()), selectedIndex: null, correctIndex: null });
    }
  }
  Object.values(categoryBreakdown).forEach((c) => {
    c.accuracy = c.total ? round1((c.correct / c.total) * 100) : 0;
  });

  return {
    score,
    maxScore,
    accuracy: mcqCount ? round1((correctCount / mcqCount) * 100) : 0,
    correctCount,
    codingPending,
    timePerQuestion,
    categoryBreakdown,
    perQuestion,
  };
}

let scorer = nodeScorer;
const scoreAttempt = (payload) => scorer(payload);
// Swap point: install e.g. an HTTP client for a Python/Flask scorer that honours the same contract.
const setScorer = (fn) => {
  scorer = fn || nodeScorer;
};

module.exports = { scoreAttempt, setScorer, nodeScorer };
