const { Schema, model } = require('mongoose');

const doctorRosterSlotSchema = new Schema(
  {
    doctorId: { type: String, required: true, trim: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    isBlocked: { type: Boolean, default: false }
  },
  { timestamps: true, versionKey: false }
);

doctorRosterSlotSchema.index({ doctorId: 1, startAt: 1 });

module.exports = model('DoctorRosterSlot', doctorRosterSlotSchema);

