const mongoose = require('mongoose');

const STATUSES = ['Applied', 'Shortlisted', 'Rejected', 'Selected'];
const MODES = ['online', 'in-person'];

// IPP-F-010: links a student, a listing and the uploaded resume. One application per student per listing.
const applicationSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // denormalised for ownership checks
    resumeKey: { type: String, required: true, select: false },
    resumeOriginalName: { type: String, required: true },
    resumeSize: Number,
    status: { type: String, enum: STATUSES, default: 'Applied' },
    statusHistory: [{ status: String, at: { type: Date, default: Date.now }, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, _id: false }],
    // IPP-F-013
    interview: {
      date: Date,
      mode: { type: String, enum: MODES },
      link: { type: String, trim: true, maxlength: 300 },
      notes: { type: String, trim: true, maxlength: 500 },
    },
  },
  { timestamps: true }
);

applicationSchema.index({ student: 1, listing: 1 }, { unique: true }); // duplicate applications are blocked at the database level
applicationSchema.index({ listing: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Application', applicationSchema);
module.exports.STATUSES = STATUSES;
module.exports.MODES = MODES;
