const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const auditService = require('../services/auditService');

// IPP-F-023 / IPP-SR-006: route-level role check. Must run after `authenticate`.
// Out-of-role access returns 403 and is logged (audit log + application log).
const authorize = (...roles) => async (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
  if (roles.includes(req.user.role)) return next();

  logger.warn('RBAC violation', {
    userId: String(req.user._id),
    role: req.user.role,
    method: req.method,
    path: req.originalUrl,
  });
  await auditService.record({
    actor: req.user._id,
    action: 'RBAC_DENIED',
    metadata: { method: req.method, path: req.originalUrl.split('?')[0], role: req.user.role },
    ip: req.ip,
  });
  next(new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource'));
};

module.exports = { authorize };
