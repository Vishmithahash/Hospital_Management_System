const { Schema, model } = require('mongoose');

const demographicsSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dob: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    address: { type: String, trim: true },
    bloodGroup: { type: String, trim: true },
    emergencyContact: { type: String, trim: true }
  },
  { _id: false }
);

const insuranceSchema = new Schema(
  {
    provider: { type: String, trim: true },
    policyNo: { type: String, trim: true },
    validUntil: { type: Date }
  },
  { _id: false }
);

const patientSchema = new Schema(
  {
    demographics: { type: demographicsSchema, required: true },
    insurance: { type: insuranceSchema },
    care: {
      tests: { type: [String], default: [] },
      diagnoses: { type: [String], default: [] },
      plans: { type: [String], default: [] }
    },
    governmentEligible: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true,
    versionKey: '__v',
    optimisticConcurrency: true
  }
);

patientSchema.index({ 'demographics.lastName': 1, 'demographics.firstName': 1 });

module.exports = model('Patient', patientSchema);
