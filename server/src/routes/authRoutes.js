const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimiter');
const passport = require('../config/passport');

const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
const oauthFailureRedirect = `${clientUrl}/auth/callback?error=oauth_failed`;

const startOAuth = (provider, options) => (req, res, next) => {
  if (!passport._strategy(provider)) {
    return res.redirect(`${clientUrl}/auth/callback?error=${provider}_not_configured`);
  }
  return passport.authenticate(provider, options)(req, res, next);
};

// Local Auth
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/profile', authenticate, authController.getProfile);

// Password Management & Reset
router.post('/change-password', authenticate, authLimiter, authController.changePassword);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/verify-reset-code', authLimiter, authController.verifyResetCode);
router.post('/reset-password', authLimiter, authController.resetPassword);

// Social Auth Mock / Direct API endpoint (For frontend social flow)
router.post('/social', authLimiter, authController.socialAuth);

// Google OAuth Routes (if configured)
router.get('/google', startOAuth('google', { scope: ['profile', 'email'] }));
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: oauthFailureRedirect }),
  (req, res) => {
    const token = authController.generateToken(req.user);
    res.redirect(`${clientUrl}/auth/callback?token=${encodeURIComponent(token)}`);
  }
);

// Facebook OAuth Routes (if configured)
router.get('/facebook', startOAuth('facebook', { scope: ['public_profile', 'email'] }));
router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: oauthFailureRedirect }),
  (req, res) => {
    const token = authController.generateToken(req.user);
    res.redirect(`${clientUrl}/auth/callback?token=${encodeURIComponent(token)}`);
  }
);

module.exports = router;
