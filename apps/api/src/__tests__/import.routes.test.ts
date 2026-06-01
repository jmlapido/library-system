import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray, and } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools } from '../db/schema/index.js';
import { books, bookInventory } from '../db/schema/books.js';
import { signAccessToken } from '../lib/jwt.js';

let schoolId: string;
let librarianId: string;
let studentUserId: string;
let librarianToken: string;
let studentToken: string;

const createdUserIds: string[] = [];
const createdBookIds: string[] = [];

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `Import Test School ${Date.now()}` })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const makeUser = async (prefix: string, role: 'student' | 'librarian') => {
    const [u] = await db
      .insert(users)
      .values({
        email: `import-${prefix}-${Date.now()}@school.com`,
        passwordHash: 'hash',
        fullName: `Import ${prefix}`,
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

  librarianId = await makeUser('librarian', 'librarian');
  studentUserId = await makeUser('student', 'student');

  librarianToken = signAccessToken({ sub: librarianId, role: 'librarian', schoolId });
  studentToken = signAccessToken({ sub: studentUserId, role: 'student', schoolId });
});

afterAll(async () => {
  // Remove imported students for this school (those without passwordHash set)
  const importedStudents = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.schoolId, schoolId), eq(users.role, 'student')));
  const importedIds = importedStudents.map((r) => r.id);
  const allToDelete = [...new Set([...importedIds, ...createdUserIds])];
  if (allToDelete.length > 0) {
    await db.delete(users).where(inArray(users.id, allToDelete));
  }

  // Remove imported books
  if (createdBookIds.length > 0) {
    await db.delete(bookInventory).where(inArray(bookInventory.bookId, createdBookIds));
    await db.delete(books).where(inArray(books.id, createdBookIds));
  }
  const remainingBooks = await db
    .select({ id: books.id })
    .from(books)
    .where(eq(books.schoolId, schoolId));
  if (remainingBooks.length > 0) {
    const ids = remainingBooks.map((r) => r.id);
    await db.delete(bookInventory).where(inArray(bookInventory.bookId, ids));
    await db.delete(books).where(inArray(books.id, ids));
  }

  await db.delete(schools).where(eq(schools.id, schoolId));
});

// ─── POST /api/v1/users/import ────────────────────────────────────────────────

