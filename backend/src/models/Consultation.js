const { Schema, model } = require('mongoose');

const consultationSchema = new Schema(
  {
    patientId: { type: String, required: true, trim: true },
    doctorId: { type: String, required: true, trim: true },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true, versionKey: false }
);

module.exports = model('Consultation', consultationSchema);

