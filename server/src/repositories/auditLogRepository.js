const AuditLog = require('../models/AuditLog');

const create = (data) => AuditLog.create(data);
const find = (filter = {}, limit = 100) => AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit);

module.exports = { create, find };
