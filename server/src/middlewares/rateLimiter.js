const rateLimit = require('express-rate-limit');

// Chat / AI query rate limiter
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: {
    success: false,
    error: 'Too many queries sent from this client. Please wait a moment before asking again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication rate limiter (brute force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  chatLimiter,
  authLimiter,
  apiLimiter,
};
