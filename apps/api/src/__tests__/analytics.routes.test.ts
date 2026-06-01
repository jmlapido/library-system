import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools, books, bookInventory, checkouts } from '../db/schema/index.js';
import { signAccessToken } from '../lib/jwt.js';

// ─── State ────────────────────────────────────────────────────────────────────

let schoolId: string;
let librarianId: string;
let studentId: string;
let librarianToken: string;
let studentToken: string;

const createdSchoolIds: string[] = [];
const createdUserIds: string[] = [];
const createdBookIds: string[] = [];
const createdInventoryIds: string[] = [];
const createdCheckoutIds: string[] = [];

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `Analytics Test School ${Date.now()}` })
    .returning({ id: schools.id });
  schoolId = school!.id;
  createdSchoolIds.push(schoolId);

  const makeUser = async (prefix: string, role: 'student' | 'librarian') => {
    const [u] = await db.insert(users).values({
      email: `analytics-${prefix}-${Date.now()}@school.test`,
      passwordHash: 'hash',
      fullName: `Analytics ${prefix}`,
      role,
      schoolId,
      isActive: true,
      emailVerified: true,
      approvalStatus: 'approved',
    }).returning({ id: users.id });
    createdUserIds.push(u!.id);
    return u!.id;
  };

  librarianId = await makeUser('librarian', 'librarian');
  studentId = await makeUser('student', 'student');

  librarianToken = signAccessToken({ sub: librarianId, role: 'librarian', schoolId });
  studentToken = signAccessToken({ sub: studentId, role: 'student', schoolId });

  // Insert a book + 2 copies
  const [book] = await db.insert(books).values({
    title: 'Analytics Test Book',
    author: 'Test Author',
    genre: 'Fiction',
    schoolId,
  }).returning({ id: books.id });
  createdBookIds.push(book!.id);

  const [copy1] = await db.insert(bookInventory).values({
    bookId: book!.id,
    barcode: `ANA-${Date.now()}-1`,
    schoolId,
    status: 'available',
  }).returning({ id: bookInventory.id });
  createdInventoryIds.push(copy1!.id);

  const [copy2] = await db.insert(bookInventory).values({
    bookId: book!.id,
    barcode: `ANA-${Date.now()}-2`,
    schoolId,
    status: 'lost',
  }).returning({ id: bookInventory.id });
  createdInventoryIds.push(copy2!.id);

  // Active checkout (not overdue)
  const future = new Date();
  future.setDate(future.getDate() + 7);
  const [activeCheckout] = await db.insert(checkouts).values({
    userId: studentId,
    bookInventoryId: copy1!.id,
    dueDate: future,
    status: 'checked_out',
  }).returning({ id: checkouts.id });
  createdCheckoutIds.push(activeCheckout!.id);

  // Overdue checkout on copy2 (status explicitly 'overdue')
  const past = new Date();
  past.setDate(past.getDate() - 14);
  const [overdueCheckout] = await db.insert(checkouts).values({
    userId: studentId,
    bookInventoryId: copy2!.id,
    dueDate: past,
    status: 'overdue',
  }).returning({ id: checkouts.id });
  createdCheckoutIds.push(overdueCheckout!.id);

  // Returned checkout for activity report
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const [returnedCheckout] = await db.insert(checkouts).values({
    userId: studentId,
    bookInventoryId: copy1!.id,
    dueDate: yesterday,
    returnDate: yesterday,
    status: 'returned',
  }).returning({ id: checkouts.id });
  createdCheckoutIds.push(returnedCheckout!.id);
});

afterAll(async () => {
  if (createdCheckoutIds.length > 0) {
    await db.delete(checkouts).where(inArray(checkouts.id, createdCheckoutIds));
  }
  if (createdInventoryIds.length > 0) {
    await db.delete(bookInventory).where(inArray(bookInventory.id, createdInventoryIds));
  }
  if (createdBookIds.length > 0) {
    await db.delete(books).where(inArray(books.id, createdBookIds));
  }
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  if (createdSchoolIds.length > 0) {
    await db.delete(schools).where(inArray(schools.id, createdSchoolIds));
  }
});

// ─── GET /api/v1/admin/stats ──────────────────────────────────────────────────

describe('GET /api/v1/admin/stats', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/admin/stats');
    expect(res.status).toBe(401);
  });

  it('returns 403 for student role', async () => {
    const res = await app.request('/api/v1/admin/stats', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 with all expected stat fields', async () => {
    const res = await app.request('/api/v1/admin/stats', {
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      data: {
        totalBooks: number;
        totalCopies: number;
        totalUsers: number;
        activeCheckouts: number;
        overdueCheckouts: number;
        holdsWaiting: number;
        booksAvailable: number;
      };
    };
    expect(body.success).toBe(true);
    expect(typeof body.data.totalBooks).toBe('number');
    expect(typeof body.data.totalCopies).toBe('number');
    expect(typeof body.data.totalUsers).toBe('number');
    expect(typeof body.data.activeCheckouts).toBe('number');
    expect(typeof body.data.overdueCheckouts).toBe('number');
    expect(typeof body.data.holdsWaiting).toBe('number');
    expect(typeof body.data.booksAvailable).toBe('number');
    expect(body.data.totalBooks).toBeGreaterThanOrEqual(1);
    expect(body.data.overdueCheckouts).toBeGreaterThanOrEqual(1);
  });
});

