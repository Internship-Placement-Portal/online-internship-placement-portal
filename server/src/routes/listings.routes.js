const router = require('express').Router();
const controller = require('../controllers/listingController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const applicationController = require('../controllers/applicationController');
const v = require('../validators/listingValidators');
const av = require('../validators/applicationValidators');

router.use(authenticate);

// Static paths first so they are not captured by /:id.
router.get('/domains', controller.domains);
router.get('/mine', authorize('recruiter'), validate(v.mine, 'query'), controller.mine);
router.get('/', authorize('student'), validate(v.search, 'query'), controller.search);
router.post('/', authorize('recruiter'), validate(v.create), controller.create);
router.get('/:id', authorize('student', 'recruiter', 'admin'), validate(v.idParam, 'params'), controller.getOne);
router.get('/:id/applications', authorize('recruiter'), validate(v.idParam, 'params'), validate(av.listForListing, 'query'), applicationController.forListing);
router.patch('/:id', authorize('recruiter'), validate(v.idParam, 'params'), validate(v.update), controller.update);
router.post('/:id/close', authorize('recruiter'), validate(v.idParam, 'params'), controller.close);

module.exports = router;
