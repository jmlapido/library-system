import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { db } from '../db/index.js';
import { holds } from '../db/schema/circulation.js';
import { users } from '../db/schema/users.js';
import { books } from '../db/schema/books.js';
import { schools } from '../db/schema/schools.js';
import { eq, and, lt } from 'drizzle-orm';
import { sendNotification } from '../services/notifications/notifications.service.js';
import { SchoolSettingsSchema, DEFAULT_SETTINGS } from '../services/school.service.js';
import type { NotificationContext } from '../services/notifications/types.js';

const QUEUE_NAME = 'hold-expiry';
const DAILY_01_CRON = '0 1 * * *';

/**
 * Expire pending holds for a single school whose createdAt is older
 * than holdExpiryDays. Sends hold_expired notification to each user.
 * holdExpiryDays = 0 means never expire.
 */
async function expireHoldsForSchool(
  schoolId: string,
  holdExpiryDays: number,
  appUrl: string,
): Promise<void> {
  if (holdExpiryDays === 0) return;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - holdExpiryDays);

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
      lt(holds.createdAt, cutoff),
      eq(users.schoolId, schoolId),
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
      console.error(`[hold-expiry] failed for holdId=${row.holdId} userId=${row.userId}`);
    }
  }
}

/**
 * Run hold expiry for all schools, reading each school's holdExpiryDays
 * from its settings at job execution time.
 * Exported for direct invocation in tests.
 */
export async function runHoldExpiry(): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const allSchools = await db.select().from(schools);

  for (const school of allSchools) {
    const result = SchoolSettingsSchema.safeParse({
      ...DEFAULT_SETTINGS,
      ...(school.settings ?? {}),
    });
    const settings = result.success ? result.data : DEFAULT_SETTINGS;
    await expireHoldsForSchool(school.id, settings.holdExpiryDays, appUrl);
  }
}

/**
 * Start the BullMQ worker that runs hold expiry daily at 01:00.
 * Must not be called in test environments.
 */
export function startHoldExpiryWorker(): void {
  const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  const queue = new Queue(QUEUE_NAME, { connection });

  queue.add('run-hold-expiry', {}, {
    repeat: { pattern: DAILY_01_CRON },
    jobId: 'daily-hold-expiry',
  }).catch((err) => {
    console.error('[hold-expiry] Failed to register job:', (err as Error).message);
  });

  new Worker(QUEUE_NAME, async () => {
    await runHoldExpiry();
  }, { connection });
}
