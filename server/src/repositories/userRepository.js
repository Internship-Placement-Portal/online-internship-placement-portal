const User = require('../models/User');

const findByEmail = (email, { withPassword = false } = {}) => {
  const q = User.findOne({ email: email.toLowerCase() });
  return withPassword ? q.select('+passwordHash') : q;
};
const findByEmailWithOtp = (email) => User.findOne({ email: email.toLowerCase() }).select('+otpHash +otpExpiresAt +otpAttempts');
const findById = (id) => User.findById(id);
const findByIdWithOtp = (id) => User.findById(id).select('+otpHash +otpExpiresAt +otpAttempts');
const create = (data) => User.create(data);
const updateById = (id, update) => User.updateOne({ _id: id }, update);

// Atomic increment so concurrent failed logins cannot dodge the lockout counter.
const incrementFailedLogins = (id) =>
  User.findByIdAndUpdate(id, { $inc: { failedLoginAttempts: 1 } }, { returnDocument: 'after' });

module.exports = { findByEmail, findByEmailWithOtp, findById, findByIdWithOtp, create, updateById, incrementFailedLogins };
