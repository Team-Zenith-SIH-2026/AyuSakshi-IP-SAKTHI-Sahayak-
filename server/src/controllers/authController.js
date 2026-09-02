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

module.exports = {
  register,
  login,
  getProfile,
  socialAuth,
  generateToken,
};
