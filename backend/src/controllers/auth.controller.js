const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const { badRequest, conflict } = require('../utils/httpErrors');

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/i, 'Phone number is invalid'),
  email: z.string().trim().email(),
  password: z.string().min(8),
  role: z.enum(['patient', 'doctor', 'staff', 'manager', 'admin']).optional()
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8)
});

function toUserResponse(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    linkedPatientId: user.linkedPatientId ? user.linkedPatientId.toString() : null,
    profile: user.profile
  };
}

function signToken(user) {
  const linkedPatientId = user.linkedPatientId ? user.linkedPatientId.toString() : undefined;

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      linkedPatientId
    },
    env.JWT_SECRET,
    {
      expiresIn: '1h'
    }
  );
}

const register = asyncHandler(async (req, res) => {
  const payload = registerSchema.parse(req.body);

  const existing = await User.findOne({ email: payload.email });

  if (existing) {
    throw conflict('Email already registered');
  }

  const [firstName, ...rest] = payload.name.trim().split(/\s+/);
  const lastName = rest.join(' ');

  const passwordHash = await bcrypt.hash(payload.password, 10);

  let linkedPatientId = null;
  const role = payload.role || 'patient';

  if (role === 'patient') {
    const Patient = require('../models/Patient');
    const patient = await Patient.create({
      demographics: {
        firstName,
        lastName,
        phone: payload.phone,
        email: payload.email
      }
    });
    linkedPatientId = patient._id;
  }

  // Build profile with optional doctor fields
  const baseProfile = {
    firstName,
    lastName,
    phone: payload.phone
  };

  // Auto-generate a doctorId when creating doctor accounts
  if (role === 'doctor') {
    const random = Math.random().toString(36).slice(2, 7);
    baseProfile.doctorId = `doctor-${random}`;
  }

  const user = await User.create({
    email: payload.email,
    passwordHash,
    role,
    linkedPatientId,
    profile: baseProfile
  });

  res.status(201).json({
    user: toUserResponse(user)
  });
});

const login = asyncHandler(async (req, res) => {
  const payload = loginSchema.parse(req.body);
  const user = await User.findOne({ email: payload.email });

  if (!user) {
    throw badRequest('Invalid credentials');
  }

  const match = await bcrypt.compare(payload.password, user.passwordHash);

  if (!match) {
    throw badRequest('Invalid credentials');
  }

  const token = signToken(user);

  res.status(200).json({
    token,
    user: toUserResponse(user)
  });
});

const me = asyncHandler(async (req, res) => {
  if (!req.user) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    return;
  }

  res.status(200).json({
    user: toUserResponse(req.user)
  });
});

module.exports = {
  register,
  login,
  me,
  toUserResponse
};
