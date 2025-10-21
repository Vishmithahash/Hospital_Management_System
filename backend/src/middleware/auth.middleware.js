const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');

function buildUnauthorizedResponse(res, message = 'Authentication required') {
  res.status(401).json({
    code: 'UNAUTHORIZED',
    message
  });
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return null;
}

function decodeToken(token) {
  const payload = jwt.verify(token, env.JWT_SECRET);
  return {
    userId: payload.sub,
    email: payload.email,
    role: payload.role,
    linkedPatientId: payload.linkedPatientId || null
  };
}

function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    buildUnauthorizedResponse(res);
    return;
  }

  try {
    req.auth = decodeToken(token);
    req.user = {
      id: req.auth.userId,
      role: req.auth.role,
      email: req.auth.email,
      linkedPatientId: req.auth.linkedPatientId
    };
    next();
  } catch (error) {
    buildUnauthorizedResponse(res, 'Invalid or expired token');
  }
}

function optionalAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    req.auth = decodeToken(token);
    req.user = {
      id: req.auth.userId,
      role: req.auth.role,
      email: req.auth.email,
      linkedPatientId: req.auth.linkedPatientId
    };
  } catch (error) {
    // ignore invalid token for optional auth
  }

  next();
}

async function attachUser(req, res, next) {
  if (!req.auth?.userId) {
    return next();
  }

  try {
    const user = await User.findById(req.auth.userId).lean();

    if (!user) {
      buildUnauthorizedResponse(res, 'User not found');
      return;
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      linkedPatientId: user.linkedPatientId ? user.linkedPatientId.toString() : null,
      profile: user.profile
    };

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requireAuth,
  optionalAuth,
  attachUser
};
