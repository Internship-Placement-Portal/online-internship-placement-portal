const router = require('express').Router();
const controller = require('../controllers/userController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const v = require('../validators/userValidators');

router.use(authenticate);
router.get('/me', controller.getMe);
router.patch('/me', validate(v.updateProfile), controller.updateMe);

module.exports = router;
