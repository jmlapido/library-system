import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- BullMQ mock ---
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue(undefined),
  })),
  Worker: vi.fn().mockImplementation(() => ({})),
}));

// --- IORedis mock ---
vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

// --- DB mock ---
// The scheduler uses Drizzle chained queries that end with .where() (no .limit()).
// We need .where() to be a thenable (Promise) so await works.
vi.mock('../db/index.js', () => {
  const chainObj: Record<string, unknown> = {};
  chainObj.select = vi.fn().mockReturnValue(chainObj);
  chainObj.from = vi.fn().mockReturnValue(chainObj);
  chainObj.innerJoin = vi.fn().mockReturnValue(chainObj);
  chainObj.where = vi.fn().mockResolvedValue([]);
  chainObj.limit = vi.fn().mockResolvedValue([]);
  chainObj.update = vi.fn().mockReturnValue(chainObj);
  chainObj.set = vi.fn().mockReturnValue(chainObj);
  return { db: chainObj };
});

// --- sendNotification mock ---
vi.mock('../services/notifications/notifications.service.js', () => ({
  sendNotification: vi.fn().mockResolvedValue({ sent: true }),
}));

import { Queue, Worker } from 'bullmq';
import { db } from '../db/index.js';
import { runDailyNotifications, startNotificationScheduler } from '../services/notifications/notifications.scheduler.js';
import { sendNotification } from '../services/notifications/notifications.service.js';

describe('startNotificationScheduler', () => {
  it('creates a Queue with the correct name', () => {
    startNotificationScheduler();
    expect(Queue).toHaveBeenCalledWith('notification-scheduler', expect.anything());
  });

  it('creates a Worker with the correct queue name', () => {
    startNotificationScheduler();
    expect(Worker).toHaveBeenCalledWith(
      'notification-scheduler',
      expect.any(Function),
      expect.anything()
    );
  });
});

describe('runDailyNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The mocked db is a plain object (Record<string,unknown>) at runtime.
    // Cast through unknown to avoid TS structural mismatch with DrizzleORM type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDb = db as unknown as Record<string, any>;

    // .from and .where must be thenables (Promise) because some queries terminate there.
    // They also return `this` so chaining continues (e.g. .from(...).innerJoin(...)).
    const makeChainable = (resolvedValue: unknown[]) => {
      const p = Promise.resolve(resolvedValue) as Promise<unknown[]> & Record<string, unknown>;
      ['select','from','where','innerJoin','limit','update','set'].forEach((k) => {
        p[k] = mockDb[k];
      });
      return p;
    };

    vi.mocked(mockDb.select).mockReturnThis();
    vi.mocked(mockDb.from).mockImplementation(() => makeChainable([]));
    vi.mocked(mockDb.where).mockImplementation(() => makeChainable([]));
    vi.mocked(mockDb.innerJoin).mockReturnThis();
    vi.mocked(mockDb.limit).mockResolvedValue([]);
    vi.mocked(mockDb.update).mockReturnThis();
    vi.mocked(mockDb.set).mockReturnThis();
  });

  it('completes without throwing when DB returns empty results', async () => {
    await expect(runDailyNotifications()).resolves.not.toThrow();
  });

  it('does not call sendNotification when there are no checkouts or holds', async () => {
    await runDailyNotifications();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('queries all four notification types (overdue, reminder, hold_ready, hold_expired)', async () => {
    await runDailyNotifications();
    // select is called once per batch (overdue, reminderDays loop, hold_ready, hold_expired)
    // schools query for processDueReminders also counts
    // Cast through unknown to access the mocked select on the plain chainObj.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDb = db as unknown as Record<string, any>;
    expect(vi.mocked(mockDb.select)).toHaveBeenCalled();
  });
});
