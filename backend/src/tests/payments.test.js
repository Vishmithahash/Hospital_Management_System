const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, stopMemoryServer } = require('../config/db');
const { seedUsers, USERS } = require('../config/seed');
const User = require('../models/User');
const Bill = require('../models/Bill');
const BillItem = require('../models/BillItem');
const Payment = require('../models/Payment');
const Receipt = require('../models/Receipt');
const Patient = require('../models/Patient');
const Notification = require('../models/Notification');
const Appointment = require('../models/Appointment');
const dayjs = require('dayjs');

function credentials(role) {
  const entry = USERS.find((user) => user.role === role);
  return entry ? { email: entry.email, password: entry.password } : {};
}

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status}`);
  }
  return res.body.token;
}

describe('Billing and payments flows', () => {
  let patientUser;
  let staffUser;
  let doctorUser;
  let patientToken;
  let staffToken;
  let doctorToken;

  beforeAll(async () => {
    await connectDB();
    await seedUsers();
    const patientCreds = credentials('patient');
    const staffCreds = credentials('staff');
    const doctorCreds = credentials('doctor');

    patientUser = await User.findOne({ email: patientCreds.email });
    staffUser = await User.findOne({ email: staffCreds.email });
    doctorUser = await User.findOne({ email: doctorCreds.email });

    patientToken = await login(patientCreds.email, patientCreds.password);
    staffToken = await login(staffCreds.email, staffCreds.password);
    doctorToken = await login(doctorCreds.email, doctorCreds.password);
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await stopMemoryServer();
  });

  beforeEach(async () => {
    await Bill.deleteMany({});
    await BillItem.deleteMany({});
    await Payment.deleteMany({});
    await Receipt.deleteMany({});
    await Notification.deleteMany({});
    await Patient.updateOne({ _id: patientUser.linkedPatientId }, { $set: { governmentEligible: false } });

    const baseSlot = dayjs();
    await Appointment.deleteMany({ patientId: patientUser.linkedPatientId });
    await Appointment.insertMany([
      {
        patientId: patientUser.linkedPatientId.toString(),
        doctorId: doctorUser.profile.doctorId,
        department: 'General Medicine',
        startsAt: baseSlot.hour(9).minute(0).second(0).toDate(),
        endsAt: baseSlot.hour(9).minute(30).second(0).toDate(),
        status: 'APPROVED'
      },
      {
        patientId: patientUser.linkedPatientId.toString(),
        doctorId: doctorUser.profile.doctorId,
        department: 'General Medicine',
        startsAt: baseSlot.add(1, 'day').hour(11).minute(0).second(0).toDate(),
        endsAt: baseSlot.add(1, 'day').hour(11).minute(30).second(0).toDate(),
        status: 'ACCEPTED'
      }
    ]);
  });

  async function buildBill(token) {
    const res = await request(app)
      .get(`/api/billing/patient/${patientUser.linkedPatientId}/build-latest`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body;
  }

  async function getBill(token) {
    const res = await request(app)
      .get(`/api/billing/patient/${patientUser.linkedPatientId}/current`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return res.body;
  }

  test('Build bill from approved appointments applies insurance discount', async () => {
    const bill = await buildBill(patientToken);
    expect(bill).toBeTruthy();
    expect(bill.subtotal).toBeCloseTo(4000, 2);
    expect(bill.insuranceDiscount).toBeCloseTo(1000, 2);
    expect(bill.totalPayable).toBeCloseTo(3000, 2);
    expect(bill.items).toHaveLength(2);
  });

  test('Card payment success marks bill paid and issues receipt', async () => {
    await buildBill(patientToken);
    const bill = await getBill(patientToken);
    const res = await request(app)
      .post('/api/payments/card')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        billId: bill._id,
        cardNumber: '4111111111111111',
        expMonth: '10',
        expYear: '28',
        cvc: '123'
      })
      .expect(201);

    expect(res.body.payment.status).toBe('SUCCESS');
    expect(res.body.receipt).toBeTruthy();
    const storedBill = await Bill.findById(bill._id);
    expect(storedBill.status).toBe('PAID');
    expect(storedBill.totalPayable).toBe(0);

    const notifications = await Notification.find({}).lean();
    expect(notifications.some((n) => String(n.userId) === String(patientUser._id) && n.type === 'PAYMENT_SUCCESS')).toBe(true);
    expect(notifications.some((n) => String(n.userId) === String(staffUser._id) && n.type === 'PAYMENT_SUCCESS')).toBe(true);
    expect(notifications.some((n) => String(n.userId) === String(doctorUser._id))).toBe(false);
  });

  test('Card payment declined leaves bill pending', async () => {
    await buildBill(patientToken);
    const bill = await getBill(patientToken);
    await request(app)
      .post('/api/payments/card')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        billId: bill._id,
        cardNumber: '4000000000000002',
        expMonth: '10',
        expYear: '28',
        cvc: '123'
      })
      .expect(402);

    const storedBill = await Bill.findById(bill._id);
    expect(storedBill.status).toBe('PENDING');
    const payment = await Payment.findOne({ billId: bill._id });
    expect(payment.status).toBe('DECLINED');
    const patientNotifications = await Notification.find({ userId: patientUser._id });
    expect(patientNotifications.some((n) => n.type === 'PAYMENT_DECLINED')).toBe(true);
  });

  test('Card payment network error returns 503 without state change', async () => {
    await buildBill(patientToken);
    const bill = await getBill(patientToken);
    await request(app)
      .post('/api/payments/card')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        billId: bill._id,
        cardNumber: '4084084084084084',
        expMonth: '12',
        expYear: '29',
        cvc: '999'
      })
      .expect(503);

    const storedBill = await Bill.findById(bill._id);
    expect(storedBill.status).toBe('PENDING');
    const payment = await Payment.findOne({ billId: bill._id });
    expect(payment.status).toBe('ERROR');
  });

  test('Staff can record cash payment', async () => {
    await buildBill(patientToken);
    const bill = await getBill(staffToken);
    const res = await request(app)
      .post('/api/payments/cash')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ billId: bill._id, amount: bill.totalPayable })
      .expect(201);

    expect(res.body.payment.status).toBe('SUCCESS');
    const storedBill = await Bill.findById(bill._id);
    expect(storedBill.status).toBe('PAID');
    const receipt = await Receipt.findOne({ billId: bill._id });
    expect(receipt).not.toBeNull();
  });

  test('Patient cannot record cash payment', async () => {
    await buildBill(patientToken);
    const bill = await getBill(patientToken);
    await request(app)
      .post('/api/payments/cash')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ billId: bill._id, amount: bill.totalPayable })
      .expect(403);
  });

  test('Government cover records payment with zero amount when eligible', async () => {
    await Patient.updateOne({ _id: patientUser.linkedPatientId }, { $set: { governmentEligible: true } });
    const bill = await buildBill(staffToken);
    expect(bill.totalPayable).toBe(0);
    expect(bill.governmentCover).toBeGreaterThan(0);

    const res = await request(app)
      .post('/api/payments/government')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ billId: bill._id })
      .expect(201);

    expect(res.body.payment.method).toBe('GOVERNMENT');
    const storedBill = await Bill.findById(bill._id);
    expect(storedBill.status).toBe('PAID');
    const payment = await Payment.findOne({ billId: bill._id });
    expect(payment.amount).toBe(0);
  });

  test('Doctor has read-only access to billing', async () => {
    await buildBill(patientToken);
    await request(app)
      .get(`/api/billing/patient/${patientUser.linkedPatientId}/current`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const bill = await getBill(patientToken);
    await request(app)
      .post('/api/payments/card')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        billId: bill._id,
        cardNumber: '4111111111111111',
        expMonth: '10',
        expYear: '28',
        cvc: '123'
      })
      .expect(403);
  });
});

