const router = require('express').Router();
const controller = require('../controllers/testController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const v = require('../validators/testValidators');

// Student-facing test + attempt endpoints (mounted at /api/tests and /api/attempts).
const tests = router;
tests.use(authenticate, authorize('student'));
tests.get('/', controller.list);
tests.post('/:id/start', validate(v.idParam, 'params'), controller.start);

const attempts = require('express').Router();
attempts.use(authenticate, authorize('student'));
attempts.get('/mine', validate(v.list, 'query'), controller.mine);
attempts.get('/:id', validate(v.idParam, 'params'), controller.getAttempt);
attempts.put('/:id/answers', validate(v.idParam, 'params'), validate(v.saveAnswers), controller.saveAnswers);
attempts.post('/:id/submit', validate(v.idParam, 'params'), validate(v.submit), controller.submit);
attempts.get('/:id/result', validate(v.idParam, 'params'), controller.result);

module.exports = { tests, attempts };