describe('POST /api/v1/users/import', () => {
  const ts = Date.now();
  const sid1 = `IMP-${ts}-001`;
  const sid2 = `IMP-${ts}-002`;
  const validCsv = [
    'fullName,studentId,gradeLevel,email,pin',
    `Juan dela Cruz,${sid1},7,,1234`,
    `Maria Santos,${sid2},8,,`,
  ].join('\n');

  it('returns 401 without token', async () => {
    const form = new FormData();
    form.append('file', new Blob([validCsv], { type: 'text/csv' }), 'import.csv');
    const res = await app.request('/api/v1/users/import', { method: 'POST', body: form });
    expect(res.status).toBe(401);
  });

  it('returns 403 for student role', async () => {
    const form = new FormData();
    form.append('file', new Blob([validCsv], { type: 'text/csv' }), 'import.csv');
    const res = await app.request('/api/v1/users/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: form,
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 with valid CSV and reports inserted count', async () => {
    const form = new FormData();
    form.append('file', new Blob([validCsv], { type: 'text/csv' }), 'import.csv');
    const res = await app.request('/api/v1/users/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: form,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      data: { inserted: number; updated: number; skipped: number; errors: unknown[] };
    };
    expect(body.success).toBe(true);
    expect(body.data.inserted).toBe(2);
    expect(body.data.updated).toBe(0);
    expect(body.data.errors).toHaveLength(0);
  });

  it('returns 200 with duplicate studentId and reports updated count', async () => {
    const form = new FormData();
    form.append('file', new Blob([validCsv], { type: 'text/csv' }), 'import.csv');
    const res = await app.request('/api/v1/users/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: form,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      data: { inserted: number; updated: number };
    };
    expect(body.success).toBe(true);
    expect(body.data.inserted).toBe(0);
    expect(body.data.updated).toBe(2);
  });

  it('returns 200 but reports row errors for missing required fields', async () => {
    const badCsv = [
      'fullName,studentId,gradeLevel,email,pin',
      ',2024-999,7,,1234',   // fullName missing
      'Valid Name,,8,,',     // studentId missing
    ].join('\n');
    const form = new FormData();
    form.append('file', new Blob([badCsv], { type: 'text/csv' }), 'import.csv');
    const res = await app.request('/api/v1/users/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: form,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      data: { inserted: number; skipped: number; errors: Array<{ row: number; message: string }> };
    };
    expect(body.success).toBe(true);
    expect(body.data.inserted).toBe(0);
    expect(body.data.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('returns 422 when no file field is provided', async () => {
    const form = new FormData();
    const res = await app.request('/api/v1/users/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: form,
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { success: boolean; code: string };
    expect(body.success).toBe(false);
    expect(body.code).toBe('MISSING_FILE');
  });
});

// ─── POST /api/v1/books/import/csv ───────────────────────────────────────────

describe('POST /api/v1/books/import/csv', () => {
  const validBookCsv = [
    'isbn,title,author,publisher,publicationYear,genre,description,copies,barcode',
    '9780439023480,The Hunger Games,Suzanne Collins,Scholastic,2008,Fiction,,2,HG-001|HG-002',
    ',The Great Gatsby,F. Scott Fitzgerald,Scribner,1925,Classic,,1,',
  ].join('\n');

  it('returns 401 without token', async () => {
    const form = new FormData();
    form.append('file', new Blob([validBookCsv], { type: 'text/csv' }), 'books.csv');
    const res = await app.request('/api/v1/books/import/csv', { method: 'POST', body: form });
    expect(res.status).toBe(401);
  });

  it('returns 403 for student role', async () => {
    const form = new FormData();
    form.append('file', new Blob([validBookCsv], { type: 'text/csv' }), 'books.csv');
    const res = await app.request('/api/v1/books/import/csv', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: form,
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 with valid CSV and reports booksCreated + copiesCreated', async () => {
    const form = new FormData();
    form.append('file', new Blob([validBookCsv], { type: 'text/csv' }), 'books.csv');
    const res = await app.request('/api/v1/books/import/csv', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: form,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      data: { booksCreated: number; booksUpdated: number; copiesCreated: number; errors: unknown[] };
    };
    expect(body.success).toBe(true);
    expect(body.data.booksCreated).toBe(2);
    expect(body.data.booksUpdated).toBe(0);
    expect(body.data.copiesCreated).toBe(3); // 2 explicit + 1 auto-generated
    expect(body.data.errors).toHaveLength(0);

    // Track created book IDs for cleanup
    const created = await db
      .select({ id: books.id })
      .from(books)
      .where(eq(books.schoolId, schoolId));
    created.forEach((r) => {
      if (!createdBookIds.includes(r.id)) createdBookIds.push(r.id);
    });
  });

  it('returns 200 with duplicate ISBN and reports booksUpdated, skips existing barcodes', async () => {
    const duplicateCsv = [
      'isbn,title,author,publisher,publicationYear,genre,description,copies,barcode',
      '9780439023480,The Hunger Games Updated,Suzanne Collins,Scholastic,2008,Fiction,,1,HG-001',
    ].join('\n');
    const form = new FormData();
    form.append('file', new Blob([duplicateCsv], { type: 'text/csv' }), 'books.csv');
    const res = await app.request('/api/v1/books/import/csv', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: form,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      data: { booksCreated: number; booksUpdated: number; copiesCreated: number };
    };
    expect(body.success).toBe(true);
    expect(body.data.booksUpdated).toBe(1);
    expect(body.data.booksCreated).toBe(0);
    expect(body.data.copiesCreated).toBe(0); // barcode HG-001 already exists
  });

  it('returns 200 but reports row errors for missing required fields', async () => {
    const badCsv = [
      'isbn,title,author,publisher,publicationYear,genre,description,copies,barcode',
      ',,Missing Author,,,,,,',   // title and author missing
    ].join('\n');
    const form = new FormData();
    form.append('file', new Blob([badCsv], { type: 'text/csv' }), 'books.csv');
    const res = await app.request('/api/v1/books/import/csv', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: form,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      data: { booksCreated: number; errors: Array<{ row: number; message: string }> };
    };
    expect(body.success).toBe(true);
    expect(body.data.booksCreated).toBe(0);
    expect(body.data.errors.length).toBeGreaterThanOrEqual(1);
  });
});
