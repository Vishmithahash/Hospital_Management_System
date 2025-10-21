const { Schema, model } = require('mongoose');

const waitlistEntrySchema = new Schema(
  {
    patientId: { type: String, required: true, trim: true },
    doctorId: { type: String, required: true, trim: true },
    desiredDate: { type: Date, required: true },
    notifiedAt: { type: Date }
  },
  { timestamps: true, versionKey: false }
);

waitlistEntrySchema.index({ doctorId: 1, desiredDate: 1 });
waitlistEntrySchema.index({ patientId: 1, doctorId: 1, desiredDate: 1 }, { unique: true });

module.exports = model('WaitlistEntry', waitlistEntrySchema);

