const { query } = require('../config/db');

const logAudit = async (req, action, resourceType, resourceId = null, metadata = {}) => {
  try {
    const userId = req.user ? req.user.id : null;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, resourceType, resourceId ? String(resourceId) : null, JSON.stringify(metadata), ipAddress]
    );
  } catch (error) {
    console.error('[Audit Log Error]', error.message);
  }
};

const auditMiddleware = (action, resourceType) => {
  return async (req, res, next) => {
    // Perform audit logging asynchronously without blocking response
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        logAudit(req, action, resourceType, req.params.id || null, {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
        });
      }
    });
    next();
  };
};

module.exports = {
  logAudit,
  auditMiddleware,
};
