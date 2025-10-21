const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, stopMemoryServer } = require('../config/db');
const { seedUsers, USERS } = require('../config/seed');
const User = require('../models/User');
const Appointment = require('../models/Appointment');

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error('Login failed');
  return res.body.token;
}

describe('Appointments booking and management', () => {
  let patientUser;
  let doctorUser;
  let staffUser;
  let patientToken;
  let staffToken;

  beforeAll(async () => {
    await connectDB();
    await seedUsers();
    patientUser = await User.findOne({ email: USERS.find((u) => u.role === 'patient').email });
    doctorUser = await User.findOne({ email: USERS.find((u) => u.role === 'doctor').email });
    staffUser = await User.findOne({ email: USERS.find((u) => u.role === 'staff').email });
    patientToken = await login(USERS.find((u) => u.role === 'patient').email, USERS.find((u) => u.role === 'patient').password);
    staffToken = await login(USERS.find((u) => u.role === 'staff').email, USERS.find((u) => u.role === 'staff').password);
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await stopMemoryServer();
  });

  beforeEach(async () => {
    await Appointment.deleteMany({});
  });

  function slot(offsetMinutes = 60) {
    const startsAt = new Date(Date.now() + offsetMinutes * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 30 * 60 * 1000);
    return { startsAt, endsAt };
  }

  test('Patient books an available slot (201)', async () => {
    const { startsAt, endsAt } = slot(90);
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({
        doctorId: doctorUser.profile.doctorId,
        patientId: String(patientUser.linkedPatientId),
        department: 'OPD',
        startsAt,
        endsAt,
        reason: 'Checkup'
      })
      .expect(201);
    expect(res.body.status).toBe('BOOKED');
  });

  test('Booking same slot twice is rejected (409)', async () => {
    const { startsAt, endsAt } = slot(120);
    const payload = {
      doctorId: doctorUser.profile.doctorId,
      patientId: String(patientUser.linkedPatientId),
      department: 'OPD',
      startsAt,
      endsAt
    };
    await request(app).post('/api/appointments').set('Authorization', `Bearer ${patientToken}`).send(payload).expect(201);
    await request(app).post('/api/appointments').set('Authorization', `Bearer ${patientToken}`).send(payload).expect(409);
  });

  test('Reschedule to a valid new time updates appointment', async () => {
    const s1 = slot(150);
    const create = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctorUser.profile.doctorId, patientId: String(patientUser.linkedPatientId), department: 'OPD', ...s1 })
      .expect(201);
    const id = create.body._id;

    const s2 = slot(210);
    const res = await request(app)
      .put(`/api/appointments/${id}/reschedule`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ startsAt: s2.startsAt, endsAt: s2.endsAt })
      .expect(200);
    expect(res.body.status).toBe('RESCHEDULED');
  });

  test('Reschedule to past time blocked (400)', async () => {
    const s1 = slot(240);
    const create = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctorUser.profile.doctorId, patientId: String(patientUser.linkedPatientId), department: 'OPD', ...s1 })
      .expect(201);
    const id = create.body._id;

    const past = { startsAt: new Date(Date.now() - 60 * 60 * 1000), endsAt: new Date(Date.now() - 30 * 60 * 1000) };
    await request(app)
      .put(`/api/appointments/${id}/reschedule`)
      .set('Authorization', `Bearer ${patientToken}`)
      .send(past)
      .expect(400);
  });

  test('Cancel respects cutoff for patients; staff can override', async () => {
    const s1 = slot(300);
    const create = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctorUser.profile.doctorId, patientId: String(patientUser.linkedPatientId), department: 'OPD', ...s1 })
      .expect(201);
    const id = create.body._id;

    await request(app).delete(`/api/appointments/${id}`).set('Authorization', `Bearer ${patientToken}`).expect(200);

    // Create within cutoff and let staff cancel
    const closeSlot = slot(10);
    const create2 = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: doctorUser.profile.doctorId, patientId: String(patientUser.linkedPatientId), department: 'OPD', ...closeSlot })
      .expect(201);
    const id2 = create2.body._id;
    await request(app).delete(`/api/appointments/${id2}`).set('Authorization', `Bearer ${staffToken}`).expect(200);
  });
});


