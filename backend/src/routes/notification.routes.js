const { Router } = require('express');
const { requireAuth, attachUser } = require('../middleware/auth.middleware');
const controller = require('../controllers/notification.controller');

const router = Router();

router.get('/', requireAuth, attachUser, controller.list);
router.post('/:id/read', requireAuth, attachUser, controller.markRead);
router.post('/read-all', requireAuth, attachUser, controller.markAllRead);

module.exports = router;

