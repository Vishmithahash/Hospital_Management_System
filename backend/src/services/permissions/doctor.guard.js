const Appointment = require('../../models/Appointment');

async function ensureDoctorCanWrite(patientId, doctorId, now = new Date()) {
  if (!patientId || !doctorId) return false;

  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const match = await Appointment.findOne({
    patientId: String(patientId),
    doctorId: String(doctorId),
    status: { $in: ['BOOKED', 'CONFIRMED', 'RESCHEDULED'] },
    startsAt: { $gte: start, $lte: end }
  }).lean();

  return Boolean(match);
}

module.exports = { ensureDoctorCanWrite };

