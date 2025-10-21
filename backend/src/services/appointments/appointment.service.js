const Appointment = require('../../models/Appointment');
const AuditEntry = require('../../models/AuditEntry');
const { isSlotAvailable } = require('./availability.service');
const { canCancel, canReschedule } = require('./policy.service');
const { conflict, notFound, badRequest, forbidden } = require('../../utils/httpErrors');
const billingService = require('../billing/billing.service');
const { notifyAppointmentParticipants } = require('./notification.helpers');

async function logAudit(entityId, actorId, action, diff = []) {
  await AuditEntry.create({
    entity: 'Appointment',
    entityId,
    actorId,
    action,
    diff
  });
}

function ensureDate(value, field) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.valueOf())) {
    throw badRequest(`${field} must be a valid date`);
  }

  return date;
}

function normalizePatientId(value) {
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

function getLinkedPatientId(actor) {
  const linkedId = normalizePatientId(actor?.linkedPatientId);

  if (!linkedId) {
    throw forbidden('Your account is not linked to a patient record');
  }

  return linkedId;
}

function assertAppointmentOwnership(appointment, actor) {
  if (!actor || actor.role !== 'patient') {
    return;
  }

  const linkedId = getLinkedPatientId(actor);

  if (normalizePatientId(appointment.patientId) !== linkedId) {
    throw forbidden('Patients may only manage their own appointments');
  }
}

async function book(payload, actor = {}) {
  const { doctorId, reason } = payload;
  const actorId = actor?.id;
  const startsAt = ensureDate(payload.startsAt, 'startsAt');
  const endsAt = ensureDate(payload.endsAt, 'endsAt');

  const available = await isSlotAvailable(doctorId, startsAt);

  if (!available) {
    throw conflict('Selected time slot is no longer available');
  }

  let targetPatientId = payload.patientId;

  if (actor.role === 'patient') {
    const linkedId = getLinkedPatientId(actor);

    if (targetPatientId && normalizePatientId(targetPatientId) !== linkedId) {
      throw forbidden('Patients can only book appointments for themselves');
    }

    targetPatientId = linkedId;
  }

  if (!targetPatientId) {
    throw badRequest('patientId is required to book an appointment');
  }

  try {
    const appointment = await Appointment.create({
      patientId: targetPatientId,
      doctorId,
      department: payload.department,
      startsAt,
      endsAt,
      status: 'BOOKED',
      notes: reason,
      createdBy: actorId
    });

    await logAudit(appointment._id, actorId, 'booked', [
      { path: 'status', before: null, after: appointment.status }
    ]);

    // Fire-and-forget notifications
    try {
      await notifyAppointmentParticipants({ appointment, event: 'BOOKED', actor });
    } catch (_) {}

    return appointment.toObject();
  } catch (error) {
    if (error.code === 11000) {
      throw conflict('Selected time slot is already booked');
    }

    throw error;
  }
}

async function cancel(id, actor = {}) {
  const appointment = await Appointment.findById(id);

  if (!appointment) {
    throw notFound('Appointment not found');
  }

  assertAppointmentOwnership(appointment, actor);

  // Allow staff and doctors to override cutoff policy for administrative cancellations
  const isStaffOrDoctor = actor && (actor.role === 'staff' || actor.role === 'doctor');
  const policy = canCancel(appointment, new Date(), {
    allowApproved: isStaffOrDoctor,
    ignoreCutoff: isStaffOrDoctor
  });

  if (!policy.ok && !isStaffOrDoctor) {
    throw badRequest(policy.reason);
  }

  const previousStatus = appointment.status;
  appointment.status = 'CANCELLED';
  appointment.updatedBy = actor?.id;

  await appointment.save();

  await logAudit(appointment._id, actor?.id, 'cancelled', [
    { path: 'status', before: previousStatus, after: appointment.status }
  ]);

  try {
    await notifyAppointmentParticipants({ appointment, event: 'CANCELLED', actor });
  } catch (_) {}

  const responsePayload = appointment.toObject();

  if (actor?.role === 'staff') {
    await Appointment.deleteOne({ _id: appointment._id });
    return { ...responsePayload, deleted: true };
  }

  return appointment.toObject();
}

async function reschedule(id, newSlot, actor = {}) {
  const appointment = await Appointment.findById(id);

  if (!appointment) {
    throw notFound('Appointment not found');
  }

  assertAppointmentOwnership(appointment, actor);

  const policy = canReschedule(appointment, newSlot, new Date(), {
    ignoreCutoff: actor.role === 'staff',
    allowApproved: actor.role === 'staff'
  });

  if (!policy.ok) {
    throw badRequest(policy.reason);
  }

  const startsAt = ensureDate(newSlot.startsAt, 'startsAt');
  const endsAt = ensureDate(newSlot.endsAt, 'endsAt');

  let nextDoctorId = appointment.doctorId;

  if (newSlot.doctorId && String(newSlot.doctorId).trim()) {
    const requestedDoctorId = String(newSlot.doctorId).trim();

    if (requestedDoctorId !== appointment.doctorId && actor.role !== 'staff') {
      throw forbidden('Only staff can reassign doctors');
    }

    nextDoctorId = requestedDoctorId;
  }

  if (!nextDoctorId) {
    throw badRequest('doctorId must be provided for the appointment');
  }

  const available = await isSlotAvailable(nextDoctorId, startsAt, appointment._id);

  if (!available) {
    throw conflict('Requested slot is unavailable');
  }

  const previous = {
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    status: appointment.status,
    doctorId: appointment.doctorId
  };

  appointment.startsAt = startsAt;
  appointment.endsAt = endsAt;
  appointment.doctorId = nextDoctorId;
  appointment.status = 'RESCHEDULED';
  appointment.updatedBy = actor?.id;

  await appointment.save();

  await logAudit(appointment._id, actor?.id, 'rescheduled', [
    { path: 'startsAt', before: previous.startsAt, after: appointment.startsAt },
    { path: 'endsAt', before: previous.endsAt, after: appointment.endsAt },
    { path: 'status', before: previous.status, after: appointment.status },
    ...(previous.doctorId !== appointment.doctorId
      ? [{ path: 'doctorId', before: previous.doctorId, after: appointment.doctorId }]
      : [])
  ]);

  try {
    await notifyAppointmentParticipants({ appointment, event: 'RESCHEDULED', actor, previous });
  } catch (_) {}

  return appointment.toObject();
}

async function listUpcoming(limit = 20, actor = {}) {
  const query = {
    startsAt: { $gte: new Date() },
    status: { $ne: 'CANCELLED' }
  };

  if (actor.role === 'patient') {
    query.patientId = getLinkedPatientId(actor);
  }

  return Appointment.find(query)
    .sort({ startsAt: 1 })
    .limit(limit)
    .lean();
}

async function listForMe(actor = {}, query = {}) {
  const now = new Date()
  const range = String(query.range || 'all')
  const q = {}
  if (actor.role === 'patient') {
    q.patientId = getLinkedPatientId(actor)
  }
  if (range === 'upcoming') q.startsAt = { $gte: now }
  if (range === 'past') q.startsAt = { $lt: now }
  return Appointment.find(q).sort({ createdAt: -1, startsAt: -1 }).lean()
}

async function listForDoctor(actor = {}, query = {}) {
  if (actor.role !== 'doctor') {
    throw forbidden('Only doctors can view their schedule')
  }
  const doctorId = actor.profile?.doctorId
  if (!doctorId) {
    return []
  }
  const q = { doctorId }
  if (query.from || query.to) {
    q.startsAt = {}
    if (query.from) q.startsAt.$gte = new Date(query.from)
    if (query.to) q.startsAt.$lte = new Date(query.to)
  }
  return Appointment.find(q).sort({ startsAt: 1 }).lean()
}

async function listForAdmin(actor = {}, query = {}) {
  if (actor.role !== 'staff') {
    throw forbidden('Only staff can view all appointments')
  }
  const q = {}
  if (!query.includeCancelled && !query.status) {
    q.status = { $ne: 'CANCELLED' }
  }
  if (query.patientId) q.patientId = query.patientId
  if (query.doctorId) q.doctorId = query.doctorId
  if (query.status) q.status = query.status
  if (query.from || query.to) {
    q.startsAt = {}
    if (query.from) q.startsAt.$gte = new Date(query.from)
    if (query.to) q.startsAt.$lte = new Date(query.to)
  }
  return Appointment.find(q).sort({ startsAt: 1 }).lean()
}

async function approve(id, actor = {}) {
  if (!actor || (actor.role !== 'doctor' && actor.role !== 'staff')) {
    throw forbidden('Only staff or doctors can approve appointments');
  }

  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw notFound('Appointment not found');
  }

  const previousStatus = appointment.status;
  appointment.status = 'CONFIRMED';
  appointment.updatedBy = actor?.id;
  await appointment.save();

  await logAudit(appointment._id, actor?.id, 'approved', [
    { path: 'status', before: previousStatus, after: appointment.status }
  ]);

  await billingService.buildLatestBill(appointment.patientId, actor);

  try {
    await notifyAppointmentParticipants({ appointment, event: 'APPROVED', actor });
  } catch (_) {}

  return appointment.toObject();
}

async function reject(id, actor = {}) {
  if (!actor || (actor.role !== 'doctor' && actor.role !== 'staff')) {
    throw forbidden('Only staff or doctors can reject appointments');
  }

  const appointment = await Appointment.findById(id);
  if (!appointment) {
    throw notFound('Appointment not found');
  }

  const previousStatus = appointment.status;
  appointment.status = 'CANCELLED';
  appointment.updatedBy = actor?.id;
  await appointment.save();

  await logAudit(appointment._id, actor?.id, 'rejected', [
    { path: 'status', before: previousStatus, after: appointment.status }
  ]);

  try {
    await notifyAppointmentParticipants({ appointment, event: 'REJECTED', actor });
  } catch (_) {}

  return appointment.toObject();
}

module.exports = {
  book,
  cancel,
  reschedule,
  listUpcoming,
  listForMe,
  listForDoctor,
  listForAdmin,
  approve,
  reject
};
