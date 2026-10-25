const Joi = require('joi');
const { DOMAINS } = require('../models/Listing');

// Deadlines are entered as YYYY-MM-DD and stored as the end of that day (UTC), so a listing stays open all day.

const deadline = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    const d = new Date(`${value}T23:59:59.999Z`);
    // Reject impossible calendar dates, such as 2026-02-31.
    if (
      Number.isNaN(d.getTime()) ||
      d.toISOString().slice(0, 10) !== value
    ) {
      return helpers.error('date.base');
    }
    if (d < new Date()) return helpers.error('deadline.past');
    return d;
  })
  .messages({
    'string.pattern.base': 'deadline must be a date in YYYY-MM-DD format',
    'date.base': 'deadline must be a valid date',
    'deadline.past': 'deadline cannot be in the past',
  });


const fields = {
  title: Joi.string().trim().min(3).max(120),
  company: Joi.string().trim().min(2).max(120),
  description: Joi.string().trim().min(20).max(5000),
  domain: Joi.string().valid(...DOMAINS),
  location: Joi.string().trim().min(2).max(100),
  stipend: Joi.number().min(0).max(1000000),
  duration: Joi.number().integer().min(1).max(24),
  skills: Joi.array().items(Joi.string().trim().min(1).max(40)).max(20),
  eligibility: Joi.string().trim().max(1000).allow(''),
  deadline,
};

const REQUIRED = ['title', 'description', 'domain', 'location', 'stipend', 'duration', 'deadline'];

const create = Joi.object({
  ...fields,
  ...Object.fromEntries(REQUIRED.map((k) => [k, fields[k].required()])),
  skills: fields.skills.default([]),
  publish: Joi.boolean().default(false), // true = submit for admin approval, false = save as draft
});

const update = Joi.object({ ...fields, publish: Joi.boolean() }).min(1);

const num = Joi.number().min(0);

const search = Joi.object({
  q: Joi.string().trim().max(100),
  domain: Joi.string().valid(...DOMAINS),
  location: Joi.string().trim().max(100),
  minStipend: num,
  maxStipend: num,
  minDuration: num,
  maxDuration: num,
  sort: Joi.string().valid('relevance', 'newest', 'stipend_desc', 'deadline_asc'),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(50),
}).custom((value, helpers) => {
  if (
    value.minStipend !== undefined &&
    value.maxStipend !== undefined &&
    value.minStipend > value.maxStipend
  ) {
    return helpers.error('any.invalid');
  }

  if (
    value.minDuration !== undefined &&
    value.maxDuration !== undefined &&
    value.minDuration > value.maxDuration
  ) {
    return helpers.error('any.invalid');
  }

  return value;
}).messages({
  'any.invalid': 'Minimum filter values cannot exceed maximum filter values',
});


const mine = Joi.object({
  status: Joi.string().valid('draft', 'pending_approval', 'approved', 'rejected', 'closed'),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(50),
});

const idParam = Joi.object({ id: Joi.string().hex().length(24).required() });

module.exports = { create, update, search, mine, idParam };
