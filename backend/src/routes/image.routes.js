const { Router } = require('express');
const { requireAuth, attachUser } = require('../middleware/auth.middleware');
const controller = require('../controllers/image.controller');
const { imageUpload } = require('../middleware/upload.middleware');

const router = Router();

router.get('/', requireAuth, attachUser, controller.list);
router.get('/:id', requireAuth, attachUser, controller.getById);
router.post('/', requireAuth, attachUser, controller.create);
router.post('/upload', requireAuth, attachUser, imageUpload.single('file'), controller.upload);

module.exports = router;
