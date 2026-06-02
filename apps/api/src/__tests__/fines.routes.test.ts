import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools } from '../db/schema/index.js';
import { checkouts } from '../db/schema/circulation.js';
import { bookInventory, books } from '../db/schema/books.js';
import { signAccessToken } from '../lib/jwt.js';

// ─── Test fixtures ────────────────────────────────────────────────────────────

let schoolId: string;
let librarianToken: string;
let studentToken: string;
let checkoutId: string;

const createdUserIds: string[] = [];
const createdCheckoutIds: string[] = [];
const createdInventoryIds: string[] = [];
const createdBookIds: string[] = [];

beforeAll(async () => {
  const [school] = await db.insert(schools).values({ name: `Fines School ${Date.now()}` }).returning({ id: schools.id });
  schoolId = school!.id;

  const mkUser = async (role: 'librarian' | 'student') => {
    const [u] = await db.insert(users).values({
      email: `fines-${role}-${Date.now()}@test.com`,
      passwordHash: 'hash',
      fullName: `Fines ${role}`,
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

  // Create a book + inventory copy for the checkout
  const [book] = await db.insert(books).values({
    title: 'Fine Test Book',
    author: 'Author',
    schoolId,
  }).returning({ id: books.id });
  createdBookIds.push(book!.id);

  const [copy] = await db.insert(bookInventory).values({
    bookId: book!.id,
    barcode: `FINE-BARCODE-${Date.now()}`,
    schoolId,
    status: 'checked_out',
  }).returning({ id: bookInventory.id });
  createdInventoryIds.push(copy!.id);

  // Overdue checkout with a fine
  const pastDue = new Date(Date.now() - 5 * 86_400_000);
  const [co] = await db.insert(checkouts).values({
    userId: stuId,
    bookInventoryId: copy!.id,
    dueDate: pastDue,
    status: 'overdue',
    fineAmount: '2.50',
    finePaid: false,
    fineWaived: false,
  }).returning({ id: checkouts.id });
  checkoutId = co!.id;
  createdCheckoutIds.push(checkoutId);
});

afterAll(async () => {
  for (const id of createdCheckoutIds) await db.delete(checkouts).where(eq(checkouts.id, id));
  for (const id of createdInventoryIds) await db.delete(bookInventory).where(eq(bookInventory.id, id));
  for (const id of createdBookIds) await db.delete(books).where(eq(books.id, id));
  for (const id of createdUserIds) await db.delete(users).where(eq(users.id, id));
  await db.delete(schools).where(eq(schools.id, schoolId));
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/fines', () => {
  it('returns 401 without token', async () => {
    const res = await app.request('/api/v1/fines');
    expect(res.status).toBe(401);
  });

  it('returns 403 for student role', async () => {
    const res = await app.request('/api/v1/fines', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('GET /fines returns outstanding fines for librarian', async () => {
    const res = await app.request('/api/v1/fines', {
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { checkoutId: string; fineAmount: number }[] };
    expect(json.success).toBe(true);
    const match = json.data.find((f) => f.checkoutId === checkoutId);
    expect(match).toBeDefined();
    expect(match!.fineAmount).toBe(2.5);
  });

  it('GET /fines?status=all returns all fine records', async () => {
    const res = await app.request('/api/v1/fines?status=all', {
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { checkoutId: string }[] };
    expect(json.success).toBe(true);
    expect(json.data.some((f) => f.checkoutId === checkoutId)).toBe(true);
  });
});

describe('POST /api/v1/fines/:id/waive', () => {
  it('marks fine as waived', async () => {
    // Use a fresh checkout so we don't clobber the other tests
    const [copy2] = await db.select({ id: bookInventory.id }).from(bookInventory).where(eq(bookInventory.id, createdInventoryIds[0]!));
    const pastDue = new Date(Date.now() - 3 * 86_400_000);
    const [stuRow] = await db.select({ id: users.id }).from(users).where(eq(users.id, createdUserIds[1]!));

    const [co] = await db.insert(checkouts).values({
      userId: stuRow!.id,
      bookInventoryId: copy2!.id,
      dueDate: pastDue,
      status: 'returned',
      fineAmount: '1.50',
      finePaid: false,
      fineWaived: false,
    }).returning({ id: checkouts.id });
    createdCheckoutIds.push(co!.id);

    const res = await app.request(`/api/v1/fines/${co!.id}/waive`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Student appeal' }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { fineWaived: boolean } };
    expect(json.success).toBe(true);
    expect(json.data.fineWaived).toBe(true);
  });
});

describe('POST /api/v1/fines/:id/mark-paid', () => {
  it('marks fine as paid', async () => {
    const res = await app.request(`/api/v1/fines/${checkoutId}/mark-paid`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { finePaid: boolean } };
    expect(json.success).toBe(true);
    expect(json.data.finePaid).toBe(true);
  });
});
