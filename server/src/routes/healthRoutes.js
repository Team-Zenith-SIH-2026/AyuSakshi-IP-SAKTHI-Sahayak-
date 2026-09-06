const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const redisClient = require('../config/redis');
const { getHealth: getAiHealth } = require('../services/aiService');

router.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime_seconds: process.uptime(),
    components: {
      api: { status: 'healthy' },
      postgres: { status: 'unknown' },
      redis: { status: 'unknown' },
      ai_service: { status: 'unknown' },
    },
  };

  try {
    await query('SELECT 1');
    health.components.postgres.status = 'healthy';
  } catch (err) {
    health.components.postgres = { status: 'unhealthy', error: err.message };
    health.status = 'degraded';
  }

  try {
    if (redisClient && redisClient.status === 'ready') {
      health.components.redis.status = 'healthy';
    } else {
      health.components.redis = { status: 'idle_or_disconnected' };
    }
  } catch (err) {
    health.components.redis = { status: 'unhealthy', error: err.message };
  }

  try {
    const aiStatus = await getAiHealth();
    health.components.ai_service = aiStatus;
  } catch (err) {
    health.components.ai_service = { status: 'unreachable' };
  }

  const statusCode = health.status === 'healthy' ? 200 : 200; // Return 200 with degraded details
  return res.status(statusCode).json(health);
});

module.exports = router;
