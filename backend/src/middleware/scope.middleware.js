const Appointment = require('../models/Appointment');

function normalizeId(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value.toString === 'function') {
    return value.toString();
  }

  return String(value);
}

async function ensureDoctorCanAccess(patientId, doctorProfile) {
  if (!patientId) {
    return false;
  }

  const doctorId = normalizeId(doctorProfile?.doctorId);
  if (!doctorId) {
    return false;
  }

  const match = await Appointment.exists({
    doctorId,
    patientId: normalizeId(patientId),
    status: { $nin: ['CANCELLED'] }
  });

  return Boolean(match);
}

async function scopePatient(req, res, next) {
  if (!req.user) {
    res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Authentication required'
    });
    return;
  }

  const requestedId = normalizeId(req.params.id);

  if (!requestedId) {
    res.status(400).json({
      code: 'BAD_REQUEST',
      message: 'Patient id is required'
    });
    return;
  }

  if (req.user.role === 'patient') {
    const linkedId = normalizeId(req.user.linkedPatientId);

    if (!linkedId) {
      res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Your account is not linked to a patient record'
      });
      return;
    }

    if (requestedId === linkedId) {
      next();
      return;
    }

    res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Patients may only access their own record'
    });
    return;
  }

  if (req.user.role === 'doctor') {
    try {
      const allowed = await ensureDoctorCanAccess(requestedId, req.user.profile);
      if (!allowed) {
        res.status(403).json({
          code: 'FORBIDDEN',
          message: 'Doctors may only access records for their assigned patients'
        });
        return;
      }

      next();
      return;
    } catch (error) {
      next(error);
      return;
    }
  }

  if (req.user.role === 'staff' || req.user.role === 'manager' || req.user.role === 'admin') {
    next();
    return;
  }

  res.status(403).json({
    code: 'FORBIDDEN',
    message: 'Not permitted to access patient records'
  });
}

module.exports = {
  scopePatient
};
