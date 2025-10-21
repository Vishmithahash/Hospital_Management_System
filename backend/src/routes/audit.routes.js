const { Router } = require('express')
const { requireAuth, attachUser } = require('../middleware/auth.middleware')
const controller = require('../controllers/audit.controller')

const router = Router()

router.get('/', requireAuth, attachUser, controller.listMine)

module.exports = router