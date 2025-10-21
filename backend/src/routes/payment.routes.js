const { Router } = require('express');
const { requireAuth, attachUser } = require('../middleware/auth.middleware');
const controller = require('../controllers/payment.controller');
const { requireRole } = require('../middleware/rbac.middleware');

const router = Router();

router.post(
  '/card',
  requireAuth,
  attachUser,
  controller.payByCard
);

router.post(
  '/cash',
  requireAuth,
  attachUser,
  requireRole('staff', 'manager', 'admin'),
  controller.payByCash
);

router.post(
  '/government',
  requireAuth,
  attachUser,
  requireRole('staff', 'manager', 'admin'),
  controller.payByGovernment
);

module.exports = router;
