const router = require('express').Router();
const controller = require('../controllers/dashboardController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const v = require('../validators/dashboardValidators');

router.use(authenticate);
router.get('/student', authorize('student'), controller.student);
router.get('/placement', authorize('admin'), validate(v.placement, 'query'), controller.placement);
router.get('/placement/export', authorize('admin'), validate(v.exportQuery, 'query'), controller.exportPlacement);

module.exports = router;
