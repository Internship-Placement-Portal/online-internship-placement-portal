const mongoose = require('mongoose');

// IPP-F-012: in-app notification (email is sent alongside by notificationService).
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true }, // e.g. application_status, interview_scheduled
    message: { type: String, required: true, maxlength: 500 },
    link: String,
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
