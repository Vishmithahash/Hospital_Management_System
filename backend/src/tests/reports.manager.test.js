const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, stopMemoryServer } = require('../config/db');
const { seedUsers, USERS } = require('../config/seed');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Bill = require('../models/Bill');
const Payment = require('../models/Payment');
const ReportAudit = require('../models/ReportAudit');
const dayjs = require('dayjs');

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error('Login failed');
  return res.body.token;
}

describe('Manager Reports module', () => {
  let manager;
  let managerToken;
  let patientUser;
  let doctorUser;
  let bill;

  beforeAll(async () => {
    await connectDB();
    const seed = await seedUsers();
    patientUser = await User.findOne({ email: USERS.find((u) => u.role === 'patient').email });
    doctorUser = await User.findOne({ email: USERS.find((u) => u.role === 'doctor').email });

    // Register manager
    await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Manager One',
        phone: '+94 71 123 4567',
        email: 'manager1@example.com',
        password: 'Manager@123',
        role: 'manager'
      })
      .expect(201);
    manager = await User.findOne({ email: 'manager1@example.com' });
    managerToken = await login('manager1@example.com', 'Manager@123');

    // Prepare a bill for payments
    const patient = await Patient.findById(patientUser.linkedPatientId);
    bill = await Bill.create({ patientId: patient._id, subtotal: 1000, totalPayable: 1000 });
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await stopMemoryServer();
  });

  beforeEach(async () => {
    await Appointment.deleteMany({});
    await Payment.deleteMany({});
    await ReportAudit.deleteMany({});
  });

  test('RBAC: non-manager gets 403', async () => {
    const patientToken = await login(USERS.find((u) => u.role === 'patient').email, USERS.find((u) => u.role === 'patient').password);
    await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ type: 'DAILY_VISITS', range: { from: '2024-01-01', to: '2024-01-01' } })
      .expect(403);
  });

  test('A1: invalid future range rejected', async () => {
    const tomorrow = dayjs().add(1, 'day').format('YYYY-MM-DD');
    await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ type: 'DAILY_VISITS', range: { from: tomorrow, to: tomorrow } })
      .expect(400);
  });

  test('A2: no data path returns 200 with noData meta', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ type: 'APPT_LOAD', range: { from: '2019-01-01', to: '2019-01-02' } })
      .expect(200);
    expect(res.body.meta.noData).toBe(true);
  });

  test('Each type returns aggregated shape', async () => {
    const doctorId = doctorUser.profile.doctorId;
    const pId = String(patientUser.linkedPatientId);

    // Appointments across two days and different hours/statuses
    const d1 = dayjs().subtract(2, 'day');
    const d2 = dayjs().subtract(1, 'day');
    await Appointment.create([
      { patientId: pId, doctorId, department: 'OPD', startsAt: d1.hour(9).toDate(), endsAt: d1.hour(9).add(30, 'minute').toDate(), status: 'COMPLETED' },
      { patientId: pId, doctorId, department: 'OPD', startsAt: d1.hour(10).toDate(), endsAt: d1.hour(10).add(30, 'minute').toDate(), status: 'BOOKED' },
      { patientId: pId, doctorId, department: 'Cardiology', startsAt: d2.hour(14).toDate(), endsAt: d2.hour(14).add(30, 'minute').toDate(), status: 'APPROVED' }
    ]);

    // Payments
    await Payment.create([
      { billId: bill._id, method: 'CARD', amount: 1500, status: 'SUCCESS', createdAt: d2.toDate() },
      { billId: bill._id, method: 'CASH', amount: 500, status: 'SUCCESS', createdAt: d2.toDate() }
    ]);

    const range = { from: dayjs().subtract(3, 'day').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') };

    const visits = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ type: 'DAILY_VISITS', range })
      .expect(200);
    expect(visits.body.table.columns).toEqual(['day', 'visits']);
    expect(Array.isArray(visits.body.table.rows)).toBe(true);

    const load = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ type: 'APPT_LOAD', range })
      .expect(200);
    expect(load.body.chart.kind).toBe('stacked');

    const hours = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ type: 'PEAK_HOURS', range })
      .expect(200);
    expect(hours.body.table.columns).toEqual(['hour', 'count']);

    const pay = await request(app)
      .post('/api/reports/generate')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ type: 'PAYMENT_SUMMARY', range })
      .expect(200);
    expect(pay.body.table.columns).toEqual(['method', 'tx_count', 'avg_ticket', 'total_lkr']);

    // Export
    const xlsx = await request(app)
      .post('/api/reports/export')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ type: 'PAYMENT_SUMMARY', range, format: 'xlsx' })
      .expect(200);
    expect(String(xlsx.headers['content-disposition'] || '')).toContain('.xlsx');

    const pdf = await request(app)
      .post('/api/reports/export')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ type: 'DAILY_VISITS', range, format: 'pdf' })
      .expect(200);
    expect(String(pdf.headers['content-disposition'] || '')).toContain('.pdf');

    const audits = await ReportAudit.find({}).lean();
    expect(audits.some((a) => a.type === 'REPORT_GENERATE')).toBe(true);
    expect(audits.some((a) => a.type === 'REPORT_EXPORT')).toBe(true);
  });
});

