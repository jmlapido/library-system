import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { db } from '../../db/index.js';
import { checkouts, holds } from '../../db/schema/circulation.js';
import { users } from '../../db/schema/users.js';
import { books, bookInventory } from '../../db/schema/books.js';
import { schools } from '../../db/schema/schools.js';
import { pushSubscriptions } from '../../db/schema/pushSubscriptions.js';
import { eq, lt, and, inArray, gte, lte } from 'drizzle-orm';
import { sendNotification } from './notifications.service.js';
import { sendPushNotification } from './push.provider.js';
import type { NotificationContext } from './types.js';

const QUEUE_NAME = 'notification-scheduler';

/**
 * Start the BullMQ scheduler that runs daily notification jobs at 08:00.
 * No-op when NODE_ENV=test.
 */
export function startNotificationScheduler(): void {
  const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  const queue = new Queue(QUEUE_NAME, { connection });

  queue.add('run-daily-notifications', {}, {
    repeat: { pattern: '0 8 * * *' },
    jobId: 'daily-notifications',
  }).catch((err) => {
    console.error('Failed to register notification job:', (err as Error).message);
  });

  new Worker(QUEUE_NAME, async () => {
    await runDailyNotifications();
  }, { connection });
}

/**
 * Execute all daily notification batches.
 * Exported for direct invocation in tests.
 */
export async function runDailyNotifications(): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  await processOverdueCheckouts(appUrl);
  await processDueReminders(appUrl);
  await processHoldReady(appUrl);
  await processHoldExpired(appUrl);
}

/**
 * Send overdue notices for all checkouts past due date.
 */
async function processOverdueCheckouts(appUrl: string): Promise<void> {
  const now = new Date();
  const rows = await db
    .select({
      checkoutId: checkouts.id,
      userId: checkouts.userId,
      dueDate: checkouts.dueDate,
      lateFee: checkouts.lateFee,
      userFullName: users.fullName,
      userEmail: users.email,
      userChannel: users.notificationChannel,
      schoolId: users.schoolId,
      bookTitle: books.title,
    })
    .from(checkouts)
    .innerJoin(users, eq(checkouts.userId, users.id))
    .innerJoin(bookInventory, eq(checkouts.bookInventoryId, bookInventory.id))
    .innerJoin(books, eq(bookInventory.bookId, books.id))
    .where(and(
      inArray(checkouts.status, ['checked_out', 'overdue']),
      lt(checkouts.dueDate, now)
    ));

  for (const row of rows) {
    try {
      const daysOverdue = Math.floor((now.getTime() - row.dueDate.getTime()) / 86_400_000);
      const ctx: NotificationContext = {
        userId: row.userId,
        schoolId: row.schoolId!,
        checkoutId: row.checkoutId,
        userFullName: row.userFullName,
        userEmail: row.userEmail,
        userPhone: null,
        userChannel: row.userChannel,
        bookTitle: row.bookTitle,
        dueDate: row.dueDate,
        daysOverdue,
        fineAmount: row.lateFee ? parseFloat(row.lateFee) : 0,
        appUrl,
      };
      await sendNotification('overdue_notice', ctx);
    } catch {
      console.error(`[scheduler] overdue_notice failed for userId=${row.userId}`);
    }
  }
}

/**
 * Send due reminders based on each school's configured reminder_days_before setting.
 */
async function processDueReminders(appUrl: string): Promise<void> {
  const allSchools = await db.select().from(schools);

  for (const school of allSchools) {
    const reminderDays = getReminderDays(school.settings);
    for (const n of reminderDays) {
      await sendRemindersForDayOffset(school.id, n, appUrl);
    }
  }
}

/** Fetch all FCM tokens registered for a user. Returns empty array if none. */
async function getFcmTokens(userId: string): Promise<string[]> {
  const rows = await db
    .select({ fcmToken: pushSubscriptions.fcmToken })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  return rows.map((r) => r.fcmToken);
}

/** Extract reminder_days_before from school settings, defaulting to [3, 1]. */
function getReminderDays(settings: Record<string, unknown> | null): number[] {
  const val = settings?.reminder_days_before;
  if (Array.isArray(val) && val.every((v) => typeof v === 'number')) return val;
  return [3, 1];
}

