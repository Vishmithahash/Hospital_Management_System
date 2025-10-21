const asyncHandler = require('../utils/asyncHandler');
const { forbidden, notFound, badRequest } = require('../utils/httpErrors');
const ImageAttachment = require('../models/ImageAttachment');
const { ensureDoctorCanWrite } = require('../services/permissions/doctor.guard');
const path = require('path');

function getDoctorIdFromUser(user) {
  return user?.profile?.doctorId || null;
}

const create = asyncHandler(async (req, res) => {
  if (!req.user) throw forbidden('Authentication required');
  if (req.user.role !== 'doctor') throw forbidden('Only doctors can create image attachments');

  const doctorId = getDoctorIdFromUser(req.user);
  if (!doctorId) throw forbidden('Doctor profile not configured');

  const { patientId, url, caption } = req.body || {};
  if (!patientId) throw badRequest('patientId is required');
  if (!url) throw badRequest('url is required');

  const allowed = await ensureDoctorCanWrite(patientId, doctorId);
  if (!allowed) throw forbidden('Doctor not authorized for this patient');

  const doc = await ImageAttachment.create({ patientId: String(patientId), doctorId, url, caption, createdBy: req.user.id });
  res.status(201).json(doc.toObject());
});

const getById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await ImageAttachment.findById(id).lean();
  if (!doc) throw notFound('Image not found');

  if (!req.user) throw forbidden('Authentication required');

  if (req.user.role === 'patient') {
    const linked = req.user.linkedPatientId?.toString?.() || String(req.user.linkedPatientId || '');
    if (doc.patientId !== linked) throw forbidden('Patients may only read their own records');
  } else if (req.user.role === 'doctor') {
    const doctorId = getDoctorIdFromUser(req.user);
    if (doc.doctorId !== doctorId) throw forbidden('Doctors may only read images they authored');
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

  const items = await ImageAttachment.find(q).sort({ createdAt: -1 }).limit(100).lean();
  res.status(200).json(items);
});

module.exports = { create, getById, list };
// Optional: file upload handler for images via multipart/form-data
const upload = asyncHandler(async (req, res) => {
  if (!req.user) throw forbidden('Authentication required');
  if (req.user.role !== 'doctor') throw forbidden('Only doctors can upload images');

  const doctorId = getDoctorIdFromUser(req.user);
  if (!doctorId) throw forbidden('Doctor profile not configured');

  const { patientId, caption } = req.body || {};
  if (!patientId) throw badRequest('patientId is required');
  if (!req.file) throw badRequest('file is required');

  const allowed = await ensureDoctorCanWrite(patientId, doctorId);
  if (!allowed) throw forbidden('Doctor not authorized for this patient');

  const filename = req.file.filename;
  const url = path.posix.join('/uploads', filename);

  const doc = await ImageAttachment.create({ patientId: String(patientId), doctorId, url, caption, createdBy: req.user.id });
  res.status(201).json(doc.toObject());
});

module.exports.upload = upload;
