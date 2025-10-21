const { Schema, model } = require('mongoose');

const billItemSchema = new Schema(
  {
    billId: { type: Schema.Types.ObjectId, ref: 'Bill', required: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
    description: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true },
    insuranceDiscount: { type: Number, required: true, default: 0 },
    lineTotal: { type: Number, required: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports = model('BillItem', billItemSchema);

