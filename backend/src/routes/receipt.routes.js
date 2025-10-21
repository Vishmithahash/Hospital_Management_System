const { Router } = require('express');
const { requireAuth, attachUser } = require('../middleware/auth.middleware');
const controller = require('../controllers/receipt.controller');

const router = Router();

router.get('/:id', requireAuth, attachUser, controller.getReceipt);

module.exports = router;

