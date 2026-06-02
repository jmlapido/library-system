import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools } from '../db/schema/index.js';
import { holds } from '../db/schema/circulation.js';
import { books } from '../db/schema/books.js';
import { signAccessToken } from '../lib/jwt.js';
import { runHoldExpiry } from '../workers/holdExpiry.worker.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

let schoolId: string;
let librarianToken: string;
let studentToken: string;
let bookId: string;
let oldHoldId: string;
let recentHoldId: string;

const createdUserIds: string[] = [];
const createdHoldIds: string[] = [];
const createdBookIds: string[] = [];

beforeAll(async () => {
  // School with holdExpiryDays = 7
  const [school] = await db
    .insert(schools)
    .values({ name: `HoldExpiry School ${Date.now()}`, settings: { holdExpiryDays: 7 } })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const mkUser = async (role: 'librarian' | 'student') => {
    const [u] = await db.insert(users).values({
      email: `holdexpiry-${role}-${Date.now()}@test.com`,
      passwordHash: 'hash',
      fullName: `HoldExpiry ${role}`,
      role,
      schoolId,
      isActive: true,
      emailVerified: true,
      approvalStatus: 'approved',
    }).returning({ id: users.id });
    createdUserIds.push(u!.id);
    return u!.id;
  };

  const [libId, stuId] = await Promise.all([mkUser('librarian'), mkUser('student')]);
  librarianToken = signAccessToken({ sub: libId, role: 'librarian', schoolId });
  studentToken = signAccessToken({ sub: stuId, role: 'student', schoolId });

  // Book for holds
  const [book] = await db.insert(books).values({
    title: 'HoldExpiry Test Book',
    author: 'Author',
    schoolId,
  }).returning({ id: books.id });
  bookId = book!.id;
  createdBookIds.push(bookId);

  // Old hold — createdAt 10 days ago (beyond 7-day window)
  const oldDate = new Date(Date.now() - 10 * 86_400_000);
  const [oldHold] = await db.insert(holds).values({
    userId: stuId,
    bookId,
    position: 1,
    status: 'pending',
    createdAt: oldDate,
  }).returning({ id: holds.id });
  oldHoldId = oldHold!.id;
  createdHoldIds.push(oldHoldId);

  // Recent hold — createdAt 2 days ago (within window)
  const recentDate = new Date(Date.now() - 2 * 86_400_000);
  const [recentHold] = await db.insert(holds).values({
    userId: stuId,
    bookId,
    position: 2,
    status: 'pending',
    createdAt: recentDate,
  }).returning({ id: holds.id });
  recentHoldId = recentHold!.id;
  createdHoldIds.push(recentHoldId);
});

afterAll(async () => {
  for (const id of createdHoldIds) await db.delete(holds).where(eq(holds.id, id));
  for (const id of createdBookIds) await db.delete(books).where(eq(books.id, id));
  for (const id of createdUserIds) await db.delete(users).where(eq(users.id, id));
  await db.delete(schools).where(eq(schools.id, schoolId));
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runHoldExpiry — BullMQ job logic', () => {
  it('expires pending holds older than holdExpiryDays', async () => {
    await runHoldExpiry();

    const [row] = await db
      .select({ status: holds.status })
      .from(holds)
      .where(eq(holds.id, oldHoldId))
      .limit(1);

    expect(row?.status).toBe('expired');
  });

  it('does NOT expire holds within the expiry window', async () => {
    // runHoldExpiry already ran in the previous test; recent hold should still be pending
    const [row] = await db
      .select({ status: holds.status })
      .from(holds)
      .where(eq(holds.id, recentHoldId))
      .limit(1);

    expect(row?.status).toBe('pending');
  });
});

describe('DELETE /api/v1/circulation/holds/:id/expire', () => {
  it('sets hold status to expired for librarian', async () => {
    const res = await app.request(`/api/v1/circulation/holds/${recentHoldId}/expire`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${librarianToken}` },
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { holdId: string; status: string } };
    expect(json.success).toBe(true);
    expect(json.data.holdId).toBe(recentHoldId);
    expect(json.data.status).toBe('expired');

    // Verify in DB
    const [row] = await db
      .select({ status: holds.status })
      .from(holds)
      .where(eq(holds.id, recentHoldId))
      .limit(1);
    expect(row?.status).toBe('expired');
  });

  it('returns 401 for unauthenticated request', async () => {
    const res = await app.request(`/api/v1/circulation/holds/${recentHoldId}/expire`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });
});