// ─── GET /api/v1/admin/reports/overdue ───────────────────────────────────────

describe('GET /api/v1/admin/reports/overdue', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/admin/reports/overdue');
    expect(res.status).toBe(401);
  });

  it('returns 403 for student role', async () => {
    const res = await app.request('/api/v1/admin/reports/overdue', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 with overdue array containing expected fields', async () => {
    const res = await app.request('/api/v1/admin/reports/overdue', {
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      data: Array<{
        checkoutId: string;
        userId: string;
        userFullName: string;
        bookTitle: string;
        daysOverdue: number;
      }>;
    };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    const item = body.data[0]!;
    expect(typeof item.checkoutId).toBe('string');
    expect(typeof item.userId).toBe('string');
    expect(typeof item.userFullName).toBe('string');
    expect(typeof item.bookTitle).toBe('string');
    expect(typeof item.daysOverdue).toBe('number');
    expect(item.daysOverdue).toBeGreaterThan(0);
  });
});

// ─── GET /api/v1/admin/reports/popular ───────────────────────────────────────

describe('GET /api/v1/admin/reports/popular', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/admin/reports/popular');
    expect(res.status).toBe(401);
  });

  it('returns 200 with popular books array', async () => {
    const res = await app.request('/api/v1/admin/reports/popular', {
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      data: Array<{
        bookId: string;
        title: string;
        checkoutCount: number;
        currentlyAvailable: boolean;
      }>;
    };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    if (body.data.length > 0) {
      const item = body.data[0]!;
      expect(typeof item.bookId).toBe('string');
      expect(typeof item.title).toBe('string');
      expect(typeof item.checkoutCount).toBe('number');
      expect(typeof item.currentlyAvailable).toBe('boolean');
    }
  });

  it('returns 422 for invalid limit param', async () => {
    const res = await app.request('/api/v1/admin/reports/popular?limit=0', {
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

// ─── GET /api/v1/admin/reports/activity ──────────────────────────────────────

describe('GET /api/v1/admin/reports/activity', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/admin/reports/activity');
    expect(res.status).toBe(401);
  });

  it('returns 200 with exactly 30 days of data by default', async () => {
    const res = await app.request('/api/v1/admin/reports/activity', {
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      data: Array<{ date: string; checkouts: number; returns: number }>;
    };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(30);
    const item = body.data[0]!;
    expect(typeof item.date).toBe('string');
    expect(/^\d{4}-\d{2}-\d{2}$/.test(item.date)).toBe(true);
    expect(typeof item.checkouts).toBe('number');
    expect(typeof item.returns).toBe('number');
  });

  it('returns custom day range when days param is set', async () => {
    const res = await app.request('/api/v1/admin/reports/activity?days=7', {
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data.length).toBe(7);
  });

  it('returns 422 for invalid days param', async () => {
    const res = await app.request('/api/v1/admin/reports/activity?days=999', {
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

// ─── GET /api/v1/admin/inventory/audit ───────────────────────────────────────

describe('GET /api/v1/admin/inventory/audit', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/admin/inventory/audit');
    expect(res.status).toBe(401);
  });

  it('returns 403 for student role', async () => {
    const res = await app.request('/api/v1/admin/inventory/audit', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 with statusBreakdown array and lostCopies array', async () => {
    const res = await app.request('/api/v1/admin/inventory/audit', {
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      data: {
        statusBreakdown: Array<{ status: string; count: number }>;
        lostCopies: Array<{ copyId: string; barcode: string; bookTitle: string; bookAuthor: string }>;
      };
    };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.statusBreakdown)).toBe(true);
    expect(Array.isArray(body.data.lostCopies)).toBe(true);
    expect(body.data.statusBreakdown.length).toBeGreaterThanOrEqual(1);
    const breakdown = body.data.statusBreakdown[0]!;
    expect(typeof breakdown.status).toBe('string');
    expect(typeof breakdown.count).toBe('number');
  });

  it('includes lost copy in lostCopies list', async () => {
    const res = await app.request('/api/v1/admin/inventory/audit', {
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    const body = await res.json() as {
      data: { lostCopies: Array<{ bookTitle: string }> };
    };
    const hasSeed = body.data.lostCopies.some((c) => c.bookTitle === 'Analytics Test Book');
    expect(hasSeed).toBe(true);
  });
});
