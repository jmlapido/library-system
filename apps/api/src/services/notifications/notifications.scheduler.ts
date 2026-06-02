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
import { SchoolSettingsSchema, DEFAULT_SETTINGS } from '../school.service.js';
import type { NotificationContext } from './types.js';
import type { SchoolSettings } from '../school.service.js';

const QUEUE_NAME = 'notification-scheduler';

/** Default cron expression matching DEFAULT_SETTINGS.notificationTime "08:00". */
const DEFAULT_CRON = '0 8 * * *';

/**
 * Parse a "HH:MM" time string into a cron expression "M H * * *".
 * Falls back to DEFAULT_CRON on invalid input.
 */
function timeToCron(time: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return DEFAULT_CRON;
  const [, hh, mm] = match;
  return `${Number(mm)} ${Number(hh)} * * *`;
}

/**
 * Start the BullMQ scheduler for daily notification jobs.
 * Reads notificationTime from env NOTIFICATION_TIME (set at deploy time) or defaults
 * to "08:00". Logs a warning if any school's notificationTime differs — full dynamic
 * reschedule is out of scope for Phase 1.
 */
export function startNotificationScheduler(): void {
  const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  const configuredTime = process.env.NOTIFICATION_TIME ?? DEFAULT_SETTINGS.notificationTime;
  const cronPattern = timeToCron(configuredTime);

  const queue = new Queue(QUEUE_NAME, { connection });

  queue.add('run-daily-notifications', {}, {
    repeat: { pattern: cronPattern },
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
 * Reads per-school settings from DB at job execution time.
 * Exported for direct invocation in tests.
 */
export async function runDailyNotifications(): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const allSchools = await db.select().from(schools);

  const configuredTime = process.env.NOTIFICATION_TIME ?? DEFAULT_SETTINGS.notificationTime;

  for (const school of allSchools) {
    const settings = parseSchoolSettings(school.settings);

    if (settings.notificationTime !== configuredTime) {
      console.warn(
        `[scheduler] school ${school.id} notificationTime="${settings.notificationTime}" ` +
        `differs from active cron time="${configuredTime}". Restart with NOTIFICATION_TIME=${settings.notificationTime} to apply.`
      );
    }

    await processOverdueCheckouts(school.id, settings, appUrl);
    await sendRemindersForSchool(school.id, settings.reminderDaysBefore, appUrl);
  }

  await processHoldReady(appUrl);
  await processHoldExpired(appUrl);
}

/**
 * Parse and validate raw JSONB settings for a school.
 * Falls back to DEFAULT_SETTINGS on any validation error.
 */
function parseSchoolSettings(raw: Record<string, unknown> | null): SchoolSettings {
  const result = SchoolSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(raw ?? {}) });
  return result.success ? result.data : DEFAULT_SETTINGS;
}

/**
 * Send overdue notices per school, respecting gracePeriodDays and overdueRepeatEvery.
 * Grace period: skip rows where daysOverdue <= gracePeriodDays.
 * Repeat throttle: deduplication in notifications.service handles daily sends;
 * overdueRepeatEvery controls whether we flag the record for re-notification
 * by checking if daysOverdue is a multiple of overdueRepeatEvery (after grace).
 */
async function processOverdueCheckouts(
  schoolId: string,
  settings: SchoolSettings,
  appUrl: string
): Promise<void> {
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
      lt(checkouts.dueDate, now),
      eq(users.schoolId, schoolId)
    ));

  for (const row of rows) {
    try {
      const daysOverdue = Math.floor((now.getTime() - row.dueDate.getTime()) / 86_400_000);
      if (!shouldSendOverdue(daysOverdue, settings.gracePeriodDays, settings.overdueRepeatEvery)) {
        continue;
      }
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
 * Determine if an overdue notice should be sent today.
 * Rules:
 *   - daysOverdue must exceed gracePeriodDays
 *   - daysOverdue after grace must be divisible by overdueRepeatEvery
 */
function shouldSendOverdue(
  daysOverdue: number,
  gracePeriodDays: number,
  overdueRepeatEvery: number
): boolean {
  if (daysOverdue <= gracePeriodDays) return false;
  const daysAfterGrace = daysOverdue - gracePeriodDays;
  return daysAfterGrace % overdueRepeatEvery === 0;
}

/**
 * Send due reminders for a school using its configured reminderDaysBefore array.
 */
async function sendRemindersForSchool(
  schoolId: string,
  reminderDaysBefore: number[],
  appUrl: string
): Promise<void> {
  for (const n of reminderDaysBefore) {
    await sendRemindersForDayOffset(schoolId, n, appUrl);
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
