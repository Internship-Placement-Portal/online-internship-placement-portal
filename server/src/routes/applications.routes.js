const router = require('express').Router();
const controller = require('../controllers/applicationController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { uploadLimiter } = require('../middleware/rateLimit');
const { uploadResume } = require('../middleware/upload');
const v = require('../validators/applicationValidators');

// Apply + upload: rate limited (IPP-SR-004), student only, file validated/scanned in the service (IPP-SR-005).
router.post('/', uploadLimiter, authenticate, authorize('student'), uploadResume, validate(v.apply), controller.apply);

router.use(authenticate);
router.get('/mine', authorize('student'), validate(v.list, 'query'), controller.mine);
router.get('/:id', authorize('student', 'recruiter'), validate(v.idParam, 'params'), controller.getOne);
router.get('/:id/resume', authorize('student', 'recruiter'), validate(v.idParam, 'params'), controller.resume);
router.patch('/:id/status', authorize('recruiter'), validate(v.idParam, 'params'), validate(v.updateStatus), controller.updateStatus);
router.put('/:id/interview', authorize('recruiter'), validate(v.idParam, 'params'), validate(v.interview), controller.scheduleInterview);

module.exports = router;
