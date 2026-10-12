const { describe, it, before, after, beforeEach } = require('node:test');
const request = require('supertest');
const expect = require('./expect');
const app = require('../src/app');
const Question = require('../src/models/Question');
const Test = require('../src/models/Test');
const AuditLog = require('../src/models/AuditLog');
const { startDb, stopDb, clearDb, createUser } = require('./helpers');

before(startDb);
after(stopDb);
beforeEach(clearDb);

const mcq = (over = {}) => ({ text: 'What is 12 x 12?', type: 'mcq', options: ['124', '144', '154'], correctIndex: 1, category: 'Quant', difficulty: 'easy', marks: 1, ...over });

describe('admin question bank (IPP-F-014)', () => {
  it('creates, lists, updates and deletes questions with audit entries', async () => {
    const admin = await createUser({ role: 'admin' });
    const created = await request(app).post('/api/admin/questions').set(admin.auth).send(mcq());
    expect(created.status).toBe(201);
    expect(created.body.question.correctIndex).toBe(1);
    const id = created.body.question.id;

    const list = await request(app).get('/api/admin/questions?category=Quant').set(admin.auth);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].correctIndex).toBe(1);

    const upd = await request(app).patch(`/api/admin/questions/${id}`).set(admin.auth).send({ options: ['1', '2', '3', '4'], correctIndex: 3, marks: 2 });
    expect(upd.body.question.correctIndex).toBe(3);
    expect(upd.body.question.marks).toBe(2);

    expect((await request(app).delete(`/api/admin/questions/${id}`).set(admin.auth)).status).toBe(200);
    expect(await Question.countDocuments()).toBe(0);
    for (const action of ['QUESTION_CREATED', 'QUESTION_UPDATED', 'QUESTION_DELETED']) expect(await AuditLog.countDocuments({ action })).toBe(1);
  });

  it('validates MCQ shape: options, key range, distinct options; coding questions carry no options', async () => {
    const admin = await createUser({ role: 'admin' });
    const post = (b) => request(app).post('/api/admin/questions').set(admin.auth).send(b);
    expect((await post(mcq({ options: ['only one'] }))).status).toBe(400);
    expect((await post(mcq({ correctIndex: 7 }))).status).toBe(400);
    expect((await post(mcq({ correctIndex: 2, options: ['a', 'b'] }))).status).toBe(400);
    expect((await post(mcq({ options: ['same', 'same'], correctIndex: 0 }))).status).toBe(400);
    expect((await post({ text: 'Write a function', type: 'coding', category: 'Coding', options: ['x', 'y'] })).status).toBe(400);
    expect((await post({ text: 'Write a function', type: 'coding', category: 'Coding' })).status).toBe(201);
    expect((await post({ text: 'x', type: 'mcq', category: 'Q' })).status).toBe(400);
  });

  it('keeps code characters in question text intact', async () => {
    const admin = await createUser({ role: 'admin' });
    const text = 'What does `a < b && c > d` return for List<int>?';
    const res = await request(app).post('/api/admin/questions').set(admin.auth).send(mcq({ text, options: ['true', 'false'], correctIndex: 0 }));
    expect(res.body.question.text).toBe(text);
  });

  it('cannot change the type, and questions used by attempts are archived not deleted', async () => {
    const admin = await createUser({ role: 'admin' });
    const student = await createUser({ role: 'student' });
    const { body } = await request(app).post('/api/admin/questions').set(admin.auth).send(mcq());
    const id = body.question.id;
    expect((await request(app).patch(`/api/admin/questions/${id}`).set(admin.auth).send({ type: 'coding' })).status).toBe(400);

    const test = await Test.create({ title: 'T', durationMinutes: 5, questionCount: 1 });
    await request(app).post(`/api/tests/${test._id}/start`).set(student.auth);
    const del = await request(app).delete(`/api/admin/questions/${id}`).set(admin.auth);
    expect(del.status).toBe(409);
    expect(del.body.code).toBe('QUESTION_IN_USE');
    const arch = await request(app).patch(`/api/admin/questions/${id}`).set(admin.auth).send({ active: false });
    expect(arch.body.question.active).toBe(false);
  });

  it('filters by type, difficulty and search text, paginates and lists categories', async () => {
    const admin = await createUser({ role: 'admin' });
    await Question.create([
      { ...mcq({ text: 'Alpha question one' }) },
      { ...mcq({ text: 'Beta question two', difficulty: 'hard', category: 'Logic' }) },
      { text: 'Gamma coding task', type: 'coding', category: 'Coding' },
    ]);
    const get = (qs) => request(app).get(`/api/admin/questions${qs}`).set(admin.auth);
    expect((await get('?type=coding')).body.total).toBe(1);
    expect((await get('?difficulty=hard')).body.total).toBe(1);
    expect((await get('?q=alpha')).body.total).toBe(1);
    expect((await get('?limit=2&page=2')).body.items).toHaveLength(1);
    expect((await get('/categories')).body.categories.sort()).toEqual(['Coding', 'Logic', 'Quant']);
  });

  it('manages tests: create, update, list, with validation', async () => {
    const admin = await createUser({ role: 'admin' });
    const post = (b) => request(app).post('/api/admin/tests').set(admin.auth).send(b);
    expect((await post({ title: 'ab', durationMinutes: 30, questionCount: 5 })).status).toBe(400);
    expect((await post({ title: 'Quant basics', durationMinutes: 0, questionCount: 5 })).status).toBe(400);
    const ok = await post({ title: 'Quant basics', durationMinutes: 30, questionCount: 5, categories: ['Quant'] });
    expect(ok.status).toBe(201);
    const upd = await request(app).patch(`/api/admin/tests/${ok.body.test.id}`).set(admin.auth).send({ durationMinutes: 45, isActive: false });
    expect(upd.body.test.durationMinutes).toBe(45);
    expect(upd.body.test.isActive).toBe(false);
    expect((await request(app).get('/api/admin/tests').set(admin.auth)).body.total).toBe(1);
  });

  it('is admin only', async () => {
    const student = await createUser({ role: 'student' });
    const recruiter = await createUser({ role: 'recruiter' });
    for (const who of [student, recruiter]) {
      expect((await request(app).get('/api/admin/questions').set(who.auth)).status).toBe(403);
      expect((await request(app).post('/api/admin/questions').set(who.auth).send(mcq())).status).toBe(403);
      expect((await request(app).post('/api/admin/tests').set(who.auth).send({ title: 'abc', durationMinutes: 5, questionCount: 1 })).status).toBe(403);
    }
    expect((await request(app).get('/api/admin/questions')).status).toBe(401);
  });

  it('students never see the answer key in any student endpoint', async () => {
    const student = await createUser({ role: 'student' });
    await Question.create(mcq());
    const test = await Test.create({ title: 'T', durationMinutes: 5, questionCount: 1 });
    const started = await request(app).post(`/api/tests/${test._id}/start`).set(student.auth);
    const got = await request(app).get(`/api/attempts/${started.body.attempt.id}`).set(student.auth);
    for (const res of [started, got, await request(app).get('/api/tests').set(student.auth)]) {
      expect(JSON.stringify(res.body)).not.toContain('correctIndex');
    }
  });
});
