const bcrypt = require('bcrypt');
const dayjs = require('dayjs');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Config = require('../models/Config');
const Notification = require('../models/Notification');

const USERS = [
  {
    email: 'doctor1@example.com',
    password: 'Doctor@123',
    role: 'doctor',
    profile: { firstName: 'Maya', lastName: 'Fernando', doctorId: 'doctor-100', specialty: 'General Medicine' }
  },
  {
    email: 'staff1@example.com',
    password: 'Staff@123',
    role: 'staff',
    profile: { firstName: 'Sanjaya', lastName: 'Perera' }
  },
  {
    email: 'patient1@example.com',
    password: 'Patient@123',
    role: 'patient',
    profile: { firstName: 'Ishara', lastName: 'Wijesinghe', phone: '+94 71 555 0100' }
  }
  ,
  {
    email: 'manager1@example.com',
    password: 'Manager@123',
    role: 'manager',
    profile: { firstName: 'Jane', lastName: 'Doe' }
  }
];

async function ensureConfig() {
  await Config.updateOne(
    { key: 'billing.baseFee' },
    { $set: { value: { currency: 'LKR', amount: 2000 } } },
    { upsert: true }
  );
}

async function ensureUser(userDef) {
  let user = await User.findOne({ email: userDef.email });
  if (!user) {
    const passwordHash = await bcrypt.hash(userDef.password, 10);
    user = await User.create({
      email: userDef.email,
      role: userDef.role,
      passwordHash,
      profile: userDef.profile || null
    });
  } else if (userDef.role === 'doctor' && (!user.profile || !user.profile.doctorId)) {
    user.profile = { ...(user.profile || {}), ...userDef.profile };
    await user.save();
  }
  return user;
}

async function seedUsers() {
  await ensureConfig();

  const doctor = await ensureUser(USERS[0]);
  const staff = await ensureUser(USERS[1]);
  let patientUser = await User.findOne({ email: USERS[2].email });
  if (process.env.NODE_ENV !== 'test') {
    await ensureUser(USERS[3]);
  }
  let patientRecord;

  if (!patientUser) {
    const passwordHash = await bcrypt.hash(USERS[2].password, 10);
    patientRecord = await Patient.create({
      demographics: {
        firstName: USERS[2].profile.firstName,
        lastName: USERS[2].profile.lastName,
        phone: USERS[2].profile.phone,
        email: USERS[2].email
      },
      insurance: {
        provider: 'SunLife Assurance',
        policyNo: 'SL-2024-5521',
        validUntil: dayjs().add(1, 'year').toDate()
      },
      governmentEligible: false
    });

    patientUser = await User.create({
      email: USERS[2].email,
      role: 'patient',
      passwordHash,
      linkedPatientId: patientRecord._id,
      profile: USERS[2].profile
    });

    await Notification.create({
      userId: patientUser._id,
      type: 'RECORD_UPDATED',
      payload: { message: 'Welcome to Smart Healthcare. Your patient record is ready.' },
      audienceRole: 'patient',
      isRead: false
    });
  } else {
    patientRecord = await Patient.findById(patientUser.linkedPatientId);
    if (!patientRecord) {
      patientRecord = await Patient.create({
        demographics: {
          firstName: USERS[2].profile.firstName,
          lastName: USERS[2].profile.lastName,
          phone: USERS[2].profile.phone,
          email: USERS[2].email
        },
        insurance: {
          provider: 'SunLife Assurance',
          policyNo: 'SL-2024-5521',
          validUntil: dayjs().add(1, 'year').toDate()
        },
        governmentEligible: false
      });
      patientUser.linkedPatientId = patientRecord._id;
      await patientUser.save();
    }
  }

  await ensureAppointments({ patient: patientRecord, doctorUser: doctor });

  return {
    doctor,
    staff,
    patientUser
  };
}

async function ensureAppointments({ patient, doctorUser }) {
  const doctorId = doctorUser.profile?.doctorId || 'doctor-100';

  const existing = await Appointment.find({
    patientId: patient._id.toString(),
    doctorId,
    status: { $in: ['APPROVED', 'ACCEPTED', 'CONFIRMED'] }
  });

  if (existing.length >= 2) {
    return;
  }

  const slots = [
    {
      startsAt: dayjs().hour(10).minute(0).second(0).toDate(),
      endsAt: dayjs().hour(10).minute(30).second(0).toDate()
    },
    {
      startsAt: dayjs().add(1, 'day').hour(11).minute(0).second(0).toDate(),
      endsAt: dayjs().add(1, 'day').hour(11).minute(30).second(0).toDate()
    }
  ];

  await Promise.all(
    slots.map((slot) =>
      Appointment.create({
        patientId: patient._id.toString(),
        doctorId,
        department: 'General Medicine',
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: 'APPROVED'
      })
    )
  );
}

module.exports = {
  seedUsers,
  USERS
};
