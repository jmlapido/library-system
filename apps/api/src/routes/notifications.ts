import { Hono } from 'hono';
import { db } from '../db/index.js';
import { notificationLog } from '../db/schema/notificationLog.js';
import { users } from '../db/schema/users.js';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendNotification } from '../services/notifications/index.js';
import type { AccessTokenPayload } from '../lib/jwt.js';
import type { NotificationType } from '../services/notifications/types.js';

type Variables = { user: AccessTokenPayload };

const NotificationPrefSchema = z.object({
  channel: z.enum(['sms', 'email', 'both']).nullable(),
});

const TestNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(['due_reminder', 'overdue_notice', 'fine_notice', 'hold_ready', 'hold_expired']),
});

export const notificationsRouter = new Hono<{ Variables: Variables }>();

/**
 * GET /notifications/me
 * Returns the authenticated user's notification history (last 50).
 */
notificationsRouter.get('/notifications/me', requireAuth, async (c) => {
  const user = c.get('user');
  const logs = await db
    .select()
    .from(notificationLog)
    .where(eq(notificationLog.userId, user.sub))
    .orderBy(desc(notificationLog.sentAt))
    .limit(50);
  return c.json({ success: true, data: logs });
});

/**
 * PATCH /users/me/notification-prefs
 * Update the authenticated user's notification channel preference.
 */
notificationsRouter.patch('/users/me/notification-prefs', requireAuth, async (c) => {
  const user = c.get('user');
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, 422);
  }
  const parsed = NotificationPrefSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Invalid channel value', code: 'VALIDATION_ERROR' }, 422);
  }
  await db
    .update(users)
    .set({ notificationChannel: parsed.data.channel })
    .where(eq(users.id, user.sub));
  return c.json({ success: true, message: 'Notification preferences updated' });
});

/**
 * GET /admin/notifications/log
 * Returns the full notification log. Requires librarian or admin role.
 */
notificationsRouter.get(
  '/admin/notifications/log',
  requireAuth,
  requireRole('librarian', 'admin'),
  async (c) => {
    const logs = await db
      .select()
      .from(notificationLog)
      .orderBy(desc(notificationLog.sentAt))
      .limit(100);
    return c.json({ success: true, data: logs });
  }
);

/**
 * POST /admin/notifications/test
 * Send a test notification to a user. Requires admin role.
 */
notificationsRouter.post(
  '/admin/notifications/test',
  requireAuth,
  requireRole('admin'),
  async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, 422);
    }
    const parsed = TestNotificationSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: 'Invalid request body', code: 'VALIDATION_ERROR' }, 422);
    }

    const { userId, type } = parsed.data;
    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return c.json({ success: false, error: 'User not found', code: 'NOT_FOUND' }, 404);
    }

    const result = await sendNotification(type as NotificationType, {
      userId: targetUser.id,
      schoolId: targetUser.schoolId,
      userFullName: targetUser.fullName,
      userEmail: targetUser.email,
      userPhone: null,
      userChannel: targetUser.notificationChannel,
      bookTitle: '[Test Book]',
      dueDate: new Date(),
      daysOverdue: 1,
      fineAmount: 0.50,
      appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    });

    return c.json({ success: true, data: result });
  }
);
