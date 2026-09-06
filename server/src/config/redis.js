const Redis = require('ioredis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient = null;

try {
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
    lazyConnect: true,
  });

  redisClient.on('connect', () => {
    console.log('[Redis] Connected successfully to Redis server');
  });

  redisClient.on('error', (err) => {
    console.warn('[Redis] Connection warning/error:', err.message);
  });
} catch (err) {
  console.warn('[Redis] Initialization warning:', err.message);
}

module.exports = redisClient;
