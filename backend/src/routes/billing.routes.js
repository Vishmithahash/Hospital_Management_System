const { Router } = require('express');
const { requireAuth, attachUser } = require('../middleware/auth.middleware');
const controller = require('../controllers/billing.controller');

const router = Router();

router.get(
  '/patient/:patientId/build-latest',
  requireAuth,
  attachUser,
  controller.buildLatest
);

router.get(
  '/patient/:patientId/current',
  requireAuth,
  attachUser,
  controller.getCurrent
);

module.exports = router;

