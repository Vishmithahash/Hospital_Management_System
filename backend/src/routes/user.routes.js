const { Router } = require('express');
const { requireAuth, attachUser } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/rbac.middleware');
const controller = require('../controllers/user.controller');
const { imageUpload } = require('../middleware/upload.middleware');

const router = Router();

router.get('/me', requireAuth, attachUser, controller.getMe);
router.put('/me/profile', requireAuth, attachUser, controller.updateProfile);
router.post('/link-patient', requireAuth, attachUser, requireRole('patient'), controller.linkPatient);
router.post('/me/profile/image', requireAuth, attachUser, imageUpload.single('image'), controller.uploadProfileImage);
router.get('/doctors', requireAuth, attachUser, controller.listDoctors);

module.exports = router;
