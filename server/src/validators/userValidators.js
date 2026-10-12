const Joi = require('joi');

const text = (max) => Joi.string().trim().max(max).allow('');

// IPP-F-008 needs a company profile for recruiters; students keep a small academic profile.
const updateProfile = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  profile: Joi.object({
    phone: Joi.string()
      .trim()
      .pattern(/^[0-9+\-\s()]{7,20}$/)
      .allow('')
      .messages({ 'string.pattern.base': 'phone must be a valid phone number' }),
    college: text(120),
    branch: text(80),
    graduationYear: Joi.number().integer().min(2000).max(2100).allow(null),
    skills: Joi.array().items(Joi.string().trim().min(1).max(40)).max(30),
    companyName: text(120),
    companyDescription: text(1000),
    website: Joi.string().trim().uri({ scheme: ['http', 'https'] }).max(200).allow(''),
  }),
}).min(1);

module.exports = { updateProfile };
