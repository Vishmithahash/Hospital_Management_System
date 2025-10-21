const { Schema, model } = require('mongoose');

const receiptSchema = new Schema(
  {
    billId: { type: Schema.Types.ObjectId, ref: 'Bill', required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true, unique: true },
    receiptNumber: { type: String, required: true, unique: true },
    number: { type: String, required: true, unique: true },
    qrData: { type: Schema.Types.Mixed, required: true },
    payload: { type: Schema.Types.Mixed, required: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports = model('Receipt', receiptSchema);

