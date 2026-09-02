const test = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

test('Password Hashing and JWT verification', async () => {
  const plainPassword = 'AyurvedaPassword@2026';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(plainPassword, salt);
  
  const isMatch = await bcrypt.compare(plainPassword, hash);
  assert.strictEqual(isMatch, true, 'Password should match hashed value');
  
  const payload = { id: '00000000-0000-0000-0000-000000000001', role: 'user' };
  const token = jwt.sign(payload, 'test_secret', { expiresIn: '1h' });
  const decoded = jwt.verify(token, 'test_secret');
  
  assert.strictEqual(decoded.id, payload.id);
  assert.strictEqual(decoded.role, payload.role);
});
