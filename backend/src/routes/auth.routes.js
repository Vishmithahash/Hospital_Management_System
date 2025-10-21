const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { requireAuth, attachUser } = require('../middleware/auth.middleware');

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', requireAuth, attachUser, authController.me);

module.exports = router;
