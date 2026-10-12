const Joi = require('joi');

const date = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).messages({ 'string.pattern.base': 'dates must be in YYYY-MM-DD format' });

const placement = Joi.object({ from: date, to: date, company: Joi.string().trim().max(120).allow('') });
const exportQuery = placement.keys({ format: Joi.string().valid('csv', 'pdf').required() });

const auditLogs = Joi.object({
  action: Joi.string().trim().max(60),
  actor: Joi.string().hex().length(24),
  from: date,
  to: date,
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
});

module.exports = { placement, exportQuery, auditLogs };
