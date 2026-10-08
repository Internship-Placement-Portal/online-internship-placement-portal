const Joi = require('joi');

// bcrypt only uses the first 72 bytes, so cap there.
const password = Joi.string()
  .min(8)
  .max(72)
  .pattern(/[A-Za-z]/, 'letter')
  .pattern(/\d/, 'digit')
  .messages({ 'string.pattern.name': 'password must contain at least one letter and one digit' });
const email = Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(254);

const register = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: email.required(),
  password: password.required(),
  role: Joi.string().valid('student', 'recruiter').required(), // SAD 4.3: admin accounts are never self-registered
});
const login = Joi.object({ email: email.required(), password: Joi.string().max(72).required() });
const verifyEmail = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  otp: Joi.string()
    .pattern(/^\d{6}$/)
    .required(),
});
const resendOtp = Joi.object({ email: email.required() });

module.exports = { register, login, verifyEmail, resendOtp };
