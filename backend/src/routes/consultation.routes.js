const { Router } = require('express');
const { requireAuth, attachUser } = require('../middleware/auth.middleware');
const controller = require('../controllers/consultation.controller');

const router = Router();

router.get('/', requireAuth, attachUser, controller.list);
router.get('/:id', requireAuth, attachUser, controller.getById);
router.post('/', requireAuth, attachUser, controller.create);

module.exports = router;

