const mongoose = require('mongoose');
const Patient = require('../../models/Patient');
const AuditEntry = require('../../models/AuditEntry');
const { validatePatientUpdate } = require('./validation.service');
const { validatePolicy } = require('./insurance.mock');
const { jsonDiff } = require('../../utils/diff');
const { conflict, notFound, badRequest, forbidden } = require('../../utils/httpErrors');

function maskSensitiveDetails(patient) {
  if (!patient) {
    return patient;
  }

  const masked = { ...patient };

  if (masked.demographics) {
    masked.demographics = { ...masked.demographics, email: undefined, phone: undefined };
  }

  return masked;
}

function insuranceChanged(existing = {}, next = {}) {
  if (!next) {
    return false;
  }

  return (
    existing.provider !== next.provider ||
    existing.policyNo !== next.policyNo ||
    new Date(existing.validUntil || 0).getTime() !== new Date(next.validUntil || 0).getTime()
  );
}

function ensureValidId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw badRequest('Invalid patient id');
  }
}

function normalizeId(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value.toString === 'function') {
    return value.toString();
  }

  return String(value);
}

async function getPatient(id, requester = {}) {
  ensureValidId(id);
  const patient = await Patient.findById(id).lean();

  if (!patient) {
    throw notFound('Patient not found');
  }

  const role = requester?.role;
  const linkedPatientId = normalizeId(requester?.linkedPatientId);
  const requestedId = normalizeId(id);

  if (role === 'patient') {
    if (!linkedPatientId) {
      throw forbidden('Your account is not linked to a patient record');
    }

    if (linkedPatientId !== requestedId) {
      throw forbidden('Patients may only access their own record');
    }
    // Patients viewing their own record should see full demographics including phone/email
    return patient;
  }

  if (role !== 'doctor' && role !== 'staff') {
    return maskSensitiveDetails(patient);
  }

  return patient;
}

async function updatePatient(id, dto, actorId, expectedVersion) {
  ensureValidId(id);
  const payload = validatePatientUpdate(dto);
  const patient = await Patient.findById(id);

  if (!patient) {
    throw notFound('Patient not found');
  }

  if (
    typeof expectedVersion !== 'undefined' &&
    expectedVersion !== null &&
    patient.__v !== expectedVersion
  ) {
    throw conflict('Patient record has changed', {
      expected: patient.__v,
      provided: expectedVersion
    });
  }

  const before = patient.toObject();

  if (payload.demographics) {
    patient.demographics = { ...patient.demographics, ...payload.demographics };
  }

  if (payload.insurance) {
    const currentInsurance = patient.insurance?.toObject?.() ?? patient.insurance ?? {};

    if (insuranceChanged(currentInsurance, payload.insurance)) {
      const result = validatePolicy(payload.insurance);

      if (!result.ok) {
        throw badRequest('Insurance validation failed', { reason: result.reason });
      }
    }

    patient.insurance = {
      ...currentInsurance,
      ...payload.insurance
    };
  }

  if (payload.care) {
    const currentCare = patient.care?.toObject?.() ?? patient.care ?? {};
    patient.care = {
      tests: payload.care.tests !== undefined ? payload.care.tests : currentCare.tests || [],
      diagnoses:
        payload.care.diagnoses !== undefined ? payload.care.diagnoses : currentCare.diagnoses || [],
      plans: payload.care.plans !== undefined ? payload.care.plans : currentCare.plans || []
    };
  }

  patient.updatedBy = actorId;

  try {
    patient.increment();
    const updated = await patient.save();
    const after = updated.toObject();
    const diff = jsonDiff(before, after);

    await AuditEntry.create({
      entity: 'Patient',
      entityId: updated._id,
      actorId,
      action: 'update',
      diff
    });

    return after;
  } catch (error) {
    if (error instanceof mongoose.Error.VersionError) {
      throw conflict('Patient record has changed', {
        expected: patient.__v,
        provided: expectedVersion
      });
    }

    throw error;
  }
}

async function getAudit(id) {
  ensureValidId(id);
  const exists = await Patient.exists({ _id: id });

  if (!exists) {
    throw notFound('Patient not found');
  }

  return AuditEntry.find({ entity: 'Patient', entityId: id })
    .sort({ at: -1 })
    .lean();
}

module.exports = {
  getPatient,
  updatePatient,
  getAudit
};
