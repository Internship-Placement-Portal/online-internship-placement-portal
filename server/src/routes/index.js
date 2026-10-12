const router = require('express').Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/listings', require('./listings.routes'));
router.use('/applications', require('./applications.routes'));
router.use('/notifications', require('./notifications.routes'));
const testRoutes = require('./tests.routes');
router.use('/tests', testRoutes.tests);
router.use('/attempts', testRoutes.attempts);
router.use('/admin', require('./admin.routes'));
router.use('/rbac', require('./rbac.routes'));

module.exports = router;
