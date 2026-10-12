const mongoose = require('mongoose');

const TYPES = ['mcq', 'coding'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

// IPP-F-014: configurable question bank. The answer key is never loaded by default (select:false),
// so student-facing queries cannot leak it.
const questionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    type: { type: String, enum: TYPES, required: true },
    options: { type: [String], default: undefined }, // MCQ only
    correctIndex: { type: Number, select: false }, // MCQ only
    category: { type: String, required: true, trim: true, maxlength: 60, index: true },
    difficulty: { type: String, enum: DIFFICULTIES, default: 'medium' },
    marks: { type: Number, min: 1, max: 10, default: 1 },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

questionSchema.index({ active: 1, category: 1 });
questionSchema.index({ text: 'text', category: 'text' });

module.exports = mongoose.model('Question', questionSchema);
module.exports.TYPES = TYPES;
module.exports.DIFFICULTIES = DIFFICULTIES;
