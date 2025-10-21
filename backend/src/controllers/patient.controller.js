const asyncHandler = require('../utils/asyncHandler');
const patientService = require('../services/patients/patient.service');
const Patient = require('../models/Patient');

const getById = asyncHandler(async (req, res) => {
  const patient = await patientService.getPatient(req.params.id, req.user || {});
  res.status(200).json(patient);
});

const update = asyncHandler(async (req, res) => {
  const actorId = req.user?.id;
  const payload = req.validatedBody || req.body;
  const updated = await patientService.updatePatient(
    req.params.id,
    payload,
    actorId,
    req.expectedVersion
  );

  res.status(200).json(updated);
});

const getAudit = asyncHandler(async (req, res) => {
  const entries = await patientService.getAudit(req.params.id);
  res.status(200).json(entries);
});

const search = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
  if (!q) {
    const items = await Patient.find().sort({ 'demographics.lastName': 1 }).limit(limit).select({ 'demographics.firstName': 1, 'demographics.lastName': 1, 'demographics.email': 1 }).lean();
    res.status(200).json(items);
    return;
  }
  const rx = new RegExp(q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
  const results = await Patient.find({
    $or: [
      { 'demographics.firstName': rx },
      { 'demographics.lastName': rx },
      { 'demographics.email': rx }
    ]
  })
    .sort({ 'demographics.lastName': 1 })
    .limit(limit)
    .select({ 'demographics.firstName': 1, 'demographics.lastName': 1, 'demographics.email': 1 })
    .lean();
  res.status(200).json(results);
});

module.exports = {
  getById,
  update,
  getAudit,
  search
};
