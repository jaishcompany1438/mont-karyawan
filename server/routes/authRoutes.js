const express = require('express');
const router = express.Router();
const { login, getMe } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { ipLoginLimiter, accountLoginLimiter } = require('../middleware/loginRateLimit');

router.post('/login', ipLoginLimiter, accountLoginLimiter, login);
router.get('/me', authenticateToken, getMe);

module.exports = router;
