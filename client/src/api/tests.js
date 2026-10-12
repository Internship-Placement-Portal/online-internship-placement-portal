import { http } from './http.js';

const clean = (params) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));

// Student
export const listTestsApi = () => http.get('/tests').then((r) => r.data.tests);
export const startTestApi = (testId) => http.post(`/tests/${testId}/start`).then((r) => r.data.attempt);
export const getAttemptApi = (id) => http.get(`/attempts/${id}`).then((r) => r.data.attempt);
export const saveAnswersApi = (id, answers) => http.put(`/attempts/${id}/answers`, { answers }).then((r) => r.data);
export const submitAttemptApi = (id, answers) => http.post(`/attempts/${id}/submit`, answers ? { answers } : {}).then((r) => r.data.result);
export const attemptResultApi = (id) => http.get(`/attempts/${id}/result`).then((r) => r.data.result);
export const myAttemptsApi = (params = {}) => http.get('/attempts/mine', { params: clean(params) }).then((r) => r.data);

// Admin: question bank
export const listQuestionsApi = (params) => http.get('/admin/questions', { params: clean(params) }).then((r) => r.data);
export const questionCategoriesApi = () => http.get('/admin/questions/categories').then((r) => r.data.categories);
export const createQuestionApi = (body) => http.post('/admin/questions', body).then((r) => r.data.question);
export const updateQuestionApi = (id, body) => http.patch(`/admin/questions/${id}`, body).then((r) => r.data.question);
export const deleteQuestionApi = (id) => http.delete(`/admin/questions/${id}`).then((r) => r.data);

// Admin: tests, analytics, override
export const adminListTestsApi = (params = {}) => http.get('/admin/tests', { params: clean(params) }).then((r) => r.data);
export const adminCreateTestApi = (body) => http.post('/admin/tests', body).then((r) => r.data.test);
export const adminUpdateTestApi = (id, body) => http.patch(`/admin/tests/${id}`, body).then((r) => r.data.test);
export const adminTestAttemptsApi = (id, params = {}) => http.get(`/admin/tests/${id}/attempts`, { params: clean(params) }).then((r) => r.data);
export const reenableAttemptApi = (id) => http.post(`/admin/attempts/${id}/reenable`).then((r) => r.data.attempt);
