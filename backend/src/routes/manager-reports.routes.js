const { Router } = require('express');
const { requireAuth, attachUser } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const controller = require('../modules/reports/controller');

const router = Router();

// Manager-only reports module endpoints
router.get(
  '/options',
  requireAuth,
  attachUser,
  requireRole('manager'),
  controller.getOptions
);

router.post(
  '/generate',
  requireAuth,
  attachUser,
  requireRole('manager'),
  controller.generate
);

router.post(
  '/export',
  requireAuth,
  attachUser,
  requireRole('manager'),
  controller.exportReport
);

module.exports = router;

