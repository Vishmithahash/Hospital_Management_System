const { Router } = require('express');
const dayjs = require('dayjs');
const { requireAuth, attachUser } = require('../middleware/auth.middleware');
const WaitlistEntry = require('../models/WaitlistEntry');

const router = Router();

function resolvePatientId(req, providedPatientId) {
  if (req.user.role === 'patient') {
    return req.user.linkedPatientId || providedPatientId || null;
  }
  return providedPatientId || req.user.linkedPatientId || null;
}

router.get('/', requireAuth, attachUser, async (req, res, next) => {
  try {
    const patientId = resolvePatientId(req, req.query.patientId);
    if (!patientId) {
      res.status(200).json([]);
      return;
    }

    const match = { patientId };
    if (req.query.doctorId) {
      match.doctorId = req.query.doctorId;
    }

    const entries = await WaitlistEntry.find(match).sort({ desiredDate: 1, createdAt: 1 }).lean();
    res.status(200).json(entries);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, attachUser, async (req, res, next) => {
  try {
    const { doctorId, desiredDate, patientId } = req.body || {};
    const pid = resolvePatientId(req, patientId);

    if (!pid || !doctorId || !desiredDate) {
      res.status(400).json({ code: 'WAITLIST_INVALID', message: 'doctorId and desiredDate are required' });
      return;
    }

    const desired = dayjs(desiredDate);
    if (!desired.isValid()) {
      res.status(400).json({ code: 'WAITLIST_INVALID_DATE', message: 'Desired date is invalid' });
      return;
    }

    const normalized = desired.startOf('day').toDate();

    const existing = await WaitlistEntry.findOne({ patientId: pid, doctorId, desiredDate: normalized });
    if (existing) {
      res.status(200).json(existing.toObject());
      return;
    }

    const entry = await WaitlistEntry.create({ patientId: pid, doctorId, desiredDate: normalized });
    res.status(201).json(entry.toObject());
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, attachUser, async (req, res, next) => {
  try {
    const patientId = resolvePatientId(req, req.body?.patientId);
    if (!patientId) {
      res.status(404).json({ code: 'WAITLIST_NOT_FOUND', message: 'Waitlist entry not found' });
      return;
    }

    const deleted = await WaitlistEntry.findOneAndDelete({ _id: req.params.id, patientId }).lean();
    if (!deleted) {
      res.status(404).json({ code: 'WAITLIST_NOT_FOUND', message: 'Waitlist entry not found' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

