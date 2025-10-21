const dayjs = require('dayjs');

const CANCEL_CUTOFF_HOURS = 12;
const APPROVED_STATUSES = ['CONFIRMED', 'APPROVED', 'ACCEPTED'];

function isWithinCutoff(dateTime, now) {
  return dayjs(dateTime).diff(dayjs(now), 'hour', true) < CANCEL_CUTOFF_HOURS;
}

function isApprovedStatus(status) {
  if (!status) return false;
  return APPROVED_STATUSES.includes(String(status).toUpperCase());
}

function canCancel(appointment, now = new Date(), options = {}) {
  if (!appointment) {
    return { ok: false, reason: 'Appointment not found' };
  }

  const allowApproved = Boolean(options.allowApproved);
  const ignoreCutoff = Boolean(options.ignoreCutoff);
  const approved = isApprovedStatus(appointment.status);

  if (appointment.status === 'CANCELLED') {
    return { ok: false, reason: 'Appointment already cancelled' };
  }

  if (approved && !allowApproved) {
    return { ok: false, reason: 'This appointment has been approved. Please contact the clinic for changes.' };
  }

  if (!ignoreCutoff && approved && isWithinCutoff(appointment.startsAt, now)) {
    return {
      ok: false,
      reason: `Cannot cancel within ${CANCEL_CUTOFF_HOURS} hours of appointment time`
    };
  }

  return { ok: true };
}

function canReschedule(appointment, newSlot, now = new Date(), options = {}) {
  if (!appointment) {
    return { ok: false, reason: 'Appointment not found' };
  }

  if (!newSlot?.startsAt || !newSlot?.endsAt) {
    return { ok: false, reason: 'New slot is incomplete' };
  }

  const allowApproved = Boolean(options.allowApproved);
  const ignoreCutoff = Boolean(options.ignoreCutoff);
  const approved = isApprovedStatus(appointment.status);

  if (approved && !allowApproved) {
    return { ok: false, reason: 'This appointment has been approved. Please contact the clinic for changes.' };
  }

  if (!ignoreCutoff && approved && isWithinCutoff(appointment.startsAt, now)) {
    return {
      ok: false,
      reason: `Cannot reschedule within ${CANCEL_CUTOFF_HOURS} hours of appointment time`
    };
  }

  if (!dayjs(newSlot.startsAt).isAfter(now)) {
    return { ok: false, reason: 'New slot must be in the future' };
  }

  if (!dayjs(newSlot.endsAt).isAfter(newSlot.startsAt)) {
    return { ok: false, reason: 'End time must be after start time' };
  }

  return { ok: true };
}

module.exports = {
  CANCEL_CUTOFF_HOURS,
  APPROVED_STATUSES,
  isApprovedStatus,
  canCancel,
  canReschedule
};
