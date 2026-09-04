const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'ayusakshi_jwt_super_secret_key_sih26045_prod_ready';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

// Register with Email & Password
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
    }

    const emailNormalized = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [emailNormalized]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const validRole = ['user', 'researcher', 'practitioner', 'msme', 'facilitator'].includes(role) ? role : 'user';

    const insertResult = await query(
      `INSERT INTO users (name, email, password_hash, role, auth_provider)
       VALUES ($1, $2, $3, $4, 'local')
       RETURNING id, name, email, role, auth_provider, avatar_url, created_at`,
      [name.trim(), emailNormalized, passwordHash, validRole]
    );

    const user = insertResult.rows[0];
    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user,
    });
  } catch (error) {
    console.error('[Auth Register Error]', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error during registration.' });
  }
};

// Login with Email & Password
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const emailNormalized = email.trim().toLowerCase();

    const result = await query(
      'SELECT id, name, email, password_hash, role, auth_provider, avatar_url FROM users WHERE email = $1',
      [emailNormalized]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(400).json({
        success: false,
        error: `This account was registered using ${user.auth_provider}. Please sign in with ${user.auth_provider}.`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    delete user.password_hash;
    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user,
    });
  } catch (error) {
    console.error('[Auth Login Error]', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error during login.' });
  }
};

// Get Current User Profile
const getProfile = async (req, res) => {
  try {
    return res.json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch user profile.' });
  }
};

// Social OAuth Mock / Direct Link for Testing (Google & Facebook)
const socialAuth = async (req, res) => {
  try {
    const { provider, email, name, avatar_url, provider_id } = req.body;

    if (!provider || !email) {
      return res.status(400).json({ success: false, error: 'Provider and email are required for social login.' });
    }

    const emailNormalized = email.trim().toLowerCase();

    let userResult = await query(
      'SELECT id, name, email, role, auth_provider, avatar_url FROM users WHERE email = $1',
      [emailNormalized]
    );

    let user;
    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
    } else {
      const insertResult = await query(
        `INSERT INTO users (name, email, role, auth_provider, provider_id, avatar_url)
         VALUES ($1, $2, 'user', $3, $4, $5)
         RETURNING id, name, email, role, auth_provider, avatar_url, created_at`,
        [name || `${provider} User`, emailNormalized, provider, provider_id || 'social_id', avatar_url || null]
      );
      user = insertResult.rows[0];
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      message: `Signed in successfully via ${provider}.`,
      token,
      user,
    });
  } catch (error) {
    console.error('[Social Auth Error]', error.message);
    return res.status(500).json({ success: false, error: 'Social authentication failed.' });
  }
};

// Change Password (Authenticated User)
const changePassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password, new password, and confirmation are required.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password and confirmation do not match.',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long.',
      });
    }

    // Fetch user with password_hash
    const result = await query(
      'SELECT id, name, email, password_hash, auth_provider FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(400).json({
        success: false,
        error: `This account was created using ${user.auth_provider}. Password cannot be modified directly.`,
      });
    }

    const isCurrentMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentMatch) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect current password. Please try again.',
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );

    // Send confirmation email asynchronously
    const emailService = require('../services/emailService');
    emailService.sendPasswordChangeConfirmation({ to: user.email, name: user.name }).catch((err) => {
      console.warn('[Change Password] Email notification warning:', err.message);
    });

    return res.json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (error) {
    console.error('[Change Password Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to update password.' });
  }
};

// Forgot Password - Step 1: Send Verification Code / OTP
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }

    const emailNormalized = email.trim().toLowerCase();
    const passwordResetService = require('../services/passwordResetService');
    const emailService = require('../services/emailService');

    // Check rate limit (max 5 requests per 15 min)
    const allowed = await passwordResetService.checkRateLimit(emailNormalized);
    if (!allowed) {
      return res.status(429).json({
        success: false,
        error: 'Too many password reset requests for this email. Please try again after 15 minutes.',
      });
    }

    // Check if user exists in database
    const result = await query(
      'SELECT id, name, email, auth_provider, password_hash FROM users WHERE email = $1',
      [emailNormalized]
    );

    // If user exists and is local (or has a password), dispatch OTP
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const code = passwordResetService.generateCode();
      await passwordResetService.storeResetCode(emailNormalized, code);

      await emailService.sendPasswordResetOTP({
        to: emailNormalized,
        code,
        name: user.name,
      });
    }

    // Return generic message regardless of whether user exists to prevent email enumeration
    return res.json({
      success: true,
      message: 'If an account exists for this email, a 6-digit verification code has been sent.',
    });
  } catch (error) {
    console.error('[Forgot Password Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to process password reset request.' });
  }
};

// Forgot Password - Step 2: Verify OTP code
const verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ success: false, error: 'Email and verification code are required.' });
    }

    const emailNormalized = email.trim().toLowerCase();
    const passwordResetService = require('../services/passwordResetService');

    const result = await passwordResetService.verifyResetCode(emailNormalized, code.trim());

    if (!result.valid) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Invalid or expired verification code.',
      });
    }

    return res.json({
      success: true,
      message: 'Verification code confirmed. You may now set a new password.',
      resetToken: result.resetToken,
    });
  } catch (error) {
    console.error('[Verify Reset Code Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to verify code.' });
  }
};

// Forgot Password - Step 3: Set New Password with Reset Token
const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Reset token, new password, and confirmation are required.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password and confirmation do not match.',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long.',
      });
    }

    const passwordResetService = require('../services/passwordResetService');
    const userEmail = await passwordResetService.consumeResetToken(resetToken);

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: 'Reset token has expired or is invalid. Please restart the forgot-password process.',
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Update in database
    const updateResult = await query(
      'UPDATE users SET password_hash = $1, auth_provider = \'local\', updated_at = NOW() WHERE email = $2 RETURNING id, name, email',
      [newPasswordHash, userEmail]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User account not found.' });
    }

    const user = updateResult.rows[0];

    // Send confirmation email
    const emailService = require('../services/emailService');
    emailService.sendPasswordChangeConfirmation({ to: user.email, name: user.name }).catch((e) => {});

    return res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    console.error('[Reset Password Error]', error.message);
    return res.status(500).json({ success: false, error: 'Failed to reset password.' });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  socialAuth,
  changePassword,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  generateToken,
};
