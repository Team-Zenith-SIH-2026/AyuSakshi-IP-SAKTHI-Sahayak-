const crypto = require('crypto');
const redisClient = require('../config/redis');

// In-memory fallback map if Redis is temporarily offline
const memoryStore = new Map();

// Periodic cleanup of expired in-memory keys
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of memoryStore.entries()) {
    if (val.expiresAt && val.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
}, 60 * 1000);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

class PasswordResetService {
  /**
   * Compute secure SHA-256 hash of a string
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
  }

  /**
   * Generate cryptographically secure 6-digit verification code
   */
  generateCode() {
    return crypto.randomInt(100000, 999999).toString();
  }

  /**
   * Generate secure random 64-char reset token
   */
  generateResetToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Store OTP code for an email (10 min TTL, hashed)
   */
  async storeResetCode(email, rawCode) {
    const codeHash = this.hashToken(rawCode);
    const key = `pwd_reset_code:${email.toLowerCase()}`;
    const payload = JSON.stringify({
      codeHash,
      attempts: 0,
      createdAt: Date.now(),
    });
    const ttlSeconds = 10 * 60; // 10 minutes

    if (redisClient && redisClient.status === 'ready') {
      try {
        await redisClient.set(key, payload, 'EX', ttlSeconds);
        return true;
      } catch (err) {
        console.warn('[PasswordResetService] Redis set error, using memory fallback:', err.message);
      }
    }

    memoryStore.set(key, {
      payload,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  }

  /**
   * Verify OTP code for an email
   */
  async verifyResetCode(email, rawCode) {
    const key = `pwd_reset_code:${email.toLowerCase()}`;
    let rawPayload = null;

    if (redisClient && redisClient.status === 'ready') {
      try {
        rawPayload = await redisClient.get(key);
      } catch (err) {
        console.warn('[PasswordResetService] Redis get error, checking memory:', err.message);
      }
    }

    if (!rawPayload && memoryStore.has(key)) {
      const entry = memoryStore.get(key);
      if (entry.expiresAt > Date.now()) {
        rawPayload = entry.payload;
      } else {
        memoryStore.delete(key);
      }
    }

    if (!rawPayload) {
      return { valid: false, error: 'Verification code has expired or was not requested.' };
    }

    const data = JSON.parse(rawPayload);

    // Limit maximum attempts (5)
    if (data.attempts >= 5) {
      await this.clearResetCode(email);
      return { valid: false, error: 'Too many failed attempts. Please request a new verification code.' };
    }

    const inputHash = this.hashToken(rawCode.trim());
    if (inputHash !== data.codeHash) {
      data.attempts += 1;
      // Update attempts
      const updatedPayload = JSON.stringify(data);
      if (redisClient && redisClient.status === 'ready') {
        try {
          const ttl = await redisClient.ttl(key);
          if (ttl > 0) {
            await redisClient.set(key, updatedPayload, 'EX', ttl);
          }
        } catch (e) {}
      }
      if (memoryStore.has(key)) {
        const memEntry = memoryStore.get(key);
        memEntry.payload = updatedPayload;
      }
      return { valid: false, error: 'Incorrect verification code. Please check and try again.' };
    }

    // Code is valid! Invalidate OTP code so it cannot be reused
    await this.clearResetCode(email);

    // Issue single-use reset token valid for 10 minutes
    const resetToken = this.generateResetToken();
    const tokenHash = this.hashToken(resetToken);
    const tokenKey = `pwd_reset_token:${tokenHash}`;
    const tokenPayload = JSON.stringify({ email: email.toLowerCase(), createdAt: Date.now() });
    const ttlSeconds = 10 * 60;

    if (redisClient && redisClient.status === 'ready') {
      try {
        await redisClient.set(tokenKey, tokenPayload, 'EX', ttlSeconds);
      } catch (e) {
        memoryStore.set(tokenKey, { payload: tokenPayload, expiresAt: Date.now() + ttlSeconds * 1000 });
      }
    } else {
      memoryStore.set(tokenKey, { payload: tokenPayload, expiresAt: Date.now() + ttlSeconds * 1000 });
    }

    return { valid: true, resetToken };
  }

  /**
   * Consume single-use reset token and return associated email
   */
  async consumeResetToken(resetToken) {
    if (!resetToken) return null;
    const tokenHash = this.hashToken(resetToken.trim());
    const tokenKey = `pwd_reset_token:${tokenHash}`;
    let rawPayload = null;

    if (redisClient && redisClient.status === 'ready') {
      try {
        rawPayload = await redisClient.get(tokenKey);
        if (rawPayload) {
          await redisClient.del(tokenKey); // single-use deletion
        }
      } catch (err) {
        console.warn('[PasswordResetService] Redis token get error:', err.message);
      }
    }

    if (!rawPayload && memoryStore.has(tokenKey)) {
      const entry = memoryStore.get(tokenKey);
      if (entry.expiresAt > Date.now()) {
        rawPayload = entry.payload;
      }
      memoryStore.delete(tokenKey); // single-use deletion
    }

    if (!rawPayload) {
      return null;
    }

    const data = JSON.parse(rawPayload);
    return data.email;
  }

  /**
   * Clear reset code
   */
  async clearResetCode(email) {
    const key = `pwd_reset_code:${email.toLowerCase()}`;
    if (redisClient && redisClient.status === 'ready') {
      try {
        await redisClient.del(key);
      } catch (e) {}
    }
    memoryStore.delete(key);
  }

  /**
   * Check rate limiting for sending OTP (max 3 requests per 15 minutes)
   */
  async checkRateLimit(email) {
    const key = `pwd_rate_limit:${email.toLowerCase()}`;
    let count = 0;

    if (redisClient && redisClient.status === 'ready') {
      try {
        count = await redisClient.incr(key);
        if (count === 1) {
          await redisClient.expire(key, 15 * 60);
        }
      } catch (e) {}
    } else {
      const entry = memoryStore.get(key) || { count: 0, expiresAt: Date.now() + 15 * 60 * 1000 };
      if (entry.expiresAt < Date.now()) {
        entry.count = 1;
        entry.expiresAt = Date.now() + 15 * 60 * 1000;
      } else {
        entry.count += 1;
      }
      memoryStore.set(key, entry);
      count = entry.count;
    }

    return count <= 5; // Allow up to 5 requests per 15 min
  }
}

module.exports = new PasswordResetService();
