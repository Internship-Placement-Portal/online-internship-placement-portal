const mongoose = require('mongoose');

const ROLES = ['student', 'recruiter', 'admin'];
const APPROVAL = ['pending', 'approved', 'rejected'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    isActive: { type: Boolean, default: true },

    // IPP-F-001: email OTP verification
    emailVerified: { type: Boolean, default: false },
    otpHash: { type: String, select: false },
    otpExpiresAt: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0, select: false },

    // IPP-F-022: recruiters need admin approval before posting
    approvalStatus: { type: String, enum: APPROVAL, default: 'approved' },

    // IPP-F-004: account lockout
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: String(this._id),
    name: this.name,
    email: this.email,
    role: this.role,
    emailVerified: this.emailVerified,
    approvalStatus: this.approvalStatus,
  };
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
