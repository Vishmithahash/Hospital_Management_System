const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, stopMemoryServer } = require('../config/db');
const { seedUsers, USERS } = require('../config/seed');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const { ensureDoctorCanWrite } = require('../services/permissions/doctor.guard');

function credentials(role) {
  const entry = USERS.find((user) => user.role === role);
  return entry ? { email: entry.email, password: entry.password } : {};
}

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${res.text}`);
  }
  return res.body.token;
}

describe('Doctor write guard and read scopes', () => {
  let patientUser;
  let doctorUser;
  let staffUser;
  let patientToken;
  let doctorToken;
  let staffToken;
  let otherPatient;

  beforeAll(async () => {
    await connectDB();
    await seedUsers();

    const patientCreds = credentials('patient');
    const doctorCreds = credentials('doctor');
    const staffCreds = credentials('staff');

    patientUser = await User.findOne({ email: patientCreds.email });
    doctorUser = await User.findOne({ email: doctorCreds.email });
    staffUser = await User.findOne({ email: staffCreds.email });

    patientToken = await login(patientCreds.email, patientCreds.password);
    doctorToken = await login(doctorCreds.email, doctorCreds.password);
    staffToken = await login(staffCreds.email, staffCreds.password);

    otherPatient = await Patient.create({ demographics: { firstName: 'Other', lastName: 'Patient' } });

    if (!doctorUser.profile || !doctorUser.profile.doctorId) {
      throw new Error('Seeded doctor missing profile.doctorId');
    }

    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${doctorToken}`).expect(200);
    if (!meRes.body.user.profile || !meRes.body.user.profile.doctorId) {
      throw new Error('Auth /me missing doctor profile.doctorId');
    }
    const doctorId = meRes.body.user.profile.doctorId;
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    await Appointment.create({
      patientId: String(patientUser.linkedPatientId),
      doctorId,
      department: 'General',
      startsAt,
      endsAt,
      status: 'CONFIRMED'
    });

    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const count = await Appointment.countDocuments({
      patientId: String(patientUser.linkedPatientId),
      doctorId,
      status: { $in: ['BOOKED', 'CONFIRMED', 'APPROVED', 'ACCEPTED', 'RESCHEDULED'] },
      startsAt: { $gte: start, $lte: end }
    });
    if (count === 0) {
      throw new Error('Sanity check failed: expected appointment not found for guard query');
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await stopMemoryServer();
  });

  test('Doctor can create consultation for a patient with a valid appointment window', async () => {
    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${doctorToken}`).expect(200);
    const doctorId = meRes.body.user.profile.doctorId;
    const ok = await ensureDoctorCanWrite(String(patientUser.linkedPatientId), doctorId);
    expect(ok).toBe(true);

    const res = await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ patientId: String(patientUser.linkedPatientId), notes: 'Checkup' })
      .expect(201);
    expect(res.body.patientId).toBe(String(patientUser.linkedPatientId));
  });

  test('Doctor cannot create consultation for unrelated patient (403)', async () => {
    await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ patientId: String(otherPatient._id), notes: 'No relation' })
      .expect(403);
  });

  test('Patient can read only their own consultations', async () => {
    const listRes = await request(app)
      .get('/api/consultations')
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.every((c) => c.patientId === String(patientUser.linkedPatientId))).toBe(true);
  });

  test('Staff can read consultations but cannot create prescriptions', async () => {
    const listRes = await request(app)
      .get('/api/consultations')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(Array.isArray(listRes.body)).toBe(true);

    await request(app)
      .post('/api/prescriptions')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ patientId: String(patientUser.linkedPatientId), medications: [{ name: 'Med A' }] })
      .expect(403);
  });

  test('Doctor can create image attachment for authorized patient', async () => {
    const res = await request(app)
      .post('/api/images')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ patientId: String(patientUser.linkedPatientId), url: 'https://example.com/xray.png', caption: 'X-Ray' })
      .expect(201);
    expect(res.body.url).toBe('https://example.com/xray.png');
  });
});

