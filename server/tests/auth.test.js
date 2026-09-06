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

test('Password Reset Service OTP generation, verification, and single-use token', async () => {
  const passwordResetService = require('../src/services/passwordResetService');
  
  const testEmail = 'researcher.ayush@test.in';
  const code = passwordResetService.generateCode();
  assert.match(code, /^\d{6}$/, 'Generated code must be a 6-digit numeric string');
  
  // Store code
  await passwordResetService.storeResetCode(testEmail, code);
  
  // Test wrong code rejection
  const wrongRes = await passwordResetService.verifyResetCode(testEmail, '000000');
  assert.strictEqual(wrongRes.valid, false, 'Wrong code should be rejected');
  
  // Test correct code verification
  const correctRes = await passwordResetService.verifyResetCode(testEmail, code);
  assert.strictEqual(correctRes.valid, true, 'Correct code should be accepted');
  assert.ok(correctRes.resetToken, 'Reset token should be returned');
  
  // Test single-use reset token
  const emailRetrieved = await passwordResetService.consumeResetToken(correctRes.resetToken);
  assert.strictEqual(emailRetrieved, testEmail, 'Reset token must retrieve correct email');
  
  // Test that token cannot be reused
  const secondAttempt = await passwordResetService.consumeResetToken(correctRes.resetToken);
  assert.strictEqual(secondAttempt, null, 'Reset token must be single-use and destroyed after consumption');
});

