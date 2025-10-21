const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, stopMemoryServer } = require('../config/db');
const { seedUsers, USERS } = require('../config/seed');
const User = require('../models/User');
const Notification = require('../models/Notification');

function findCredentials(role) {
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

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

describe('Notifications API', () => {
  let patientUser;
  let doctorUser;
  let staffUser;
  let patientToken;
  let doctorToken;
  let staffToken;

  beforeAll(async () => {
    await connectDB();
    await seedUsers();

    const patientCreds = findCredentials('patient');
    const staffCreds = findCredentials('staff');
    const doctorCreds = findCredentials('doctor');

    patientUser = await User.findOne({ email: patientCreds.email });
    doctorUser = await User.findOne({ email: doctorCreds.email });
    staffUser = await User.findOne({ email: staffCreds.email });

    patientToken = await login(patientCreds.email, patientCreds.password);
    doctorToken = await login(doctorCreds.email, doctorCreds.password);
    staffToken = await login(staffCreds.email, staffCreds.password);
  });

  beforeEach(async () => {
    await Notification.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
    await stopMemoryServer();
  });

  describe('GET /api/notifications', () => {
    test('rejects unauthenticated callers', async () => {
      const res = await request(app).get('/api/notifications').expect(401);
      expect(res.body).toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    });

    test("returns only the caller's notifications, sorted by newest first, capped at 50", async () => {
      const baseDate = new Date('2024-01-01T00:00:00.000Z');
      const doctorBulk = Array.from({ length: 55 }, (_, index) => {
        const createdAt = new Date(baseDate.getTime() + index * 1000);
        return {
          userId: doctorUser._id,
          type: 'RECORD_UPDATED',
          payload: { index },
          createdAt,
          updatedAt: createdAt
        };
      });

      const patientNotices = [
        {
          userId: patientUser._id,
          type: 'RECORD_UPDATED',
          payload: { owner: 'patient' }
        }
      ];

      await Notification.insertMany([...doctorBulk, ...patientNotices]);

      const resDoc = await request(app)
        .get('/api/notifications')
        .set(authHeader(doctorToken))
        .expect(200);

      expect(resDoc.body).toHaveLength(50);
      expect(resDoc.body.every((item) => String(item.userId) === String(doctorUser._id))).toBe(true);
      expect(resDoc.body[0].payload.index).toBe(54);
      expect(resDoc.body[49].payload.index).toBe(5);

      const resPat = await request(app)
        .get('/api/notifications')
        .set(authHeader(patientToken))
        .expect(200);
      expect(resPat.body).toHaveLength(1);
      expect(resPat.body[0].payload.owner).toBe('patient');
    });

    test('filters unread notifications when unreadOnly flag is provided (case insensitive)', async () => {
      await Notification.create([
        {
          userId: patientUser._id,
          type: 'RECORD_UPDATED',
          payload: { unread: true },
          isRead: false
        },
        {
          userId: patientUser._id,
          type: 'RECORD_UPDATED',
          payload: { unread: false },
          isRead: true
        },
        {
          userId: doctorUser._id,
          type: 'RECORD_UPDATED',
          payload: { owner: 'doctor' },
          isRead: false
        }
      ]);

      const resAll = await request(app)
        .get('/api/notifications?unreadOnly=false')
        .set(authHeader(patientToken))
        .expect(200);
      expect(resAll.body.map((item) => item.payload.unread).sort()).toEqual([false, true]);

      const resUnread = await request(app)
        .get('/api/notifications?unreadOnly=TRUE')
        .set(authHeader(patientToken))
        .expect(200);

      expect(resUnread.body).toHaveLength(1);
      expect(resUnread.body[0].payload.unread).toBe(true);
    });
  });

  describe('POST /api/notifications/:id/read', () => {
    test('rejects unauthenticated callers', async () => {
      const res = await request(app).post('/api/notifications/123/read').expect(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    test('marks a notification as read for its owner and returns the updated document', async () => {
      const notice = await Notification.create({
        userId: patientUser._id,
        type: 'RECORD_UPDATED',
        payload: { target: 'self' },
        isRead: false
      });

      const res = await request(app)
        .post(`/api/notifications/${notice._id}/read`)
        .set(authHeader(patientToken))
        .expect(200);

      expect(res.body).toMatchObject({
        _id: notice._id.toString(),
        isRead: true,
        payload: { target: 'self' }
      });

      const updated = await Notification.findById(notice._id);
      expect(updated.isRead).toBe(true);
    });

    test("does not allow marking another user's notification as read", async () => {
      const doctorNotice = await Notification.create({
        userId: doctorUser._id,
        type: 'RECORD_UPDATED',
        payload: { owner: 'doctor-only' },
        isRead: false
      });

      const res = await request(app)
        .post(`/api/notifications/${doctorNotice._id}/read`)
        .set(authHeader(patientToken))
        .expect(200);

      expect(res.body).toBeNull();

      const stillUnread = await Notification.findById(doctorNotice._id);
      expect(stillUnread.isRead).toBe(false);
    });

    test('fails gracefully when notification id is invalid', async () => {
      const res = await request(app)
        .post('/api/notifications/not-a-valid-id/read')
        .set(authHeader(patientToken))
        .expect(500);

      expect(res.body).toMatchObject({
        code: 'INTERNAL_ERROR',
        message: expect.any(String)
      });
    });
  });

  describe('POST /api/notifications/read-all', () => {
    test('rejects unauthenticated callers', async () => {
      const res = await request(app).post('/api/notifications/read-all').expect(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    test('marks only the caller unread notifications as read and leaves others untouched', async () => {
      const [patientUnread, patientAlreadyRead] = await Notification.create([
        {
          userId: patientUser._id,
          type: 'RECORD_UPDATED',
          payload: { idx: 1 },
          isRead: false
        },
        {
          userId: patientUser._id,
          type: 'RECORD_UPDATED',
          payload: { idx: 2 },
          isRead: true
        }
      ]);

      const doctorUnread = await Notification.create({
        userId: doctorUser._id,
        type: 'RECORD_UPDATED',
        payload: { idx: 3 },
        isRead: false
      });

      const res = await request(app)
        .post('/api/notifications/read-all')
        .set(authHeader(patientToken))
        .expect(200);

      expect(res.body).toEqual({ ok: true });

      const refreshedPatient = await Notification.find({
        _id: { $in: [patientUnread._id, patientAlreadyRead._id] }
      })
        .sort({ createdAt: 1 })
        .lean();

      expect(refreshedPatient.map((item) => item.isRead)).toEqual([true, true]);

      const untouchedDoctor = await Notification.findById(doctorUnread._id).lean();
      expect(untouchedDoctor.isRead).toBe(false);
    });

    test('is idempotent when all notifications are already read', async () => {
      await Notification.create({
        userId: staffUser._id,
        type: 'RECORD_UPDATED',
        payload: { status: 'read' },
        isRead: true
      });

      const first = await request(app)
        .post('/api/notifications/read-all')
        .set(authHeader(staffToken))
        .expect(200);
      expect(first.body).toEqual({ ok: true });

      const second = await request(app)
        .post('/api/notifications/read-all')
        .set(authHeader(staffToken))
        .expect(200);
      expect(second.body).toEqual({ ok: true });

      const forStaff = await Notification.find({ userId: staffUser._id });
      expect(forStaff.every((item) => item.isRead)).toBe(true);
    });
  });
});
