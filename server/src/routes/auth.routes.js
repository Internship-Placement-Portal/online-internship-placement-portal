const router = require('express').Router();
const controller = require('../controllers/authController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const v = require('../validators/authValidators');

router.post('/register', authLimiter, validate(v.register), controller.register);
router.post('/verify-email', authLimiter, validate(v.verifyEmail), controller.verifyEmail);
router.post('/resend-otp', authLimiter, validate(v.resendOtp), controller.resendOtp);
router.post('/login', authLimiter, validate(v.login), controller.login);
router.post('/refresh', authLimiter, controller.refresh);
router.post('/logout', controller.logout);
router.get('/me', authenticate, controller.me);

module.exports = router;
