const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, stopMemoryServer } = require('../config/db');
const { seedUsers, USERS } = require('../config/seed');
const User = require('../models/User');
const Patient = require('../models/Patient');

async function login(email, password) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error('Login failed');
  return res.body.token;
}

describe('Patient update and optimistic concurrency', () => {
  let staffToken;
  let patientId;

  beforeAll(async () => {
    await connectDB();
    await seedUsers();
    const staff = USERS.find((u) => u.role === 'staff');
    staffToken = await login(staff.email, staff.password);
    const user = await User.findOne({ email: USERS.find((u) => u.role === 'patient').email });
    patientId = String(user.linkedPatientId);
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await stopMemoryServer();
  });

  test('Successful update persists and bumps version', async () => {
    const before = await Patient.findById(patientId);
    const res = await request(app)
      .put(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ demographics: { address: '123 New Rd' } })
      .expect(200);
    expect(res.body.demographics.address).toBe('123 New Rd');
    const after = await Patient.findById(patientId);
    expect(after.__v).toBe(before.__v + 1);
  });

  test('Version conflict returns 409 and does not persist second write', async () => {
    const current = await Patient.findById(patientId);
    // First update with correct version
    await request(app)
      .put(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('If-Match', String(current.__v))
      .send({ demographics: { phone: '+94 77 111 2222' } })
      .expect(200);

    // Simulate stale client using previous version
    const staleVersion = current.__v; // not incremented
    await request(app)
      .put(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('If-Match', String(staleVersion))
      .send({ demographics: { phone: '+94 77 333 4444' } })
      .expect(409);

    const final = await Patient.findById(patientId);
    expect(final.demographics.phone).toBe('+94 77 111 2222');
  });

  test('Invalid insurance payload rejected with 400', async () => {
    await request(app)
      .put(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ insurance: { provider: 'X', policyNo: '', validUntil: 'not-a-date' } })
      .expect(400);
  });
});


