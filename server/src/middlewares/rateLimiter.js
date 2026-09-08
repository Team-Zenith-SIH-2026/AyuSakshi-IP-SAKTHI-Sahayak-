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
  max: process.env.NODE_ENV === 'development' ? 500 : 30, // Relaxed limit for dev/testing
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'development',
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
