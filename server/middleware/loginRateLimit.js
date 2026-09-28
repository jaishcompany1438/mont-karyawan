const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const windowMs = 15 * 60 * 1000;

const ipLoginLimiter = rateLimit({
  windowMs,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan login. Silakan coba lagi beberapa menit.'
  }
});

const accountLoginLimiter = rateLimit({
  windowMs,
  limit: 5,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : 'unknown';
    return `${ipKeyGenerator(req.ip)}:${email}`;
  },
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan login untuk akun ini. Silakan coba lagi beberapa menit.'
  }
});

module.exports = {
  ipLoginLimiter,
  accountLoginLimiter
};
