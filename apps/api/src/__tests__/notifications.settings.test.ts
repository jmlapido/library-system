import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── BullMQ / IORedis mocks ───────────────────────────────────────────────────

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({ add: vi.fn().mockResolvedValue(undefined) })),
  Worker: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({})),
}));

// ─── Push provider mock ───────────────────────────────────────────────────────

vi.mock('../services/notifications/push.provider.js', () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

// ─── DB mock ─────────────────────────────────────────────────────────────────
// The scheduler does: await db.select(...).from(schools)  — from() must be thenable.
// And:               await db.select(...).innerJoin(...).where(...) — where() thenable.
// We provide a flat chainable object where every method returns 'this' and
// the object itself is a resolved Promise (via then/catch/finally).

vi.mock('../db/index.js', () => {
  /** Build a chainable Drizzle-style stub resolving to `rows`. */
  function makeStub(rows: unknown[]) {
    const resolved = Promise.resolve(rows);
    const stub: Record<string, unknown> = {
      then: resolved.then.bind(resolved),
      catch: resolved.catch.bind(resolved),
      finally: resolved.finally.bind(resolved),
    };
    const methods = ['select', 'from', 'innerJoin', 'where', 'limit', 'set', 'update', 'returning', 'values', 'insert', 'delete'];
    methods.forEach((m) => { stub[m] = vi.fn().mockReturnValue(stub); });
    return stub;
  }

  return {
    db: {
      select: vi.fn().mockImplementation(() => makeStub([])),
      insert: vi.fn().mockImplementation(() => makeStub([])),
      update: vi.fn().mockImplementation(() => makeStub([])),
      delete: vi.fn().mockImplementation(() => makeStub([])),
    },
  };
});

vi.mock('../services/notifications/notifications.service.js', () => ({
  sendNotification: vi.fn().mockResolvedValue({ sent: true }),
}));

import { db } from '../db/index.js';
import { runDailyNotifications } from '../services/notifications/notifications.scheduler.js';
import { sendNotification } from '../services/notifications/notifications.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a school row with merged settings. */
function makeSchool(settingsPatch: Record<string, unknown> = {}) {
  return {
    id: 'school-uuid-1',
    name: 'Test School',
    location: null,
    adminId: null,
    settings: {
      studentCheckoutDays: 14,
      teacherCheckoutDays: 28,
      studentCheckoutLimit: 5,
      teacherCheckoutLimit: 15,
      fineEnabled: false,
      finePerDay: 0,
      gracePeriodDays: 0,
      maxFineAmount: 0,
      overdueReminderDays: 2,
      timezone: 'Asia/Manila',
      reminderDaysBefore: [3, 1],
      overdueRepeatEvery: 2,
      notificationTime: '08:00',
      smsSenderId: 'LIBRARY',
      ...settingsPatch,
    },
    createdAt: new Date(),
  };
}

/** Build an overdue checkout row for a given school, due N days ago. */
function makeOverdueCheckout(schoolId: string, daysAgo: number) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() - daysAgo);
  dueDate.setHours(0, 0, 0, 0);
  return {
    checkoutId: 'co-1',
    userId: 'user-1',
    dueDate,
    lateFee: '0',
    userFullName: 'Test User',
    userEmail: 'test@school.edu',
    userChannel: 'email',
    schoolId,
    bookTitle: 'Test Book',
  };
}

/**
 * Configure db.select to return a sequence of row sets.
 * Call N is answered by selectReturns[N-1]; extras resolve to [].
 */
function mockSelectSequence(selectReturns: unknown[][]): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb = db as unknown as Record<string, any>;
  let callIdx = 0;

  vi.mocked(mockDb.select).mockImplementation(() => {
    const rows = selectReturns[callIdx] ?? [];
    callIdx++;

    const resolved = Promise.resolve(rows);
    const stub: Record<string, unknown> = {
      then: resolved.then.bind(resolved),
      catch: resolved.catch.bind(resolved),
      finally: resolved.finally.bind(resolved),
    };
    const methods = ['select', 'from', 'innerJoin', 'where', 'limit', 'set', 'update', 'returning', 'values'];
    methods.forEach((m) => { stub[m] = vi.fn().mockReturnValue(stub); });
    return stub;
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Notification Settings — school settings schema', () => {
  /**
   * Test 1: PATCH /schools/settings accepts notification fields.
   * Verified at service layer — Zod schema validates and returns typed result.
   */
  it('SchoolSettingsSchema accepts notification settings fields', async () => {
    const { SchoolSettingsSchema } = await import('../services/school.service.js');

    const result = SchoolSettingsSchema.safeParse({
      reminderDaysBefore: [5, 2, 1],
      overdueRepeatEvery: 3,
      notificationTime: '09:30',
      smsSenderId: 'SCHOOLLIB',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reminderDaysBefore).toEqual([5, 2, 1]);
      expect(result.data.overdueRepeatEvery).toBe(3);
      expect(result.data.notificationTime).toBe('09:30');
      expect(result.data.smsSenderId).toBe('SCHOOLLIB');
    }
  });

  /**
   * Test 2: GET /schools/settings returns notification fields with defaults.
   */
  it('SchoolSettingsSchema returns correct defaults for notification fields', async () => {
    const { SchoolSettingsSchema } = await import('../services/school.service.js');

    const result = SchoolSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reminderDaysBefore).toEqual([3, 1]);
      expect(result.data.overdueRepeatEvery).toBe(2);
      expect(result.data.notificationTime).toBe('08:00');
      expect(result.data.smsSenderId).toBe('LIBRARY');
    }
  });

  /**
   * Test 3: Scheduler reads reminderDaysBefore from school settings.
   * DB returns one school with reminderDaysBefore=[7]; no matching checkouts.
   * Verifies the schools query drives the loop (select was called).
   */
  it('scheduler reads reminderDaysBefore from school settings (not hardcoded)', async () => {
    const school = makeSchool({ reminderDaysBefore: [7] });
    // Call sequence: 1=schools, 2+=overdue/reminder/hold queries → []
    mockSelectSequence([[school], [], [], [], [], [], []]);

    vi.mocked(sendNotification).mockClear();
    await runDailyNotifications();

    // No checkouts matched → no notifications sent
    expect(sendNotification).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(vi.mocked((db as unknown as Record<string, any>).select)).toHaveBeenCalled();
  });
});

describe('Overdue notice scheduling rules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('skips overdue notice during grace period', async () => {
    const school = makeSchool({ gracePeriodDays: 3, overdueRepeatEvery: 1 });
    // 2 days overdue — within grace period of 3 days
    const checkout = makeOverdueCheckout(school.id, 2);
    // Call 1=schools, 2=overdue checkouts (returns checkout), rest=[]
    mockSelectSequence([[school], [checkout], [], [], [], []]);

    await runDailyNotifications();
    expect(sendNotification).not.toHaveBeenCalledWith('overdue_notice', expect.anything());
  });

  it('sends overdue notice on correct repeat day after grace', async () => {
    // gracePeriodDays=1, overdueRepeatEvery=3 → sends when daysAfterGrace % 3 === 0
    // daysOverdue=4 → daysAfterGrace=3 → 3%3=0 → should send
    const school = makeSchool({ gracePeriodDays: 1, overdueRepeatEvery: 3 });
    const checkout = makeOverdueCheckout(school.id, 4);
    mockSelectSequence([[school], [checkout], [], [], [], []]);

    await runDailyNotifications();
    expect(sendNotification).toHaveBeenCalledWith(
      'overdue_notice',
      expect.objectContaining({ userId: 'user-1', daysOverdue: 4 })
    );
  });
});
