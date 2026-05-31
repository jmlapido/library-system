import sgMail from '@sendgrid/mail';
import type { NotificationContext, NotificationType } from './types.js';
import { AppError } from '../../utils/errors.js';

const FROM = process.env.EMAIL_FROM ?? 'noreply@librams.school';

/**
 * Escape special HTML characters to prevent injection via user-supplied strings.
 * @param str - Raw string to escape
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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
 * Send a library notification email via SendGrid.
 * No-ops if recipient has no email address.
 * @param type - Notification type determining email template
 * @param ctx - Full notification context with user and book data
 */
export async function sendEmailNotification(
  type: NotificationType,
  ctx: NotificationContext
): Promise<void> {
  if (!ctx.userEmail) return;
  const client = initSgMail();
  const { subject, text, html } = buildEmailContent(type, ctx);
  try {
    await client.send({ to: ctx.userEmail, from: FROM, subject, text, html });
  } catch (err) {
    throw new AppError(
      'EMAIL_SEND_FAILED',
      `Failed to send ${type} email: ${(err as Error).message}`
    );
  }
}

/**
 * Build subject, plain-text, and HTML content for each notification type.
 * @param type - Notification type
 * @param ctx - Notification context
 */
function buildEmailContent(
  type: NotificationType,
  ctx: NotificationContext
): { subject: string; text: string; html: string } {
  const safeName = escapeHtml(ctx.userFullName);
  const safeTitle = escapeHtml(ctx.bookTitle);
  const url = escapeHtml(ctx.appUrl);

  switch (type) {
    case 'due_reminder': {
      const date = ctx.dueDate ? ctx.dueDate.toDateString() : 'soon';
      return {
        subject: `Your book '${ctx.bookTitle}' is due on ${date}`,
        text: `Hi ${ctx.userFullName}, your book '${ctx.bookTitle}' is due on ${date}. Renew at ${ctx.appUrl} or visit the library.`,
        html: `<p>Hi ${safeName},</p><p>Your book <strong>${safeTitle}</strong> is due on <strong>${date}</strong>.</p><p><a href="${url}">Renew online</a> or visit the library.</p>`,
      };
    }
    case 'overdue_notice': {
      const days = ctx.daysOverdue ?? 0;
      const fineText =
        ctx.fineAmount && ctx.fineAmount > 0 ? ` Fine so far: $${ctx.fineAmount.toFixed(2)}.` : '';
      const fineHtml =
        ctx.fineAmount && ctx.fineAmount > 0
          ? `<br>Fine so far: <strong>$${ctx.fineAmount.toFixed(2)}</strong>.`
          : '';
      return {
        subject: `'${ctx.bookTitle}' is overdue`,
        text: `Hi ${ctx.userFullName}, '${ctx.bookTitle}' is ${days} day(s) overdue.${fineText} Return or renew at ${ctx.appUrl}`,
        html: `<p>Hi ${safeName},</p><p><strong>${safeTitle}</strong> is <strong>${days} day(s) overdue</strong>.${fineHtml}</p><p><a href="${url}">Return or renew online</a>.</p>`,
      };
    }
    case 'fine_notice': {
      const amount = ctx.fineAmount ?? 0;
      return {
        subject: `Fine notice for '${ctx.bookTitle}'`,
        text: `Hi ${ctx.userFullName}, you have an outstanding fine of $${amount.toFixed(2)} for '${ctx.bookTitle}'. Visit the library to resolve.`,
        html: `<p>Hi ${safeName},</p><p>You have an outstanding fine of <strong>$${amount.toFixed(2)}</strong> for <strong>${safeTitle}</strong>.</p><p>Visit the library or contact staff to resolve.</p>`,
      };
    }
    case 'hold_ready': {
      return {
        subject: `Your hold for '${ctx.bookTitle}' is ready!`,
        text: `Hi ${ctx.userFullName}, your hold for '${ctx.bookTitle}' is ready for pickup. Visit the library soon — holds expire after a few days.`,
        html: `<p>Hi ${safeName},</p><p>Your hold for <strong>${safeTitle}</strong> is ready for pickup.</p><p>Please visit the library soon — holds expire after a few days.</p>`,
      };
    }
    case 'hold_expired': {
      return {
        subject: `Your hold for '${ctx.bookTitle}' has expired`,
        text: `Hi ${ctx.userFullName}, your hold for '${ctx.bookTitle}' has expired. Place a new hold at ${ctx.appUrl} if you still want the book.`,
        html: `<p>Hi ${safeName},</p><p>Your hold for <strong>${safeTitle}</strong> has expired.</p><p><a href="${url}">Place a new hold</a> if you still want the book.</p>`,
      };
    }
  }
}
