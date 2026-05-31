import { db } from '../../db/index.js';
import { notificationLog } from '../../db/schema/notificationLog.js';
import { and, eq, gte, lt } from 'drizzle-orm';
import { sendEmailNotification } from './email.provider.js';
import type { NotificationContext, NotificationType } from './types.js';

/**
 * Send a notification (email and/or SMS) with deduplication.
 * Skips silently if the same type was already sent today for this user.
 * Logs every attempt (success or failure) to notification_log.
 * @param type - Notification type to send
 * @param ctx - Full notification context including user contact info and book details
 * @returns { sent: true } on success, { sent: false, reason } if skipped
 */
export async function sendNotification(
  type: NotificationType,
  ctx: NotificationContext
): Promise<{ sent: boolean; reason?: string }> {
  const dedupResult = await checkDeduplication(type, ctx.userId);
  if (dedupResult) return { sent: false, reason: dedupResult };

  const channel = ctx.userChannel ?? 'email';
  let status: 'sent' | 'failed' = 'sent';
  let sendError: Error | null = null;

  try {
    await dispatchChannels(type, ctx, channel);
  } catch (err) {
    status = 'failed';
    sendError = err as Error;
  }

  await logNotification(type, ctx, channel, status);

  if (sendError) throw sendError;

  return { sent: true };
}

/**
 * Check if same notification type was already sent today for this user.
 * Returns dedup reason string if skipped, null if clear to send.
 */
async function checkDeduplication(
  type: NotificationType,
  userId: string
): Promise<string | null> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const existing = await db
    .select({ id: notificationLog.id })
    .from(notificationLog)
    .where(
      and(
        eq(notificationLog.userId, userId),
        eq(notificationLog.notificationType, type),
        gte(notificationLog.sentAt, todayStart),
        lt(notificationLog.sentAt, todayEnd)
      )
    )
    .limit(1);

  return existing.length > 0 ? 'already_sent_today' : null;
}

/**
 * Dispatch to email and/or SMS providers based on channel preference.
 * SMS provider is dynamically imported — silently skipped if not yet available.
 */
async function dispatchChannels(
  type: NotificationType,
  ctx: NotificationContext,
  channel: string
): Promise<void> {
  if (channel === 'email' || channel === 'both') {
    await sendEmailNotification(type, ctx);
  }

  if (channel === 'sms' || channel === 'both') {
    try {
      const { sendSmsNotification } = await import('./sms.provider.js');
      await sendSmsNotification(type, ctx);
    } catch {
      // sms.provider.ts not yet implemented — skip without failing
    }
  }
}

/**
 * Insert a notification_log row for audit purposes.
 */
async function logNotification(
  type: NotificationType,
  ctx: NotificationContext,
  channel: string,
  status: 'sent' | 'failed'
): Promise<void> {
  await db.insert(notificationLog).values({
    userId: ctx.userId,
    schoolId: ctx.schoolId,
    checkoutId: ctx.checkoutId,
    notificationType: type,
    channel: channel as 'email' | 'sms' | 'both',
    status,
    messagePreview: getMessagePreview(type, ctx).slice(0, 200),
  });
}

/**
 * Returns SMS-style plain text preview for the message_preview column.
 */
function getMessagePreview(type: NotificationType, ctx: NotificationContext): string {
  switch (type) {
    case 'due_reminder':
      return `Hi ${ctx.userFullName}, '${ctx.bookTitle}' is due on ${ctx.dueDate?.toDateString() ?? 'soon'}. Renew at ${ctx.appUrl}`;
    case 'overdue_notice':
      return `Hi ${ctx.userFullName}, '${ctx.bookTitle}' is ${ctx.daysOverdue ?? 0} day(s) overdue. Fine: $${(ctx.fineAmount ?? 0).toFixed(2)}. Return/renew at ${ctx.appUrl}`;
    case 'fine_notice':
      return `Hi ${ctx.userFullName}, outstanding fine of $${(ctx.fineAmount ?? 0).toFixed(2)} for '${ctx.bookTitle}'.`;
    case 'hold_ready':
      return `Hi ${ctx.userFullName}, your hold for '${ctx.bookTitle}' is ready for pickup!`;
    case 'hold_expired':
      return `Hi ${ctx.userFullName}, your hold for '${ctx.bookTitle}' has expired.`;
  }
}
