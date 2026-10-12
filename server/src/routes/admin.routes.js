const router = require('express').Router();
const controller = require('../controllers/adminController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const v = require('../validators/adminValidators');
const { idParam } = require('../validators/listingValidators');
const testController = require('../controllers/testController');
const tv = require('../validators/testValidators');

router.use(authenticate, authorize('admin'));

router.get('/recruiters', validate(v.listRecruiters, 'query'), controller.listRecruiters);
router.patch('/recruiters/:id', validate(idParam, 'params'), validate(v.decision), controller.decideRecruiter);
router.get('/listings', validate(v.listListings, 'query'), controller.listListings);
router.patch('/listings/:id', validate(idParam, 'params'), validate(v.decision), controller.decideListing);

// Question bank (IPP-F-014)
router.get('/questions', validate(tv.listQuestions, 'query'), testController.qList);
router.get('/questions/categories', testController.qCategories);
router.post('/questions', validate(tv.createQuestion), testController.qCreate);
router.patch('/questions/:id', validate(idParam, 'params'), validate(tv.updateQuestion), testController.qUpdate);
router.delete('/questions/:id', validate(idParam, 'params'), testController.qRemove);

// Tests, per-test / per-student analytics (IPP-F-017) and reattempt override (IPP-F-016)
router.get('/tests', validate(tv.list, 'query'), testController.adminListTests);
router.post('/tests', validate(tv.createTest), testController.adminCreateTest);
router.patch('/tests/:id', validate(idParam, 'params'), validate(tv.updateTest), testController.adminUpdateTest);
router.get('/tests/:id/attempts', validate(idParam, 'params'), validate(tv.list, 'query'), testController.adminTestAttempts);
router.get('/students/:id/attempts', validate(idParam, 'params'), validate(tv.list, 'query'), testController.adminStudentAttempts);
router.post('/attempts/:id/reenable', validate(idParam, 'params'), testController.adminReenable);

module.exports = router;
