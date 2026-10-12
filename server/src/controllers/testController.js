const asyncHandler = require('../utils/asyncHandler');
const testService = require('../services/testService');
const questionService = require('../services/questionService');

const ctxOf = (req) => ({ ip: req.ip });

// Student
const list = asyncHandler(async (req, res) => res.json({ tests: await testService.listForStudent(req.user) }));
const start = asyncHandler(async (req, res) => res.status(201).json({ attempt: await testService.start(req.user, req.params.id) }));
const getAttempt = asyncHandler(async (req, res) => res.json({ attempt: await testService.getAttempt(req.user, req.params.id) }));
const saveAnswers = asyncHandler(async (req, res) => res.json(await testService.saveAnswers(req.user, req.params.id, req.body)));
const submit = asyncHandler(async (req, res) => res.json({ result: await testService.submit(req.user, req.params.id, req.body) }));
const result = asyncHandler(async (req, res) => res.json({ result: await testService.result(req.user, req.params.id) }));
const mine = asyncHandler(async (req, res) => res.json(await testService.listMine(req.user, req.query)));

// Admin: tests
const adminListTests = asyncHandler(async (req, res) => res.json(await testService.listTests(req.query)));
const adminCreateTest = asyncHandler(async (req, res) => res.status(201).json({ test: await testService.createTest(req.user, req.body, ctxOf(req)) }));
const adminUpdateTest = asyncHandler(async (req, res) => res.json({ test: await testService.updateTest(req.user, req.params.id, req.body, ctxOf(req)) }));
const adminTestAttempts = asyncHandler(async (req, res) => res.json(await testService.attemptsForTest(req.params.id, req.query)));
const adminStudentAttempts = asyncHandler(async (req, res) => res.json(await testService.attemptsForStudent(req.params.id, req.query)));
const adminReenable = asyncHandler(async (req, res) => res.status(201).json({ attempt: await testService.reenable(req.user, req.params.id, ctxOf(req)) }));

// Admin: question bank
const qList = asyncHandler(async (req, res) => res.json(await questionService.list(req.query)));
const qCategories = asyncHandler(async (req, res) => res.json({ categories: await questionService.categories() }));
const qCreate = asyncHandler(async (req, res) => res.status(201).json({ question: await questionService.create(req.user, req.body, ctxOf(req)) }));
const qUpdate = asyncHandler(async (req, res) => res.json({ question: await questionService.update(req.user, req.params.id, req.body, ctxOf(req)) }));
const qRemove = asyncHandler(async (req, res) => res.json(await questionService.remove(req.user, req.params.id, ctxOf(req))));

module.exports = {
  list, start, getAttempt, saveAnswers, submit, result, mine,
  adminListTests, adminCreateTest, adminUpdateTest, adminTestAttempts, adminStudentAttempts, adminReenable,
  qList, qCategories, qCreate, qUpdate, qRemove,
};
