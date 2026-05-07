import sgMail from '@sendgrid/mail';
import { AppError } from './auth.service.js';

const FROM = process.env.EMAIL_FROM ?? 'noreply@libraryms.com';

/**
 * Lazily initialize SendGrid with API key.
 * Called inside each function to avoid module-load crash during tests.
 */
function initSgMail(): typeof sgMail {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (apiKey) sgMail.setApiKey(apiKey);
  return sgMail;
}

/**
 * Send email verification link to newly approved staff.
 * @param to - Recipient email address
 * @param verifyUrl - Full verification URL including token
 */
export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  const client = initSgMail();
  try {
    await client.send({
      to,
      from: FROM,
      subject: 'Verify your LibraMS account',
      text: `Your account has been approved. Verify your email:\n\n${verifyUrl}\n\nThis link expires in 24 hours.`,
      html: `<p>Your account has been approved.</p><p><a href="${verifyUrl}">Verify your email</a></p><p>This link expires in 24 hours.</p>`,
    });
  } catch {
    throw new AppError('EMAIL_SEND_FAILED', 'Failed to send verification email');
  }
}

/**
 * Send invite email to staff account created by admin.
 * @param to - Recipient email address
 * @param inviteUrl - Full invite URL including set-password token
 * @param fullName - Staff member's full name for personalization
 */
export async function sendStaffInviteEmail(to: string, inviteUrl: string, fullName: string): Promise<void> {
  const client = initSgMail();
  try {
    await client.send({
      to,
      from: FROM,
      subject: 'You have been invited to LibraMS',
      text: `Hi ${fullName},\n\nYou have been added to LibraMS. Set your password to get started:\n\n${inviteUrl}\n\nThis link expires in 72 hours.`,
      html: `<p>Hi ${fullName},</p><p>You have been added to LibraMS.</p><p><a href="${inviteUrl}">Set your password</a></p><p>This link expires in 72 hours.</p>`,
    });
  } catch {
    throw new AppError('EMAIL_SEND_FAILED', 'Failed to send invite email');
  }
}

/**
 * Notify rejected staff applicant of the decision.
 * @param to - Recipient email address
 * @param fullName - Applicant's full name for personalization
 */
export async function sendRejectionEmail(to: string, fullName: string): Promise<void> {
  const client = initSgMail();
  try {
    await client.send({
      to,
      from: FROM,
      subject: 'Your LibraMS account request',
      text: `Hi ${fullName},\n\nYour account request was not approved. Please contact your school administrator for assistance.`,
      html: `<p>Hi ${fullName},</p><p>Your account request was not approved. Please contact your school administrator for assistance.</p>`,
    });
  } catch {
    throw new AppError('EMAIL_SEND_FAILED', 'Failed to send rejection email');
  }
}
