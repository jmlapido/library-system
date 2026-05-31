import twilio from 'twilio';
import type { NotificationContext, NotificationType } from './types.js';
import { AppError } from '../../utils/errors.js';

/**
 * Lazily create a Twilio client from env vars.
 * Returns null if credentials are not configured (dev/test safe).
 */
function getClient(): ReturnType<typeof twilio> | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

/**
 * Send SMS notification via Twilio.
 * No-ops if Twilio is not configured or user has no phone number.
 * @param type - Notification type determining message content
 * @param ctx - Full notification context with user and book data
 */
export async function sendSmsNotification(
  type: NotificationType,
  ctx: NotificationContext
): Promise<void> {
  const client = getClient();
  if (!client || !ctx.userPhone) return;

  const from = process.env.TWILIO_FROM_NUMBER ?? '';
  const body = buildSmsBody(type, ctx);

  try {
    await client.messages.create({ from, to: ctx.userPhone, body });
  } catch (err) {
    throw new AppError('SMS_SEND_FAILED', `Failed to send SMS: ${(err as Error).message}`);
  }
}

/**
 * Build SMS message body for each notification type.
 * Appends opt-out instruction per TCPA compliance.
 * @param type - Notification type
 * @param ctx - Notification context
 */
function buildSmsBody(type: NotificationType, ctx: NotificationContext): string {
  const optOut = ' Reply STOP to opt out.';
  switch (type) {
    case 'due_reminder':
      return `Hi ${ctx.userFullName}, '${ctx.bookTitle}' is due on ${ctx.dueDate?.toDateString() ?? 'soon'}. Renew at ${ctx.appUrl} or visit the library.${optOut}`;
    case 'overdue_notice':
      return `Hi ${ctx.userFullName}, '${ctx.bookTitle}' is ${ctx.daysOverdue ?? 0} day(s) overdue. Fine: $${(ctx.fineAmount ?? 0).toFixed(2)}. Return or renew at ${ctx.appUrl}.${optOut}`;
    case 'fine_notice':
      return `Hi ${ctx.userFullName}, you have a fine of $${(ctx.fineAmount ?? 0).toFixed(2)} for '${ctx.bookTitle}'. Visit the library.${optOut}`;
    case 'hold_ready':
      return `Hi ${ctx.userFullName}, your hold for '${ctx.bookTitle}' is ready for pickup! Visit the library soon.${optOut}`;
    case 'hold_expired':
      return `Hi ${ctx.userFullName}, your hold for '${ctx.bookTitle}' has expired. Place a new hold at ${ctx.appUrl}.${optOut}`;
  }
}
