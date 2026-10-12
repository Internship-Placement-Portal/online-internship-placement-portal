const Joi = require('joi');
const { TYPES, DIFFICULTIES } = require('../models/Question');

const id = Joi.string().hex().length(24);
const paging = { page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(50) };
const idParam = Joi.object({ id: id.required() });

// ── Question bank ──────────────────────────────────────────────
const questionFields = {
  text: Joi.string().trim().min(5).max(2000),
  type: Joi.string().valid(...TYPES),
  options: Joi.array().items(Joi.string().trim().min(1).max(300)).min(2).max(6),
  correctIndex: Joi.number().integer().min(0).max(5),
  category: Joi.string().trim().min(2).max(60),
  difficulty: Joi.string().valid(...DIFFICULTIES),
  marks: Joi.number().integer().min(1).max(10),
  active: Joi.boolean(),
};

const createQuestion = Joi.object({
  ...questionFields,
  text: questionFields.text.required(),
  type: questionFields.type.required(),
  category: questionFields.category.required(),
  // MCQ needs options and an in-range key; coding questions carry neither.
  options: questionFields.options.when('type', { is: 'mcq', then: Joi.required(), otherwise: Joi.forbidden() }),
  correctIndex: questionFields.correctIndex.when('type', { is: 'mcq', then: Joi.required(), otherwise: Joi.forbidden() }),
}).custom((q, helpers) => {
  if (q.type === 'mcq' && q.correctIndex >= q.options.length) return helpers.message('correctIndex must point at one of the options');
  if (q.type === 'mcq' && new Set(q.options.map((o) => o.toLowerCase())).size !== q.options.length) return helpers.message('options must be distinct');
  return q;
});

const updateQuestion = Joi.object({ ...questionFields, type: Joi.forbidden() }).min(1); // type cannot change after creation

const listQuestions = Joi.object({
  q: Joi.string().trim().max(100),
  category: Joi.string().trim().max(60),
  type: Joi.string().valid(...TYPES),
  difficulty: Joi.string().valid(...DIFFICULTIES),
  active: Joi.boolean(),
  ...paging,
});

// ── Tests ──────────────────────────────────────────────────────
const testFields = {
  title: Joi.string().trim().min(3).max(120),
  description: Joi.string().trim().max(500).allow(''),
  durationMinutes: Joi.number().integer().min(1).max(180),
  questionCount: Joi.number().integer().min(1).max(100),
  categories: Joi.array().items(Joi.string().trim().min(2).max(60)).max(20),
  isActive: Joi.boolean(),
};
const createTest = Joi.object({
  ...testFields,
  title: testFields.title.required(),
  durationMinutes: testFields.durationMinutes.required(),
  questionCount: testFields.questionCount.required(),
});
const updateTest = Joi.object(testFields).min(1);
const list = Joi.object({ ...paging });

// ── Attempts ───────────────────────────────────────────────────
const answer = Joi.object({
  questionId: id.required(),
  selectedIndex: Joi.number().integer().min(0).max(5).allow(null),
  codeAnswer: Joi.string().max(5000).allow(''),
  timeSpentSec: Joi.number().min(0).max(86400),
});
const saveAnswers = Joi.object({ answers: Joi.array().items(answer).max(100).required() });
const submit = Joi.object({ answers: Joi.array().items(answer).max(100) });

module.exports = { idParam, createQuestion, updateQuestion, listQuestions, createTest, updateTest, list, saveAnswers, submit };
