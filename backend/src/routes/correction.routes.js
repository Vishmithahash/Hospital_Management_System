const { Router } = require('express');
const { requireAuth, attachUser } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const controller = require('../controllers/correction.controller');

const router = Router();

router.post('/patients/:id/corrections', requireAuth, attachUser, requireRole('patient'), controller.submit);
router.get('/patients/:id/corrections', requireAuth, attachUser, requireRole('patient', 'staff'), controller.list);
router.post('/corrections/:id/approve', requireAuth, attachUser, requireRole('staff'), controller.approve);
router.post('/corrections/:id/reject', requireAuth, attachUser, requireRole('staff'), controller.reject);

module.exports = router;

