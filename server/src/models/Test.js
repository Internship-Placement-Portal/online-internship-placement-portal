const mongoose = require('mongoose');

// A configurable test: how long, how many questions, and which categories to draw from.
const testSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    durationMinutes: { type: Number, required: true, min: 1, max: 180 },
    questionCount: { type: Number, required: true, min: 1, max: 100 },
    categories: { type: [String], default: [] }, // empty = whole bank
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Test', testSchema);
