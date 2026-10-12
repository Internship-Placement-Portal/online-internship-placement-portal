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

    // IPP-F-005: single-use, 30-minute password reset token (only the hash is stored)
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },

    profile: {
      phone: { type: String, trim: true, maxlength: 20 },
      college: { type: String, trim: true, maxlength: 120 },
      branch: { type: String, trim: true, maxlength: 80 },
      graduationYear: { type: Number, min: 2000, max: 2100 },
      skills: { type: [String], default: undefined },
      companyName: { type: String, trim: true, maxlength: 120 },
      companyDescription: { type: String, trim: true, maxlength: 1000 },
      website: { type: String, trim: true, maxlength: 200 },
    },
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
    profile: this.toObject().profile || {},
  };
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
