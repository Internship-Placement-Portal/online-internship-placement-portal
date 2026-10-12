const mongoose = require('mongoose');

const STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'closed'];
const DOMAINS = [
  'Software Development',
  'Web Development',
  'Mobile Development',
  'Data Science',
  'AI / Machine Learning',
  'Cloud & DevOps',
  'Cybersecurity',
  'UI / UX Design',
  'Core Engineering',
  'Business & Marketing',
  'Finance',
  'Other',
];

// IPP-F-006: internship listing owned by a recruiter; visible to students only once approved (and before the deadline).
const listingSchema = new mongoose.Schema(
  {
    recruiter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    company: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    domain: { type: String, enum: DOMAINS, required: true },
    location: { type: String, required: true, trim: true, maxlength: 100 },
    stipend: { type: Number, required: true, min: 0 },
    duration: { type: Number, required: true, min: 1, max: 24 }, // months
    skills: { type: [String], default: [] },
    eligibility: { type: String, trim: true, maxlength: 1000, default: '' },
    deadline: { type: Date, required: true },
    status: { type: String, enum: STATUSES, default: 'draft' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    rejectionReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

// IPP-F-007: text search + compound filter index keep search well under the 2 s target (NF-001).
listingSchema.index({ title: 'text', description: 'text', skills: 'text', company: 'text' });
listingSchema.index({ status: 1, deadline: 1, domain: 1, location: 1, stipend: 1, duration: 1 });

module.exports = mongoose.model('Listing', listingSchema);
module.exports.STATUSES = STATUSES;
module.exports.DOMAINS = DOMAINS;
