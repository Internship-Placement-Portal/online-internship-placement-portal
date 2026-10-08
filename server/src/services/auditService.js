const auditLogRepository = require('../repositories/auditLogRepository');
const logger = require('../utils/logger');

// Audit failures must never break the request being audited.
async function record({ actor, action, targetType, targetId, metadata, ip }) {
  try {
    await auditLogRepository.create({ actor, action, targetType, targetId, metadata, ip });
  } catch (err) {
    logger.error('audit log write failed', { action, error: err.message });
  }
}

module.exports = { record };
