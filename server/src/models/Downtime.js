
const mongoose = require('mongoose');

const downtimeSchema = new mongoose.Schema(
  {
    startedAt: {
      type: Date,
      required: true,
      index: true,
    },
    recoveredAt: {
      type: Date,
      default: null,
    },
    durationMs: {
      type: Number,
      default: null,
      min: 0,
    },
    reason: {
      type: String,
      default: 'Service unavailable',
      maxlength: 500,
    },
    scheduledMaintenance: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['ongoing', 'recovered'],
      default: 'ongoing',
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Downtime', downtimeSchema);
