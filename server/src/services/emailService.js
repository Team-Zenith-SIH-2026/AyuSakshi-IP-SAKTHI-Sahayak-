const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    const rawProvider = (process.env.EMAIL_PROVIDER || '').toLowerCase().trim();
    const hasSmtpHost = !!(process.env.SMTP_HOST && process.env.SMTP_USER);

    if (rawProvider === 'smtp' || (hasSmtpHost && rawProvider !== 'console')) {
      this.provider = 'smtp';
    } else {
      this.provider = 'console';
    }

    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
    this.from = process.env.SMTP_FROM || `AyuSakshi Security <${smtpUser || 'no-reply@ayusakshi.gov.in'}>`;
    this.transporter = null;

    if (this.provider === 'smtp' && process.env.SMTP_HOST) {
      try {
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });
        console.log(`[EmailService] Configured with SMTP provider (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}) for user ${smtpUser}`);
      } catch (err) {
        console.warn('[EmailService] Failed to initialize SMTP transporter:', err.message);
        this.provider = 'console';
      }
    } else {
      console.log('[EmailService] Initialized in console/mock mode (Verification codes will be logged to server console)');
    }
  }

  /**
   * Send Password Reset OTP
   * @param {Object} params
   * @param {string} params.to - Recipient email
   * @param {string} params.code - 6-digit verification code
   * @param {string} [params.name] - Recipient name
   */
  async sendPasswordResetOTP({ to, code, name }) {
    const userName = name || 'User';
    const subject = 'AyuSakshi (IP-SAKTI Sahayak) - Password Reset Code';

    const textContent = `Hello ${userName},\n\nYou requested a password reset for your AyuSakshi (IP-SAKTI Sahayak) account.\n\nYour 6-digit verification code is: ${code}\n\nThis code will expire in 10 minutes.\nIf you did not request this, please ignore this message.\n\nBest regards,\nAyuSakshi Security Team`;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 28px 24px; background-color: #070e12; color: #f1f5f9; border-radius: 16px; border: 1px solid #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="display: inline-block; padding: 10px 18px; border-radius: 12px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3);">
            <span style="font-size: 18px; font-weight: 800; color: #10b981; letter-spacing: 0.5px;">AyuSakshi</span>
            <span style="font-size: 12px; font-weight: 600; color: #34d399; margin-left: 6px; padding: 2px 6px; background: rgba(5, 150, 105, 0.2); border-radius: 4px;">IP SHAKTHI</span>
          </div>
        </div>
        
        <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px; text-align: center;">
          Password Reset Request
        </h2>
        
        <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 20px;">
          Hello <strong style="color: #f8fafc;">${userName}</strong>,<br/>
          We received a request to reset the password for your account. Use the 6-digit verification code below to complete the reset:
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <div style="display: inline-block; padding: 16px 36px; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #10b981; background: #0b171e; border: 2px dashed rgba(16, 185, 129, 0.4); border-radius: 12px;">
            ${code}
          </div>
          <p style="font-size: 12px; color: #64748b; margin-top: 10px;">
            Valid for <strong style="color: #e2e8f0;">10 minutes</strong>. Single-use only.
          </p>
        </div>

        <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin-bottom: 24px;">
          If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>

        <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;" />
        
        <p style="font-size: 11px; color: #475569; text-align: center; margin: 0;">
          This is an automated security transmission from AyuSakshi (IP-SAKTI Sahayak). Please do not reply directly to this email.
        </p>
      </div>
    `;

    if (this.provider === 'smtp' && this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: this.from,
          to,
          subject,
          text: textContent,
          html: htmlContent,
        });
        console.log(`[EmailService] Password reset OTP sent to ${to}. MessageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
      } catch (err) {
        console.error('[EmailService] SMTP send error:', err.message);
        // Fallback to console output so user is not blocked
        this.logConsoleCode(to, code);
        return { success: true, fallback: true };
      }
    } else {
      this.logConsoleCode(to, code);
      return { success: true, mode: 'console' };
    }
  }

  /**
   * Log code to server console in dev/mock mode
   */
  logConsoleCode(to, code) {
    console.log('====================================================');
    console.log('  [EMAIL SERVICE - VERIFICATION CODE DISPATCH]');
    console.log(`  To: ${to}`);
    console.log(`  Code: [ ${code} ]`);
    console.log('  Expires in: 10 minutes');
    console.log('====================================================');
  }

  /**
   * Send Password Changed Confirmation
   * @param {Object} params
   * @param {string} params.to - Recipient email
   * @param {string} [params.name] - Recipient name
   */
  async sendPasswordChangeConfirmation({ to, name }) {
    const userName = name || 'User';
    const subject = 'AyuSakshi - Your Account Password Has Been Changed';
    const textContent = `Hello ${userName},\n\nThis is a confirmation that the password for your AyuSakshi account was successfully updated.\n\nIf you did not perform this change, please contact your administrator immediately.\n\nBest regards,\nAyuSakshi Security Team`;

    if (this.provider === 'smtp' && this.transporter) {
      try {
        await this.transporter.sendMail({
          from: this.from,
          to,
          subject,
          text: textContent,
        });
      } catch (err) {
        console.warn('[EmailService] Confirmation email warning:', err.message);
      }
    } else {
      console.log(`[EmailService] Password change notification dispatched to ${to}`);
    }
    return { success: true };
  }
}

module.exports = new EmailService();
