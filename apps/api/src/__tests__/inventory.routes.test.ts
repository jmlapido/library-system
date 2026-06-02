import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools } from '../db/schema/index.js';
import { bookInventory, books } from '../db/schema/books.js';
import { signAccessToken } from '../lib/jwt.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

let schoolId: string;
let librarianToken: string;
let studentToken: string;
let copyId: string;
let staleBarcode: string;
let freshBarcode: string;

const createdUserIds: string[] = [];
const createdBookIds: string[] = [];
const createdInventoryIds: string[] = [];

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `Inventory School ${Date.now()}` })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const mkUser = async (role: 'librarian' | 'student') => {
    const [u] = await db
      .insert(users)
      .values({
        email: `inv-${role}-${Date.now()}@test.com`,
        passwordHash: 'hash',
        fullName: `Inv ${role}`,
        role,
        schoolId,
        isActive: true,
        emailVerified: true,
        approvalStatus: 'approved',
      })
      .returning({ id: users.id });
    createdUserIds.push(u!.id);
    return u!.id;
  };

  const [libId, stuId] = await Promise.all([mkUser('librarian'), mkUser('student')]);
  librarianToken = signAccessToken({ sub: libId, role: 'librarian', schoolId });
  studentToken = signAccessToken({ sub: stuId, role: 'student', schoolId });

  // Book for available copies
  const [book] = await db
    .insert(books)
    .values({ title: 'Audit Test Book', author: 'Author', schoolId })
    .returning({ id: books.id });
  createdBookIds.push(book!.id);

  // Available copy — will be treated as "on shelf" in audit expectations
  const freshBarcodeVal = `INV-FRESH-${Date.now()}`;
  freshBarcode = freshBarcodeVal;
  const [freshCopy] = await db
    .insert(bookInventory)
    .values({ bookId: book!.id, barcode: freshBarcodeVal, schoolId, status: 'available' })
    .returning({ id: bookInventory.id });
  createdInventoryIds.push(freshCopy!.id);
  copyId = freshCopy!.id;

  // Stale available copy — updatedAt will remain at default (now), but we'll
  // test the missing endpoint using the actual query. For test isolation we
  // just confirm the endpoint returns success.
  const staleBarcodeVal = `INV-STALE-${Date.now()}`;
  staleBarcode = staleBarcodeVal;
  const [staleCopy] = await db
    .insert(bookInventory)
    .values({ bookId: book!.id, barcode: staleBarcodeVal, schoolId, status: 'available' })
    .returning({ id: bookInventory.id });
  createdInventoryIds.push(staleCopy!.id);
});

afterAll(async () => {
  for (const id of createdInventoryIds) {
    await db.delete(bookInventory).where(eq(bookInventory.id, id));
  }
  for (const id of createdBookIds) {
    await db.delete(books).where(eq(books.id, id));
  }
  for (const id of createdUserIds) {
    await db.delete(users).where(eq(users.id, id));
  }
  await db.delete(schools).where(eq(schools.id, schoolId));
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/v1/inventory/audit', () => {
  it('returns correct found/missing/unexpected lists', async () => {
    // Scan freshBarcode but NOT staleBarcode → stale is missing, fresh is found
    const res = await app.request('/api/v1/inventory/audit', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${librarianToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scannedBarcodes: [freshBarcode] }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: {
        scannedCount: number;
        expectedCount: number;
        found: { barcode: string }[];
        missing: { barcode: string }[];
        unexpected: { barcode: string }[];
      };
    };

    expect(json.success).toBe(true);
    expect(json.data.scannedCount).toBe(1);
    expect(json.data.found.some((f) => f.barcode === freshBarcode)).toBe(true);
    expect(json.data.missing.some((m) => m.barcode === staleBarcode)).toBe(true);
  });

  it('returns 401 without a token', async () => {
    const res = await app.request('/api/v1/inventory/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scannedBarcodes: [] }),
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/inventory/missing', () => {
  it('returns stale copies report successfully', async () => {
    const res = await app.request('/api/v1/inventory/missing', {
      headers: { Authorization: `Bearer ${librarianToken}` },
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: unknown[] };
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('returns 401 without token', async () => {
    const res = await app.request('/api/v1/inventory/missing');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/inventory/copies/:id/condition', () => {
  it('updates copy condition successfully', async () => {
    const res = await app.request(`/api/v1/inventory/copies/${copyId}/condition`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${librarianToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ condition: 'fair' }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { copyId: string; condition: string } };
    expect(json.success).toBe(true);
    expect(json.data.condition).toBe('fair');
    expect(json.data.copyId).toBe(copyId);
  });

  it('returns 401 for unauthorized access', async () => {
    const res = await app.request(`/api/v1/inventory/copies/${copyId}/condition`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ condition: 'good' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for student role', async () => {
    const res = await app.request(`/api/v1/inventory/copies/${copyId}/condition`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ condition: 'good' }),
    });
    expect(res.status).toBe(403);
  });
});
