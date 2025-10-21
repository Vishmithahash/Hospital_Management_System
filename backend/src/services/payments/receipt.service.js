const dayjs = require('dayjs');
const Receipt = require('../../models/Receipt');
const Payment = require('../../models/Payment');
const { notFound } = require('../../utils/httpErrors');

async function buildReceiptNumber() {
  const now = dayjs();
  const prefix = `RCPT-${now.format('YYYYMM')}`;
  const existingCount = await Receipt.countDocuments({
    number: { $regex: `^${prefix}` }
  });

  return `${prefix}-${String(existingCount + 1).padStart(4, '0')}`;
}

async function issueReceipt(paymentId) {
  const existing = await Receipt.findOne({ paymentId }).lean();

  if (existing) {
    return existing;
  }

  const payment = await Payment.findById(paymentId).lean();

  if (!payment) {
    throw notFound('Payment not found');
  }

  const number = await buildReceiptNumber();
  const issuedAt = new Date();

  const receipt = await Receipt.create({
    paymentId,
    number,
    issuedAt,
    payload: {
      paymentId: payment._id,
      appointmentId: payment.appointmentId,
      method: payment.method,
      amount: payment.amount,
      status: payment.status,
      issuedAt
    }
  });

  return receipt.toObject();
}

module.exports = {
  issueReceipt
};
