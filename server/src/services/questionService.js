const AppError = require('../utils/AppError');
const { parsePaging, pageResult } = require('../utils/pagination');
const questionRepository = require('../repositories/questionRepository');
const TestAttempt = require('../models/TestAttempt');
const auditService = require('./auditService');

// Admin view includes the answer key; student-facing code never uses this DTO.
const dto = (q) => {
  const o = q.toObject ? q.toObject() : q;
  return {
    id: String(o._id),
    text: o.text,
    type: o.type,
    options: o.options,
    correctIndex: o.correctIndex,
    category: o.category,
    difficulty: o.difficulty,
    marks: o.marks,
    active: o.active,
    createdAt: o.createdAt,
  };
};

// For updates the final shape must still be coherent (MCQ needs options + a valid key; coding must have neither).
function assertCoherent(q) {
  if (q.type === 'mcq') {
    if (!q.options || q.options.length < 2) throw new AppError(400, 'VALIDATION_ERROR', 'MCQ questions need at least two options');
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
      throw new AppError(400, 'VALIDATION_ERROR', 'correctIndex must point at one of the options');
    }
  }
}

async function create(admin, data, ctx = {}) {
  const q = await questionRepository.create({ ...data, createdBy: admin._id });
  await auditService.record({ actor: admin._id, action: 'QUESTION_CREATED', targetType: 'Question', targetId: q._id, metadata: { category: q.category }, ip: ctx.ip });
  return dto(await questionRepository.findByIdWithKey(q._id));
}

async function list(query) {
  const paging = parsePaging(query, { defaultLimit: 15 });
  const { items, total } = await questionRepository.list(query, paging);
  return pageResult(items.map(dto), total, paging);
}

async function load(id) {
  const q = await questionRepository.findByIdWithKey(id);
  if (!q) throw new AppError(404, 'QUESTION_NOT_FOUND', 'Question not found');
  return q;
}

async function update(admin, id, data, ctx = {}) {
  const q = await load(id);
  Object.entries(data).forEach(([k, v]) => {
    q[k] = v;
  });
  if (q.type === 'coding') {
    q.options = undefined;
    q.correctIndex = undefined;
  }
  assertCoherent(q);
  await questionRepository.save(q);
  await auditService.record({ actor: admin._id, action: 'QUESTION_UPDATED', targetType: 'Question', targetId: q._id, ip: ctx.ip });
  return dto(q);
}

// Questions already used in an attempt cannot be hard-deleted (would corrupt history): archive them instead.
async function remove(admin, id, ctx = {}) {
  const q = await load(id);
  const used = await TestAttempt.exists({ 'questions.question': q._id });
  if (used) throw new AppError(409, 'QUESTION_IN_USE', 'This question is part of past attempts. Archive it instead of deleting.');
  await questionRepository.remove(q._id);
  await auditService.record({ actor: admin._id, action: 'QUESTION_DELETED', targetType: 'Question', targetId: q._id, ip: ctx.ip });
  return { status: 'deleted' };
}

const categories = () => questionRepository.categories();

module.exports = { create, list, update, remove, categories };
