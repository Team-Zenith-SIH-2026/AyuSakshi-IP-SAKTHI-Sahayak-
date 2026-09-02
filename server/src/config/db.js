const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://ayusakshi_user:ayusakshi_secure_pass_2026@localhost:5432/ayusakshi_db';

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected client error on idle connection:', err.message);
});

const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 200) {
      console.warn(`[PostgreSQL Slow Query] (${duration}ms) ${text}`);
    }
    return res;
  } catch (error) {
    console.error(`[PostgreSQL Error] Failed query: "${text}"`, error.message);
    throw error;
  }
};

module.exports = {
  pool,
  query,
};
