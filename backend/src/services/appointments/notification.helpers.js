const dayjs = require('dayjs');
const Notification = require('../../models/Notification');
const User = require('../../models/User');

function formatNameFromUser(user, fallback) {
  if (!user) return fallback;
  const first = user.profile?.firstName;
  const last = user.profile?.lastName;
  const name = [first, last].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (user.email) return user.email;
  return fallback;
}

function formatNameFromActor(actor, fallback) {
  if (!actor) return fallback;
  const first = actor.profile?.firstName;
  const last = actor.profile?.lastName;
  const name = [first, last].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (actor.email) return actor.email;
  if (actor.role) return actor.role;
  return fallback;
}

function formatDateTime(value) {
  if (!value) return null;
  return dayjs(value).format('MMM D, YYYY h:mm A');
}

function buildMessage(event, context) {
  const start = formatDateTime(context.startsAt) || 'the scheduled time';
  const previousStart = formatDateTime(context.previous?.startsAt);
  const doctorName = context.doctorName || 'the doctor';
  const patientName = context.patientName || 'the patient';
  const actorName = context.actorRole === context.recipient ? 'You' : context.actorName || 'a team member';
  const movedFrom = previousStart ? ` (previously ${previousStart})` : '';

  switch (event) {
    case 'BOOKED':
      return context.recipient === 'doctor'
        ? `${patientName} booked an appointment for ${start}.`
        : `Your appointment with ${doctorName} is booked for ${start}.`;
    case 'APPROVED':
      return context.recipient === 'doctor'
        ? `${actorName} approved the visit with ${patientName} on ${start}.`
        : `Your appointment with ${doctorName} on ${start} was approved.`;
    case 'RESCHEDULED':
      if (context.recipient === 'doctor') {
        return `${actorName} moved the appointment with ${patientName} to ${start}${movedFrom}.`;
      }
      return `${actorName} rescheduled your appointment with ${doctorName} to ${start}${movedFrom}.`;
    case 'CANCELLED':
      if (context.recipient === 'doctor') {
        return `${actorName} cancelled the appointment with ${patientName} scheduled for ${start}.`;
      }
      return `${actorName} cancelled your appointment with ${doctorName} for ${start}.`;
    case 'REJECTED':
      return context.recipient === 'doctor'
        ? `${actorName} rejected the appointment with ${patientName} set for ${start}.`
        : `Your appointment with ${doctorName} on ${start} was rejected.`;
    default:
      return `Update for the appointment on ${start}.`;
  }
}

async function notifyAppointmentParticipants({ appointment, event, actor, previous = {} }) {
  const [patientUser, doctorUser] = await Promise.all([
    appointment.patientId ? User.findOne({ linkedPatientId: appointment.patientId }).lean() : null,
    appointment.doctorId
      ? User.findOne({ role: 'doctor', 'profile.doctorId': appointment.doctorId }).lean()
      : null
  ]);

  const actorName = formatNameFromActor(actor, 'Clinic staff');
  const actorRole = actor?.role || 'staff';
  const patientName = formatNameFromUser(patientUser, `Patient ${appointment.patientId || ''}`.trim());
  const doctorBaseName = formatNameFromUser(doctorUser, appointment.doctorId || 'Doctor');
  const doctorName = doctorBaseName.toLowerCase().startsWith('dr.') ? doctorBaseName : `Dr. ${doctorBaseName}`;

  const basePayload = {
    scope: 'appointment',
    appointmentId: appointment._id,
    event,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    status: appointment.status,
    previous: {
      startsAt: previous.startsAt || null,
      endsAt: previous.endsAt || null,
      doctorId: previous.doctorId || null
    },
    actorRole,
    actorName,
    patientName,
    doctorName
  };

  const operations = [];

  if (patientUser?._id) {
    operations.push(
      Notification.create({
        userId: patientUser._id,
        type: 'RECORD_UPDATED',
        payload: {
          ...basePayload,
          recipient: 'patient',
          message: buildMessage(event, {
            ...basePayload,
            recipient: 'patient'
          })
        },
        audienceRole: 'patient'
      })
    );
  }

  if (doctorUser?._id) {
    operations.push(
      Notification.create({
        userId: doctorUser._id,
        type: 'RECORD_UPDATED',
        payload: {
          ...basePayload,
          recipient: 'doctor',
          message: buildMessage(event, {
            ...basePayload,
            recipient: 'doctor'
          })
        },
        audienceRole: 'doctor'
      })
    );
  }

  if (!operations.length) return;

  await Promise.allSettled(operations);
}

module.exports = {
  notifyAppointmentParticipants
};
