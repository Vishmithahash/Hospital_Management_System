const { Router } = require('express')
const controller = require('../controllers/report.controller')
const { requireAuth, attachUser } = require('../middleware/auth.middleware')
const { requireRole } = require('../middleware/rbac.middleware')

const router = Router()
const managementRoles = ['doctor', 'staff', 'manager', 'admin']

router.get('/visits', requireAuth, attachUser, requireRole(...managementRoles), controller.getVisits)
router.get('/revenue', requireAuth, attachUser, requireRole(...managementRoles), controller.getRevenue)
router.get(
  '/appointments',
  requireAuth,
  attachUser,
  requireRole(...managementRoles),
  controller.getAppointmentsStatus
)
router.get('/export', requireAuth, attachUser, requireRole(...managementRoles), controller.exportReport)

module.exports = router
