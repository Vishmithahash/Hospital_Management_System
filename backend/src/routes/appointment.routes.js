const { Router } = require('express')
const controller = require('../controllers/appointment.controller')
const { requireAuth, attachUser } = require('../middleware/auth.middleware')
const { requireRole } = require('../middleware/rbac.middleware')

const router = Router()

router.get('/policy', requireAuth, attachUser, controller.getPolicy)
router.get('/:doctorId/slots', requireAuth, attachUser, controller.getAvailableSlots)
router.get('/', requireAuth, attachUser, controller.list)
router.get('/me', requireAuth, attachUser, controller.listMe)
router.get('/doctor/me', requireAuth, attachUser, controller.listDoctorMe)
router.get('/admin', requireAuth, attachUser, requireRole('staff'), controller.listAdmin)
router.post('/', requireAuth, attachUser, controller.book)
router.patch('/:id/cancel', requireAuth, attachUser, controller.cancel)
router.post('/:id/cancel', requireAuth, attachUser, controller.cancel)
router.delete('/:id', requireAuth, attachUser, controller.cancel)
router.patch('/:id/reschedule', requireAuth, attachUser, controller.reschedule)
router.post('/:id/reschedule', requireAuth, attachUser, controller.reschedule)
router.put('/:id/reschedule', requireAuth, attachUser, controller.reschedule)
router.patch('/:id/approve', requireAuth, attachUser, requireRole('doctor', 'staff'), controller.approve)
router.patch('/:id/reject', requireAuth, attachUser, requireRole('doctor', 'staff'), controller.reject)

module.exports = router
