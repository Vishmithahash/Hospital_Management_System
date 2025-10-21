const asyncHandler = require('../utils/asyncHandler');
const { forbidden, notFound, badRequest } = require('../utils/httpErrors');
const Consultation = require('../models/Consultation');
const { ensureDoctorCanWrite } = require('../services/permissions/doctor.guard');

function getDoctorIdFromUser(user) {
  return user?.profile?.doctorId || null;
}

const create = asyncHandler(async (req, res) => {
  if (!req.user) throw forbidden('Authentication required');
  if (req.user.role !== 'doctor') throw forbidden('Only doctors can create consultations');

  const doctorId = getDoctorIdFromUser(req.user);
  if (!doctorId) throw forbidden('Doctor profile not configured');

  const { patientId, notes } = req.body || {};
  if (!patientId) throw badRequest('patientId is required');

  const allowed = await ensureDoctorCanWrite(patientId, doctorId);
  if (!allowed) throw forbidden('Doctor not authorized for this patient');

  const doc = await Consultation.create({ patientId: String(patientId), doctorId, notes, createdBy: req.user.id });
  res.status(201).json(doc.toObject());
});

const getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await Consultation.findById(id).lean();
  if (!doc) throw notFound('Consultation not found');

  if (!req.user) throw forbidden('Authentication required');

  if (req.user.role === 'patient') {
    const linked = req.user.linkedPatientId?.toString?.() || String(req.user.linkedPatientId || '');
    if (doc.patientId !== linked) throw forbidden('Patients may only read their own records');
  } else if (req.user.role === 'doctor') {
    const doctorId = getDoctorIdFromUser(req.user);
    if (doc.doctorId !== doctorId) throw forbidden('Doctors may only read their own consultations');
  } else if (req.user.role === 'staff') {
    // staff can read
  } else {
    throw forbidden('Not permitted');
  }

  res.status(200).json(doc);
});

const list = asyncHandler(async (req, res) => {
  if (!req.user) throw forbidden('Authentication required');

  const q = {};

  if (req.user.role === 'patient') {
    const linked = req.user.linkedPatientId?.toString?.() || String(req.user.linkedPatientId || '');
    q.patientId = linked;
  } else if (req.user.role === 'doctor') {
    const doctorId = getDoctorIdFromUser(req.user);
    q.doctorId = doctorId || '__none__';
  } else if (req.user.role === 'staff') {
    if (req.query.patientId) q.patientId = String(req.query.patientId);
    if (req.query.doctorId) q.doctorId = String(req.query.doctorId);
  } else {
    throw forbidden('Not permitted');
  }

  const items = await Consultation.find(q).sort({ createdAt: -1 }).limit(100).lean();
  res.status(200).json(items);
});

module.exports = { create, getById, list };

