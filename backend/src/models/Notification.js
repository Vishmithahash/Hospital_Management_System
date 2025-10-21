const { Schema, model } = require('mongoose');

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'RECORD_UPDATED',
        'CORRECTION_SUBMITTED',
        'CORRECTION_RESOLVED',
        'CONFLICT_DETECTED',
        'INSURANCE_INVALID',
        'PAYMENT_SUCCESS',
        'PAYMENT_DECLINED',
        'PAYMENT_ERROR'
      ],
      required: true
    },
    payload: { type: Object, default: {} },
    audienceRole: {
      type: String,
      enum: ['patient', 'doctor', 'staff', 'manager', 'admin'],
      default: undefined
    },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true, versionKey: false }
);

module.exports = model('Notification', notificationSchema);
