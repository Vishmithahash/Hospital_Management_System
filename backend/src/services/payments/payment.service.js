const mongoose = require('mongoose');
const QRCode = require('qrcode');
const Bill = require('../../models/Bill');
const BillItem = require('../../models/BillItem');
const Payment = require('../../models/Payment');
const Receipt = require('../../models/Receipt');
const Notification = require('../../models/Notification');
const AuditEntry = require('../../models/AuditEntry');
const User = require('../../models/User');
const { forbidden, badRequest, notFound, conflict, serverError } = require('../../utils/httpErrors');
const billingService = require('../billing/billing.service');
const { processCard, CARD_STATUS } = require('./mockGateway');

function assertBillExists(bill) {
  if (!bill) {
    throw notFound('Bill not found');
  }
}

function assertBillPending(bill) {
  if (bill.status !== 'PENDING') {
    throw conflict('Bill is not pending');
  }
}

function assertCanAccessBill(bill, actor) {
  if (!actor) throw forbidden('Authentication required');

  if (actor.role === 'patient') {
    if (bill.patientId.toString() !== actor.linkedPatientId?.toString()) {
      throw forbidden('Patients may only manage their own bills');
    }
  } else if (actor.role === 'doctor') {
    // doctor can only read; enforcement handled by caller
  } else if (['staff', 'manager', 'admin'].includes(actor.role)) {
    return;
  } else {
    throw forbidden('Not permitted');
  }
}

function assertCanPay(bill, actor, method) {
  assertCanAccessBill(bill, actor);
  if (actor.role === 'doctor') {
    throw forbidden('Doctors cannot process payments');
  }
  if (actor.role === 'patient' && method !== 'CARD') {
    throw forbidden('Patients may only pay by card');
  }
  if (method !== 'CARD' && !['staff', 'manager', 'admin'].includes(actor.role)) {
    throw forbidden('Method not permitted');
  }
}

async function fetchBillWithItems(billId) {
  return billingService.fetchBillWithItems(billId);
}

