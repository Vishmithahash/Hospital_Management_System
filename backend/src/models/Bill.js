const { Schema, model } = require('mongoose');

const billSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'CANCELLED'],
      default: 'PENDING'
    },
    subtotal: { type: Number, required: true, default: 0 },
    insuranceDiscount: { type: Number, required: true, default: 0 },
    governmentCover: { type: Number, required: true, default: 0 },
    totalPayable: { type: Number, required: true, default: 0 }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports = model('Bill', billSchema);

