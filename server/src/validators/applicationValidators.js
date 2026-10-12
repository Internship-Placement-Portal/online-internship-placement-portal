const Joi = require('joi');
const { STATUSES, MODES } = require('../models/Application');

const id = Joi.string().hex().length(24);
const paging = { page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(50) };

const apply = Joi.object({ listingId: id.required() });
const idParam = Joi.object({ id: id.required() });
const list = Joi.object({ ...paging });
const listForListing = Joi.object({ status: Joi.string().valid(...STATUSES), ...paging });
const updateStatus = Joi.object({ status: Joi.string().valid(...STATUSES).required() });

const interview = Joi.object({
  date: Joi.date().iso().greater('now').required().messages({ 'date.greater': 'interview date must be in the future' }),
  mode: Joi.string().valid(...MODES).required(),
  link: Joi.string()
    .trim()
    .uri({ scheme: ['http', 'https'] })
    .max(300)
    .when('mode', { is: 'online', then: Joi.required(), otherwise: Joi.allow('') })
    .messages({ 'any.required': 'a meeting link is required for online interviews' }),
  notes: Joi.string().trim().max(500).allow(''),
});

const notificationList = Joi.object({ unread: Joi.boolean(), ...paging });

module.exports = { apply, idParam, list, listForListing, updateStatus, interview, notificationList };
