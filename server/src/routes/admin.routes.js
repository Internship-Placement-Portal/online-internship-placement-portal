const router = require('express').Router();
const controller = require('../controllers/adminController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const v = require('../validators/adminValidators');
const { idParam } = require('../validators/listingValidators');

router.use(authenticate, authorize('admin'));

router.get('/recruiters', validate(v.listRecruiters, 'query'), controller.listRecruiters);
router.patch('/recruiters/:id', validate(idParam, 'params'), validate(v.decision), controller.decideRecruiter);
router.get('/listings', validate(v.listListings, 'query'), controller.listListings);
router.patch('/listings/:id', validate(idParam, 'params'), validate(v.decision), controller.decideListing);

module.exports = router;