/** Send due reminders for checkouts due exactly N days from today. */
async function sendRemindersForDayOffset(
  schoolId: string,
  daysOffset: number,
  appUrl: string
): Promise<void> {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() + daysOffset);
  windowStart.setHours(0, 0, 0, 0);

  const windowEnd = new Date(windowStart);
  windowEnd.setHours(23, 59, 59, 999);

  const rows = await db
    .select({
      checkoutId: checkouts.id,
      userId: checkouts.userId,
      dueDate: checkouts.dueDate,
      userFullName: users.fullName,
      userEmail: users.email,
      userChannel: users.notificationChannel,
      userSchoolId: users.schoolId,
      bookTitle: books.title,
    })
    .from(checkouts)
    .innerJoin(users, eq(checkouts.userId, users.id))
    .innerJoin(bookInventory, eq(checkouts.bookInventoryId, bookInventory.id))
    .innerJoin(books, eq(bookInventory.bookId, books.id))
    .where(and(
      eq(checkouts.status, 'checked_out'),
      eq(users.schoolId, schoolId),
      gte(checkouts.dueDate, windowStart),
      lte(checkouts.dueDate, windowEnd)
    ));

  for (const row of rows) {
    try {
      const fcmTokens = await getFcmTokens(row.userId);
      const ctx: NotificationContext = {
        userId: row.userId,
        schoolId: row.userSchoolId!,
        checkoutId: row.checkoutId,
        userFullName: row.userFullName,
        userEmail: row.userEmail,
        userPhone: null,
        userChannel: row.userChannel,
        bookTitle: row.bookTitle,
        dueDate: row.dueDate,
        fcmTokens,
        appUrl,
      };
      await sendNotification('due_reminder', ctx);
      await sendPushNotification(
        fcmTokens,
        'Book Due Soon',
        `Your book "${row.bookTitle}" is due in ${daysOffset} day${daysOffset === 1 ? '' : 's'}.`,
        { type: 'due_reminder', bookTitle: row.bookTitle },
        row.userId
      );
    } catch {
      console.error(`[scheduler] due_reminder failed for userId=${row.userId}`);
    }
  }
}

/**
 * Notify users whose holds are ready for pickup and have not been notified yet.
 */
async function processHoldReady(appUrl: string): Promise<void> {
  const rows = await db
    .select({
      holdId: holds.id,
      userId: holds.userId,
      userFullName: users.fullName,
      userEmail: users.email,
      userChannel: users.notificationChannel,
      schoolId: users.schoolId,
      bookTitle: books.title,
    })
    .from(holds)
    .innerJoin(users, eq(holds.userId, users.id))
    .innerJoin(books, eq(holds.bookId, books.id))
    .where(and(
      eq(holds.status, 'ready'),
      eq(holds.notified, false)
    ));

  for (const row of rows) {
    try {
      const fcmTokens = await getFcmTokens(row.userId);
      const ctx: NotificationContext = {
        userId: row.userId,
        schoolId: row.schoolId!,
        holdId: row.holdId,
        userFullName: row.userFullName,
        userEmail: row.userEmail,
        userPhone: null,
        userChannel: row.userChannel,
        bookTitle: row.bookTitle,
        fcmTokens,
        appUrl,
      };
      const result = await sendNotification('hold_ready', ctx);
      if (result.sent) {
        await db
          .update(holds)
          .set({ notified: true })
          .where(eq(holds.id, row.holdId));
      }
      try {
        await sendPushNotification(
          fcmTokens,
          'Hold Ready for Pickup',
          `Your hold for "${row.bookTitle}" is ready for pickup.`,
          { type: 'hold_ready', bookTitle: row.bookTitle },
          row.userId
        );
      } catch {
        console.error(`[scheduler] hold_ready push failed for userId=${row.userId}`);
      }
    } catch {
      console.error(`[scheduler] hold_ready failed for userId=${row.userId}`);
    }
  }
}

/**
 * Expire pending holds past their expiration date and notify users.
 */
async function processHoldExpired(appUrl: string): Promise<void> {
  const now = new Date();
  const rows = await db
    .select({
      holdId: holds.id,
      userId: holds.userId,
      userFullName: users.fullName,
      userEmail: users.email,
      userChannel: users.notificationChannel,
      schoolId: users.schoolId,
      bookTitle: books.title,
    })
    .from(holds)
    .innerJoin(users, eq(holds.userId, users.id))
    .innerJoin(books, eq(holds.bookId, books.id))
    .where(and(
      eq(holds.status, 'pending'),
      lt(holds.expirationDate, now)
    ));

  for (const row of rows) {
    try {
      await db
        .update(holds)
        .set({ status: 'expired' })
        .where(eq(holds.id, row.holdId));

      const ctx: NotificationContext = {
        userId: row.userId,
        schoolId: row.schoolId!,
        holdId: row.holdId,
        userFullName: row.userFullName,
        userEmail: row.userEmail,
        userPhone: null,
        userChannel: row.userChannel,
        bookTitle: row.bookTitle,
        appUrl,
      };
      await sendNotification('hold_expired', ctx);
    } catch {
      console.error(`[scheduler] hold_expired failed for userId=${row.userId}`);
    }
  }
}
