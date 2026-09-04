const test = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');
const passwordResetService = require('../src/services/passwordResetService');
const emailService = require('../src/services/emailService');

test('End-to-End Password Reset Flow (OTP -> Token -> Verification)', async () => {
  const email = 'vaidya.ayush@gov.in';

  // 1. Generate & Dispatch OTP
  const rawCode = passwordResetService.generateCode();
  assert.strictEqual(rawCode.length, 6);
  assert.match(rawCode, /^[0-9]{6}$/);

  // Store hashed OTP
  await passwordResetService.storeResetCode(email, rawCode);

  // 2. Email Service sends notification without error
  const emailResult = await emailService.sendPasswordResetOTP({
    to: email,
    code: rawCode,
    name: 'Vaidya Sharma',
  });
  assert.strictEqual(emailResult.success, true);

  // 3. Reject wrong code
  const invalidAttempt = await passwordResetService.verifyResetCode(email, '999999');
  assert.strictEqual(invalidAttempt.valid, false);

  // 4. Accept correct code & issue single-use token
  const validAttempt = await passwordResetService.verifyResetCode(email, rawCode);
  assert.strictEqual(validAttempt.valid, true);
  assert.ok(validAttempt.resetToken);

  // 5. Consume single-use reset token
  const retrievedEmail = await passwordResetService.consumeResetToken(validAttempt.resetToken);
  assert.strictEqual(retrievedEmail, email);

  // 6. Verify token cannot be re-used
  const reusedAttempt = await passwordResetService.consumeResetToken(validAttempt.resetToken);
  assert.strictEqual(reusedAttempt, null, 'Reset token must be single-use');

  // 7. Password hashing verification
  const newPlainPassword = 'NewSecretPassword@2026';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(newPlainPassword, salt);
  const isMatch = await bcrypt.compare(newPlainPassword, hash);
  assert.strictEqual(isMatch, true);
});
