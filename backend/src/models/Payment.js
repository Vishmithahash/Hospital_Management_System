const { Schema, model } = require('mongoose');

const paymentSchema = new Schema(
  {
    billId: { type: Schema.Types.ObjectId, ref: 'Bill', required: true },
    method: {
      type: String,
      enum: ['CARD', 'CASH', 'GOVERNMENT'],
      required: true
    },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'DECLINED', 'ERROR'],
      default: 'PENDING'
    },
    gatewayRef: { type: String, trim: true },
    authCode: { type: String, trim: true },
    cardLast4: { type: String, trim: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

module.exports = model('Payment', paymentSchema);

