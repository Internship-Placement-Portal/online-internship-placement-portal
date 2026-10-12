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

const findByResetHash = (hash) =>
  User.findOne({ passwordResetTokenHash: hash }).select('+passwordResetTokenHash +passwordResetExpiresAt');

async function listByRole(role, { approvalStatus }, { skip, limit }) {
  const filter = { role, emailVerified: true, ...(approvalStatus && { approvalStatus }) };
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return { items, total };
}

module.exports = {
  findByEmail,
  findByEmailWithOtp,
  findById,
  findByIdWithOtp,
  findByResetHash,
  listByRole,
  create,
  updateById,
  incrementFailedLogins,
};
