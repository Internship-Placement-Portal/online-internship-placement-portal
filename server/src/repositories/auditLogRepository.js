const AuditLog = require('../models/AuditLog');

const create = (data) => AuditLog.create(data);
const find = (filter = {}, limit = 100) => AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit);

async function list({ action, actor, from, to }, { skip, limit }) {
  const filter = {};
  if (action) filter.action = action;
  if (actor) filter.actor = actor;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(`${from}T00:00:00.000Z`);
    if (to) filter.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
  }
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor', 'name email role').lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, total };
}

const actions = () => AuditLog.distinct('action');

module.exports = { create, find, list, actions };
