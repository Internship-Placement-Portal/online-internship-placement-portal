const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Role-gated probe endpoints used to verify RBAC (IPP-F-023 / IPP-SR-006) before real modules exist.
router.use(authenticate);
router.get('/student', authorize('student'), (req, res) => res.json({ ok: true, role: req.user.role }));
router.get('/recruiter', authorize('recruiter'), (req, res) => res.json({ ok: true, role: req.user.role }));
router.get('/admin', authorize('admin'), (req, res) => res.json({ ok: true, role: req.user.role }));

module.exports = router;
