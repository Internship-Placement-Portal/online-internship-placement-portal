const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const auditService = require('../services/auditService');

// IPP-F-023 / IPP-SR-006: route-level role check. Must run after `authenticate`.
// Out-of-role access returns 403 and is logged (audit log + application log).
//
// Hardening additions (IPP-F-023):
//  1. Unknown/invalid roles are rejected early with 400 INVALID_ROLE.
//  2. requiredRoles is captured in the audit log for better denial traceability.
//  3. auditService.record is wrapped in try/catch so an audit-DB failure cannot
//     convert a 403 denial into a 500 error.

const KNOWN_ROLES = new Set(['student', 'recruiter', 'admin']);

const authorize = (...roles) => async (req, res, next) => {
  if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));

  // Guard: reject tokens whose role field is not a recognised system role.
  if (!KNOWN_ROLES.has(req.user.role)) {
    return next(new AppError(400, 'INVALID_ROLE', 'Token contains an unrecognised role'));
  }

  if (roles.includes(req.user.role)) {
    if (
      req.user.role === 'recruiter' &&
      req.user.approvalStatus !== 'approved'
    ) {
      return next(
        new AppError(
          403,
          'RECRUITER_NOT_APPROVED',
          'Your recruiter account must be approved by an administrator first'
        )
      );
    }

    return next();
  }

  logger.warn('RBAC violation', {
    userId: String(req.user._id),
    role: req.user.role,
    requiredRoles: roles,
    method: req.method,
    path: req.originalUrl,
  });

  try {
    await auditService.record({
      actor: req.user._id,
      action: 'RBAC_DENIED',
      metadata: {
        method: req.method,
        path: req.originalUrl.split('?')[0],
        role: req.user.role,
        requiredRoles: roles,
      },
      ip: req.ip,
    });
  } catch (auditErr) {
    logger.error('rbac: audit log write failed — denial will still be enforced', { error: auditErr.message });
  }

  next(new AppError(403, 'FORBIDDEN', 'You do not have permission to access this resource'));
};

module.exports = { authorize };
