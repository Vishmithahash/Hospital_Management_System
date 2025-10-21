const asyncHandler = require('../utils/asyncHandler');
const CorrectionRequest = require('../models/CorrectionRequest');
const Patient = require('../models/Patient');
const Notification = require('../models/Notification');
const AuditEntry = require('../models/AuditEntry');
const User = require('../models/User');

const submit = asyncHandler(async (req, res) => {
  const { id: patientId } = req.params;
  const fields = req.body?.fields || {};
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    res.status(422).json({ message: 'fields object is required' });
    return;
  }
  const reqDoc = await CorrectionRequest.create({ patientId, fields, requestedBy: req.user.id });
  await Notification.create({
    userId: req.user.id,
    type: 'CORRECTION_SUBMITTED',
    payload: { patientId },
    audienceRole: req.user.role
  });
  await AuditEntry.create({ entity: 'CorrectionRequest', entityId: reqDoc._id, actorId: req.user.id, action: 'submit', diff: fields });
  res.status(201).json(reqDoc.toObject());
});

const list = asyncHandler(async (req, res) => {
  const { id: patientId } = req.params;
  let query = { patientId };
  if (req.user.role === 'patient') {
    query.requestedBy = req.user.id;
  }
  const items = await CorrectionRequest.find(query).sort({ createdAt: -1 }).lean();
  res.status(200).json(items);
});

const approve = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const correction = await CorrectionRequest.findById(id);
  if (!correction || correction.status !== 'OPEN') {
    res.status(404).json({ message: 'Request not found' });
    return;
  }
  const [patient, targetUser] = await Promise.all([
    Patient.findById(correction.patientId),
    User.findById(correction.requestedBy).lean()
  ]);
  const before = patient.toObject();
  // Apply fields under demographics only for this simple flow
  patient.demographics = { ...patient.demographics, ...correction.fields };
  await patient.save();
  correction.status = 'APPROVED';
  correction.resolvedBy = req.user.id;
  correction.resolvedAt = new Date();
  await correction.save();
  await Notification.create({
    userId: correction.requestedBy,
    type: 'CORRECTION_RESOLVED',
    payload: { patientId: patient._id, status: 'APPROVED' },
    audienceRole: targetUser?.role
  });
  await AuditEntry.create({ entity: 'Patient', entityId: patient._id, actorId: req.user.id, action: 'correction_approved', diff: { before, after: patient.toObject() } });
  res.status(200).json(correction.toObject());
});

const reject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const correction = await CorrectionRequest.findById(id);
  if (!correction || correction.status !== 'OPEN') {
    res.status(404).json({ message: 'Request not found' });
    return;
  }
  correction.status = 'REJECTED';
  correction.resolvedBy = req.user.id;
  correction.resolvedAt = new Date();
  await correction.save();
  const targetUser = await User.findById(correction.requestedBy).lean();
  await Notification.create({
    userId: correction.requestedBy,
    type: 'CORRECTION_RESOLVED',
    payload: { patientId: correction.patientId, status: 'REJECTED' },
    audienceRole: targetUser?.role
  });
  await AuditEntry.create({ entity: 'CorrectionRequest', entityId: correction._id, actorId: req.user.id, action: 'correction_rejected' });
  res.status(200).json(correction.toObject());
});

module.exports = { submit, list, approve, reject };

