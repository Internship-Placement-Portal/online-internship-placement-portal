const auditLogRepository = require('../repositories/auditLogRepository');
const logger = require('../utils/logger');
const { parsePaging, pageResult } = require('../utils/pagination');

// Audit failures must never break the request being audited.
async function record({ actor, action, targetType, targetId, metadata, ip }) {
  try {
    await auditLogRepository.create({ actor, action, targetType, targetId, metadata, ip });
  } catch (err) {
    logger.error('audit log write failed', { action, error: err.message });
  }
}

// IPP-F-024: read access for the admin audit-log viewer (timestamp + actor for every logged action).
async function list(query) {
  const paging = parsePaging(query, { defaultLimit: 25, maxLimit: 100 });
  const { items, total } = await auditLogRepository.list(query, paging);
  return pageResult(
    items.map((l) => ({
      id: String(l._id),
      action: l.action,
      createdAt: l.createdAt,
      actor: l.actor ? { id: String(l.actor._id), name: l.actor.name, email: l.actor.email, role: l.actor.role } : null,
      targetType: l.targetType,
      targetId: l.targetId ? String(l.targetId) : undefined,
      metadata: l.metadata,
      ip: l.ip,
    })),
    total,
    paging
  );
}

const actions = async () => (await auditLogRepository.actions()).sort();

module.exports = { record, list, actions };
