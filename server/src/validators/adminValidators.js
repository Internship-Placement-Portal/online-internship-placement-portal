const Joi = require('joi');

const paging = { page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(50) };

const listRecruiters = Joi.object({ status: Joi.string().valid('pending', 'approved', 'rejected').default('pending'), ...paging });
const listListings = Joi.object({
  status: Joi.string().valid('pending_approval', 'approved', 'rejected').default('pending_approval'),
  ...paging,
});
const decision = Joi.object({
  decision: Joi.string().valid('approved', 'rejected').required(),
  reason: Joi.string().trim().max(500).allow(''),
});

module.exports = { listRecruiters, listListings, decision };
