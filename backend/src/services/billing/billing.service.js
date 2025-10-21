const mongoose = require('mongoose');
const Bill = require('../../models/Bill');
const BillItem = require('../../models/BillItem');
const Appointment = require('../../models/Appointment');
const Patient = require('../../models/Patient');
const Config = require('../../models/Config');
const { forbidden, notFound } = require('../../utils/httpErrors');

const DEFAULT_BASE_FEE = 2000;
const INSURANCE_DISCOUNT_RATE = 0.25;

async function resolveBaseFee() {
  const config = await Config.findOne({ key: 'billing.baseFee' }).lean();
  return config?.value?.amount || DEFAULT_BASE_FEE;
}

function assertPatientAccess(patientId, actor) {
  if (!actor) return;
  if (actor.role === 'patient') {
    if (actor.linkedPatientId?.toString() !== patientId.toString()) {
      throw forbidden('Patients may only access their own billing records');
    }
  }
}

async function listDoctorPatients(doctorUser, patientId) {
  if (!doctorUser?.profile?.doctorId) {
    throw forbidden('Doctor profile incomplete');
  }

  const existing = await Appointment.exists({
    doctorId: doctorUser.profile.doctorId,
    patientId: patientId.toString()
  });

  if (!existing) {
    throw forbidden('Doctor may only view billing for their patients');
  }
}

async function hydratePatient(patientId) {
  const patient = await Patient.findById(patientId).lean();
  if (!patient) {
    throw notFound('Patient not found');
  }
  return patient;
}

function pickEligibleStatuses() {
  return ['APPROVED', 'ACCEPTED', 'CONFIRMED'];
}

function describeAppointment(appointment) {
  const date = new Date(appointment.startsAt);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `Consultation with Dr. ${appointment.doctorId} @ ${time}`;
}

async function buildBillItems({ patientId, baseFee }) {
  const statuses = pickEligibleStatuses();
  const appointments = await Appointment.find({
    patientId: patientId.toString(),
    status: { $in: statuses }
  })
    .sort({ startsAt: 1 })
    .lean();

  if (!appointments.length) {
    return [];
  }

  const billedAppointmentIds = await BillItem.find({
    appointmentId: { $in: appointments.map((appt) => appt._id) }
  })
    .distinct('appointmentId')
    .lean();

  const billedSet = new Set(billedAppointmentIds.map((id) => id.toString()));

  return appointments
    .filter((appt) => !billedSet.has(appt._id.toString()))
    .map((appt) => ({
      appointmentId: appt._id,
      description: describeAppointment(appt),
      unitPrice: baseFee
    }));
}

function computeFinancials(items, patient) {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice, 0);
  const insuranceEligible = patient?.insurance?.provider;
  const insuranceDiscount = insuranceEligible ? subtotal * INSURANCE_DISCOUNT_RATE : 0;
  const cappedInsuranceDiscount = Math.min(insuranceDiscount, subtotal);

  let governmentCover = 0;
  let totalPayable = subtotal - cappedInsuranceDiscount;

  if (patient?.governmentEligible) {
    governmentCover = totalPayable;
    totalPayable = 0;
  }

  return {
    subtotal,
    insuranceDiscount: cappedInsuranceDiscount,
    governmentCover,
    totalPayable
  };
}

async function buildLatestBill(patientId, actor) {
  assertPatientAccess(patientId, actor);
  if (actor?.role === 'doctor') {
    await listDoctorPatients(actor, patientId);
  }

  const patient = await hydratePatient(patientId);
  const baseFee = await resolveBaseFee();

  const items = await buildBillItems({ patientId, baseFee });

  if (!items.length) {
    // Clean up empty pending bills for this patient
    const pendingBills = await Bill.find({ patientId, status: 'PENDING' }).lean();
    const pendingIds = pendingBills.map((b) => b._id);
    if (pendingIds.length) {
      await Bill.deleteMany({ _id: { $in: pendingIds } });
      await BillItem.deleteMany({ billId: { $in: pendingIds } });
    }
    return null;
  }

  const financials = computeFinancials(items, patient);

  let bill = await Bill.findOne({ patientId, status: 'PENDING' });
  if (!bill) {
    bill = await Bill.create({
      patientId,
      subtotal: financials.subtotal,
      insuranceDiscount: financials.insuranceDiscount,
      governmentCover: financials.governmentCover,
      totalPayable: financials.totalPayable
    });
  } else {
    bill.subtotal = financials.subtotal;
    bill.insuranceDiscount = financials.insuranceDiscount;
    bill.governmentCover = financials.governmentCover;
    bill.totalPayable = financials.totalPayable;
    await bill.save();
    await BillItem.deleteMany({ billId: bill._id });
  }

  const records = items.map((item) => ({
    billId: bill._id,
    appointmentId: item.appointmentId,
    description: item.description,
    unitPrice: item.unitPrice,
    insuranceDiscount: patient.insurance?.provider ? item.unitPrice * INSURANCE_DISCOUNT_RATE : 0,
    lineTotal: patient.governmentEligible ? 0 : item.unitPrice * (patient.insurance?.provider ? 1 - INSURANCE_DISCOUNT_RATE : 1)
  }));

  await BillItem.insertMany(records);

  const billWithItems = await fetchBillWithItems(bill._id);
  return billWithItems;
}

async function fetchBillWithItems(billId) {
  const bill = await Bill.findById(billId).lean();
  if (!bill) return null;
  const items = await BillItem.find({ billId }).sort({ createdAt: 1 }).lean();
  return { ...bill, items };
}

async function getCurrentBill(patientId, actor) {
  assertPatientAccess(patientId, actor);

  if (actor?.role === 'doctor') {
    await listDoctorPatients(actor, patientId);
  }

  const bill = await Bill.findOne({ patientId, status: 'PENDING' }).sort({ createdAt: -1 }).lean();
  if (bill) {
    const items = await BillItem.find({ billId: bill._id }).sort({ createdAt: 1 }).lean();
    return { ...bill, items };
  }

  const lastPaid = await Bill.findOne({ patientId, status: 'PAID' }).sort({ updatedAt: -1 }).lean();
  if (!lastPaid) {
    return null;
  }

  const items = await BillItem.find({ billId: lastPaid._id }).sort({ createdAt: 1 }).lean();
  return { ...lastPaid, items };
}

async function markBillPaid(billId, amount) {
  const bill = await Bill.findById(billId);
  if (!bill) throw notFound('Bill not found');
  bill.status = 'PAID';
  bill.totalPayable = 0;
  if (typeof amount === 'number') {
    bill.governmentCover = bill.governmentCover || 0;
  }
  await bill.save();
  return bill;
}

module.exports = {
  buildLatestBill,
  getCurrentBill,
  markBillPaid,
  resolveBaseFee,
  computeFinancials,
  hydratePatient,
  assertPatientAccess,
  listDoctorPatients,
  fetchBillWithItems,
  INSURANCE_DISCOUNT_RATE
};
