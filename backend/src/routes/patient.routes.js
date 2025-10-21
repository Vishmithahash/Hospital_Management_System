const { Router } = require('express');
const controller = require('../controllers/patient.controller');
const { requireAuth, attachUser } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const { scopePatient } = require('../middleware/scope.middleware');
const validate = require('../middleware/validate.middleware');
const { patientUpdateSchema } = require('../services/patients/validation.service');

const router = Router();

router.get(
  '/',
  requireAuth,
  attachUser,
  requireRole('doctor', 'staff'),
  controller.search
);
router.get(
  '/:id',
  requireAuth,
  attachUser,
  requireRole('doctor', 'staff', 'patient'),
  scopePatient,
  controller.getById
);
router.put(
  '/:id',
  requireAuth,
  attachUser,
  requireRole('doctor', 'staff'),
  validate(patientUpdateSchema),
  controller.update
);
router.get(
  '/:id/audit',
  requireAuth,
  attachUser,
  requireRole('doctor', 'staff'),
  controller.getAudit
);

module.exports = router;
