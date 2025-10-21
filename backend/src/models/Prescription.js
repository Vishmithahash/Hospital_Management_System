const { Schema, model } = require('mongoose');

const prescriptionSchema = new Schema(
  {
    patientId: { type: String, required: true, trim: true },
    doctorId: { type: String, required: true, trim: true },
    medications: {
      type: [
        new Schema(
          {
            name: { type: String, required: true, trim: true },
            dose: { type: String, trim: true },
            frequency: { type: String, trim: true },
            duration: { type: String, trim: true }
          },
          { _id: false }
        )
      ],
      default: []
    },
    notes: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true, versionKey: false }
);

module.exports = model('Prescription', prescriptionSchema);

