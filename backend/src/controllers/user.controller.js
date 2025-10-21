const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const Patient = require('../models/Patient');
const { z } = require('zod');
const { conflict, badRequest } = require('../utils/httpErrors');
const { toUserResponse } = require('./auth.controller');
const path = require('path');

const profileSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/i, 'Phone number is invalid')
    .optional(),
  address: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().url().optional(),
  age: z.coerce.number().int().min(0).max(130).optional(),
  doctorId: z.string().trim().min(1).optional(),
  specialty: z.string().trim().min(1).optional()
});

const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ user: toUserResponse(req.user) });
});

const updateProfile = asyncHandler(async (req, res) => {
  const payload = profileSchema.parse(req.body);

  const user = await User.findById(req.user.id);
  if (!user) {
    throw badRequest('User not found');
  }

  user.profile = { ...(user.profile || {}), ...payload };
  await user.save();

  res.status(200).json({ user: toUserResponse(user) });
});

const linkPatient = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    throw badRequest('User not found');
  }

  if (user.role !== 'patient') {
    throw badRequest('Only patient accounts can be linked');
  }

  if (user.linkedPatientId) {
    return res.status(200).json({ user: toUserResponse(user) });
  }

  const firstName = user.profile?.firstName || user.email.split('@')[0];
  const lastName = user.profile?.lastName || '';

  const patient = await Patient.create({
    demographics: {
      firstName,
      lastName,
      phone: user.profile?.phone,
      email: user.email
    }
  });

  user.linkedPatientId = patient._id;
  await user.save();

  res.status(201).json({ user: toUserResponse(user) });
});

module.exports = {
  getMe,
  updateProfile,
  linkPatient
};

// Attach after exports for reuse
const uploadResponseShape = (user) => ({ user: toUserResponse(user) });

// POST /users/me/profile/image
module.exports.uploadProfileImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw badRequest('No image uploaded');
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    throw badRequest('User not found');
  }

  const relative = `/uploads/${path.basename(req.file.path)}`;
  user.profile = { ...(user.profile || {}), imageUrl: relative };
  await user.save();

  res.status(200).json(uploadResponseShape(user));
});

// GET /users/doctors
module.exports.listDoctors = asyncHandler(async (req, res) => {
  const users = await User.find({ role: 'doctor' }).lean();
  const doctors = users.map((u) => ({
    id: u.profile?.doctorId || u._id.toString(),
    name: [u.profile?.firstName, u.profile?.lastName].filter(Boolean).join(' ') || u.email,
    specialty: u.profile?.specialty || null
  }));

  res.status(200).json(doctors);
});
