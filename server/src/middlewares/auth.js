const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'ayusakshi_jwt_super_secret_key_sih26045_prod_ready';

// Middleware to authenticate JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please provide a valid Bearer token.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const userResult = await query('SELECT id, email, name, role, auth_provider, avatar_url FROM users WHERE id = $1', [decoded.id]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'User associated with token no longer exists.',
      });
    }

    req.user = userResult.rows[0];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Authentication token has expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, error: 'Invalid authentication token.' });
  }
};

// Optional auth for public exploration / guest users
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const userResult = await query('SELECT id, email, name, role, auth_provider, avatar_url FROM users WHERE id = $1', [decoded.id]);
      if (userResult.rows.length > 0) {
        req.user = userResult.rows[0];
      }
    }
  } catch (err) {
    // Ignore invalid tokens for optional auth
  }
  next();
};

// RBAC Middleware: restrict to specific roles
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Please login.' });
    }

    if (allowedRoles.length && !allowedRoles.includes(req.user.role) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: `Forbidden. Role '${req.user.role}' lacks required permissions.`,
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
};
