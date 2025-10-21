const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const User = require('../../models/User');
const Appointment = require('../../models/Appointment');
const Payment = require('../../models/Payment');

dayjs.extend(utc);
dayjs.extend(timezone);
const TZ = 'Asia/Colombo';

function normalizeRange(range) {
  const from = dayjs.tz(range.from, TZ).startOf('day');
  const to = dayjs.tz(range.to, TZ).endOf('day');
  return {
    from: from.toDate(),
    to: to.toDate(),
    fromStr: from.format('YYYY-MM-DD'),
    toStr: to.format('YYYY-MM-DD')
  };
}

async function listOptions() {
  // Departments derived from appointments; Doctors from users; Branches static for demo
  const departments = await Appointment.distinct('department');
  const doctors = await User.find({ role: 'doctor' }).select('profile').lean();
  const doctorOpts = doctors
    .filter((d) => d.profile?.doctorId)
    .map((d) => ({ id: d.profile.doctorId, name: [d.profile.firstName, d.profile.lastName].filter(Boolean).join(' ') }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const branches = ['Colombo', 'Kandy'];
  return { departments: departments.filter(Boolean).sort(), branches, doctors: doctorOpts };
}

async function ensureFilterValidity(filters = {}) {
  // Validate doctor existence if provided
  if (filters.doctorId) {
    const exists = await User.exists({ role: 'doctor', 'profile.doctorId': filters.doctorId });
    if (!exists) {
      const err = new Error('Doctor not found');
      err.code = 'INVALID_DOCTOR_ID';
      err.status = 400;
      throw err;
    }
  }
  // Department validity: if provided, ensure at least one appointment uses it (minimal check)
  if (filters.departmentId) {
    const exists = await Appointment.exists({ department: filters.departmentId });
    if (!exists) {
      const err = new Error('Department not found');
      err.code = 'INVALID_DEPARTMENT_ID';
      err.status = 400;
      throw err;
    }
  }
  // Branch is not modeled; accept Colombo/Kandy for demos when provided
  if (filters.branchId && !['Colombo', 'Kandy'].includes(filters.branchId)) {
    const err = new Error('Branch not found');
    err.code = 'INVALID_BRANCH_ID';
    err.status = 400;
    throw err;
  }
}

async function dailyVisits(range, filters = {}) {
  const { from, to } = normalizeRange(range);
  const match = { startsAt: { $gte: from, $lte: to } };
  if (filters.departmentId) match.department = filters.departmentId;
  if (filters.doctorId) match.doctorId = filters.doctorId;
  const allowed = ['COMPLETED', 'BOOKED', 'ACCEPTED', 'APPROVED', 'CONFIRMED'];
  match.status = { $in: allowed };

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          day: { $dateToString: { date: '$startsAt', format: '%Y-%m-%d', timezone: TZ } }
        },
        patients: { $addToSet: '$patientId' }
      }
    },
    { $project: { _id: 0, day: '$_id.day', visits: { $size: '$patients' } } },
    { $sort: { day: 1 } }
  ];

  const rows = await Appointment.aggregate(pipeline);
  return rows;
}

async function appointmentLoad(range, filters = {}) {
  const { from, to } = normalizeRange(range);
  const match = { startsAt: { $gte: from, $lte: to } };
  if (filters.departmentId) match.department = filters.departmentId;
  if (filters.doctorId) match.doctorId = filters.doctorId;

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          day: { $dateToString: { date: '$startsAt', format: '%Y-%m-%d', timezone: TZ } },
          status: '$status'
        },
        cnt: { $sum: 1 }
      }
    },
    { $project: { _id: 0, day: '$_id.day', status: '$_id.status', cnt: 1 } },
    { $sort: { day: 1 } }
  ];
  const grouped = await Appointment.aggregate(pipeline);

  // Pivot by day
  const dayMap = new Map();
  const statuses = [
    'PENDING',
    'APPROVED',
    'ACCEPTED',
    'BOOKED',
    'CONFIRMED',
    'CANCELLED',
    'COMPLETED',
    'NO_SHOW',
    'RESCHEDULED'
  ];

  for (const row of grouped) {
    const rec = dayMap.get(row.day) || { day: row.day };
    rec[row.status] = (rec[row.status] || 0) + row.cnt;
    dayMap.set(row.day, rec);
  }
  const rows = Array.from(dayMap.values()).sort((a, b) => a.day.localeCompare(b.day));
  // Ensure all statuses present
  for (const r of rows) for (const s of statuses) r[s] = r[s] || 0;
  return { rows, statuses };
}

async function peakHours(range, filters = {}) {
  const { from, to } = normalizeRange(range);
  const match = { startsAt: { $gte: from, $lte: to } };
  if (filters.departmentId) match.department = filters.departmentId;
  if (filters.doctorId) match.doctorId = filters.doctorId;

  const pipeline = [
    { $match: match },
    {
      $addFields: {
        parts: { $dateToParts: { date: '$startsAt', timezone: TZ } }
      }
    },
    { $group: { _id: '$parts.hour', cnt: { $sum: 1 } } },
    { $project: { _id: 0, hour: '$_id', cnt: 1 } },
    { $sort: { hour: 1 } }
  ];
  const data = await Appointment.aggregate(pipeline);
  const arr = Array.from({ length: 24 }, (_, h) => ({ hour: h, cnt: 0 }));
  for (const r of data) if (r.hour >= 0 && r.hour <= 23) arr[r.hour].cnt = r.cnt;
  return arr;
}

async function paymentSummary(range, filters = {}) {
  const { from, to } = normalizeRange(range);
  const match = { status: 'SUCCESS', createdAt: { $gte: from, $lte: to } };
  if (filters.paymentMethod) match.method = filters.paymentMethod;

  const pipeline = [
    { $match: match },
    {
      $lookup: {
        from: 'billitems',
        localField: 'billId',
        foreignField: 'billId',
        as: 'billItem'
      }
    },
    { $unwind: { path: '$billItem', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'appointments',
        localField: 'billItem.appointmentId',
        foreignField: '_id',
        as: 'appointment'
      }
    },
    { $unwind: { path: '$appointment', preserveNullAndEmptyArrays: true } }
  ];

  const appointmentMatch = {};
  if (filters.doctorId) appointmentMatch['appointment.doctorId'] = filters.doctorId;
  if (filters.departmentId) appointmentMatch['appointment.department'] = filters.departmentId;
  if (Object.keys(appointmentMatch).length) pipeline.push({ $match: appointmentMatch });

  pipeline.push(
    {
      $group: {
        _id: '$_id',
        method: { $first: '$method' },
        amount: { $first: '$amount' }
      }
    },
    {
      $group: {
        _id: '$method',
        tx_count: { $sum: 1 },
        total_lkr: { $sum: '$amount' },
        avg_ticket: { $avg: '$amount' }
      }
    },
    {
      $project: {
        _id: 0,
        method: '$_id',
        tx_count: 1,
        total_lkr: { $round: ['$total_lkr', 2] },
        avg_ticket: { $round: ['$avg_ticket', 2] }
      }
    },
    { $sort: { method: 1 } }
  );

  const rows = await Payment.aggregate(pipeline);
  return rows;
}

module.exports = {
  TZ,
  normalizeRange,
  listOptions,
  ensureFilterValidity,
  dailyVisits,
  appointmentLoad,
  peakHours,
  paymentSummary
};

