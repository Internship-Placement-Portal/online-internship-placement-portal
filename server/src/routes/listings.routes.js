const router = require('express').Router();
const controller = require('../controllers/listingController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const v = require('../validators/listingValidators');

router.use(authenticate);

// Static paths first so they are not captured by /:id.
router.get('/domains', controller.domains);
router.get('/mine', authorize('recruiter'), validate(v.mine, 'query'), controller.mine);
router.get('/', authorize('student'), validate(v.search, 'query'), controller.search);
router.post('/', authorize('recruiter'), validate(v.create), controller.create);
router.get('/:id', authorize('student', 'recruiter', 'admin'), validate(v.idParam, 'params'), controller.getOne);
router.patch('/:id', authorize('recruiter'), validate(v.idParam, 'params'), validate(v.update), controller.update);
router.post('/:id/close', authorize('recruiter'), validate(v.idParam, 'params'), controller.close);

module.exports = router;
