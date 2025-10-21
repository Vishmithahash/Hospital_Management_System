const dayjs = require('dayjs');
const Appointment = require('../../models/Appointment');
const DoctorRosterSlot = require('../../models/DoctorRosterSlot');

async function isSlotAvailable(doctorId, startsAt, excludeAppointmentId) {
  const query = {
    doctorId,
    startsAt
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  const count = await Appointment.countDocuments(query);

  return count === 0;
}

async function getAvailableSlots(doctorId, day) {
  if (!doctorId || !day) {
    return [];
  }

  const startOfDay = dayjs(day).startOf('day');
  const endOfDay = startOfDay.add(1, 'day');

  // Load roster slots (if any) else fallback 09:00-17:00
  const roster = await DoctorRosterSlot.find({
    doctorId,
    startAt: { $gte: startOfDay.toDate(), $lt: endOfDay.toDate() }
  })
    .sort({ startAt: 1 })
    .lean();

  let ranges = roster.length
    ? roster
        .filter((r) => !r.isBlocked)
        .map((r) => ({ start: dayjs(r.startAt), end: dayjs(r.endAt) }))
    : [{ start: startOfDay.add(9, 'hour'), end: startOfDay.add(17, 'hour') }];

  const appts = await Appointment.find({
    doctorId,
    startsAt: { $gte: startOfDay.toDate(), $lt: endOfDay.toDate() },
    status: { $nin: ['CANCELLED'] }
  })
    .select('startsAt')
    .lean();

  const taken = new Set(appts.map((a) => dayjs(a.startsAt).toISOString()));

  const slots = [];
  for (const range of ranges) {
    let cursor = range.start;
    while (cursor.isBefore(range.end)) {
      const slotStart = cursor;
      const slotEnd = cursor.add(30, 'minute');
      if (slotEnd.isAfter(range.end)) break;
      const id = slotStart.toISOString();
      slots.push({
        startsAt: id,
        endsAt: slotEnd.toISOString(),
        available: !taken.has(id)
      });
      cursor = slotEnd;
    }
  }

  return slots.sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
}

module.exports = {
  isSlotAvailable,
  getAvailableSlots
};
