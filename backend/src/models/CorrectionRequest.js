const { Schema, model } = require('mongoose');

const correctionRequestSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    fields: { type: Schema.Types.Mixed, required: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['OPEN', 'APPROVED', 'REJECTED'],
      default: 'OPEN'
    },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports = model('CorrectionRequest', correctionRequestSchema);
