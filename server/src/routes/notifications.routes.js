const router = require('express').Router();
const controller = require('../controllers/notificationController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const v = require('../validators/applicationValidators');

router.use(authenticate);
router.get('/', validate(v.notificationList, 'query'), controller.list);
router.post('/read-all', controller.markAllRead);
router.patch('/:id/read', validate(v.idParam, 'params'), controller.markRead);

module.exports = router;