async function generateReceipt({ bill, payment }) {
  const items = await BillItem.find({ billId: bill._id }).sort({ createdAt: 1 }).lean();
  const existing = await Receipt.findOne({ paymentId: payment._id }).lean();
  if (existing) {
    return existing;
  }
  const payload = {
    receiptNumber: null,
    billId: bill._id,
    patientId: bill.patientId,
    status: bill.status,
    subtotal: bill.subtotal,
    insuranceDiscount: bill.insuranceDiscount,
    governmentCover: bill.governmentCover,
    totalPaid: payment.amount,
    method: payment.method,
    cardLast4: payment.cardLast4,
    createdAt: new Date().toISOString(),
    items
  };

  const receiptNumber = `RC-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  payload.receiptNumber = receiptNumber;

  const qrContent = JSON.stringify({
    receiptId: receiptNumber,
    billId: bill._id.toString(),
    amount: payment.amount,
    timestamp: new Date().toISOString()
  });

  let qrDataUrl;
  try {
    qrDataUrl = await QRCode.toDataURL(qrContent, { margin: 1, width: 256 });
  } catch (error) {
    throw serverError('Failed to generate QR code');
  }

  const receipt = await Receipt.create({
    billId: bill._id,
    paymentId: payment._id,
    receiptNumber,
    number: receiptNumber,
    qrData: qrDataUrl,
    payload
  });

  return receipt.toObject();
}

async function notify({ bill, payment, actor, status }) {
  const patientUser = await User.findOne({ linkedPatientId: bill.patientId }).lean();
  const staffUsers = await User.find({ role: 'staff' }).lean();
  const managerUsers = await User.find({ role: 'manager' }).lean();

  const typeMap = {
    SUCCESS: 'PAYMENT_SUCCESS',
    DECLINED: 'PAYMENT_DECLINED',
    ERROR: 'PAYMENT_ERROR'
  };

  const basePayload = {
    billId: bill._id,
    paymentId: payment?._id,
    amount: payment?.amount,
    method: payment?.method,
    status
  };

  const entries = [];

  if (patientUser) {
    entries.push({
      userId: patientUser._id,
      type: typeMap[status],
      payload: { ...basePayload },
      audienceRole: 'patient',
      isRead: false
    });
  }

  staffUsers.forEach((user) => {
    entries.push({
      userId: user._id,
      type: typeMap[status],
      payload: { ...basePayload },
      audienceRole: 'staff',
      isRead: false
    });
  });

  managerUsers.forEach((user) => {
    entries.push({
      userId: user._id,
      type: typeMap[status],
      payload: { ...basePayload },
      audienceRole: 'manager',
      isRead: false
    });
  });

  if (entries.length) {
    await Notification.insertMany(entries);
  }
}

async function audit({ actor, bill, payment, status, message }) {
  if (!actor?.id) return;
  await AuditEntry.create({
    entity: 'Bill',
    entityId: bill._id,
    actorId: new mongoose.Types.ObjectId(actor.id),
    action: `PAYMENT_${status}`,
    diff: {
      paymentId: payment?._id,
      method: payment?.method,
      status,
      message
    }
  });
}

async function handleCardPayment({ billId, cardNumber, expMonth, expYear, cvc }, actor) {
  if (!cardNumber || !expMonth || !expYear || !cvc) {
    throw badRequest('Card details incomplete');
  }

  const bill = await Bill.findById(billId);
  assertBillExists(bill);
  assertBillPending(bill);
  assertCanPay(bill, actor, 'CARD');

  if (bill.totalPayable <= 0) {
    throw conflict('No payable balance on this bill');
  }

  const payment = await Payment.create({
    billId,
    method: 'CARD',
    amount: bill.totalPayable,
    status: 'PENDING',
    createdByUserId: actor?.id ? new mongoose.Types.ObjectId(actor.id) : null
  });

  const gatewayResponse = await processCard({ cardNumber, amount: bill.totalPayable });

  if (gatewayResponse.status === CARD_STATUS.SUCCESS) {
    payment.status = 'SUCCESS';
    payment.gatewayRef = gatewayResponse.gatewayRef;
    payment.authCode = gatewayResponse.authCode;
    payment.cardLast4 = cardNumber.slice(-4);
    await payment.save();

    await billingService.markBillPaid(billId, bill.totalPayable);
    const updatedBill = await Bill.findById(billId);
    const receipt = await generateReceipt({ bill: updatedBill, payment });
    await notify({ bill: updatedBill, payment, actor, status: 'SUCCESS' });
    await audit({ actor, bill: updatedBill, payment, status: 'SUCCESS' });
    return {
      payment: payment.toObject(),
      receipt
    };
  }

  if (gatewayResponse.status === CARD_STATUS.DECLINED) {
    payment.status = 'DECLINED';
    await payment.save();
    await notify({ bill, payment, actor, status: 'DECLINED' });
    await audit({ actor, bill, payment, status: 'DECLINED', message: 'Card declined' });
    const declineError = badRequest('Card was declined');
    declineError.status = 402;
    throw declineError;
  }

  payment.status = 'ERROR';
  await payment.save();
  await notify({ bill, payment, actor, status: 'ERROR' });
  await audit({ actor, bill, payment, status: 'ERROR', message: 'Payment gateway error' });
  const error = serverError('Payment gateway temporarily unavailable');
  error.status = 503;
  throw error;
}

async function handleCashPayment({ billId, amount }, actor) {
  if (!amount || amount < 0) {
    throw badRequest('Amount is required');
  }
  const bill = await Bill.findById(billId);
  assertBillExists(bill);
  assertBillPending(bill);
  assertCanPay(bill, actor, 'CASH');

  if (bill.totalPayable > 0 && amount !== bill.totalPayable) {
    throw badRequest('Cash amount must match outstanding total');
  }

  const payment = await Payment.create({
    billId,
    method: 'CASH',
    amount,
    status: 'SUCCESS',
    createdByUserId: actor?.id ? new mongoose.Types.ObjectId(actor.id) : null
  });

  await billingService.markBillPaid(billId, amount);
  const updatedBill = await Bill.findById(billId);
  const receipt = await generateReceipt({ bill: updatedBill, payment });
  await notify({ bill: updatedBill, payment, actor, status: 'SUCCESS' });
  await audit({ actor, bill: updatedBill, payment, status: 'SUCCESS', message: 'Cash payment recorded' });
  return { payment: payment.toObject(), receipt };
}

async function handleGovernmentPayment({ billId }, actor) {
  const bill = await Bill.findById(billId);
  assertBillExists(bill);
  assertBillPending(bill);
  assertCanPay(bill, actor, 'GOVERNMENT');

  const patient = await billingService.hydratePatient(bill.patientId);
  if (!patient.governmentEligible) {
    throw forbidden('Patient is not eligible for government cover');
  }

  const payment = await Payment.create({
    billId,
    method: 'GOVERNMENT',
    amount: 0,
    status: 'SUCCESS',
    createdByUserId: actor?.id ? new mongoose.Types.ObjectId(actor.id) : null
  });

  await billingService.markBillPaid(billId, 0);
  const updatedBill = await Bill.findById(billId);
  const receipt = await generateReceipt({ bill: updatedBill, payment });
  await notify({ bill: updatedBill, payment, actor, status: 'SUCCESS' });
  await audit({ actor, bill: updatedBill, payment, status: 'SUCCESS', message: 'Government cover applied' });
  return { payment: payment.toObject(), receipt };
}

async function getReceipt(receiptId, actor) {
  let receipt = null;

  if (mongoose.Types.ObjectId.isValid(receiptId)) {
    receipt = await Receipt.findById(receiptId).lean();
  }

  if (!receipt) {
    receipt = await Receipt.findOne({ receiptNumber: receiptId }).lean();
  }

  if (!receipt) {
    throw notFound('Receipt not found');
  }

  const bill = await Bill.findById(receipt.billId);
  assertCanAccessBill(bill, actor);
  return receipt;
}

module.exports = {
  handleCardPayment,
  handleCashPayment,
  handleGovernmentPayment,
  getReceipt,
  fetchBillWithItems
};
