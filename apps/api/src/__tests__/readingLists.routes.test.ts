import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray, and } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools, books, readingLists, readingListItems } from '../db/schema/index.js';
import { signAccessToken } from '../lib/jwt.js';

let schoolId: string;
let studentId: string;
let otherStudentId: string;
let studentToken: string;
let otherStudentToken: string;
let bookId: string;

const createdUserIds: string[] = [];
const createdListIds: string[] = [];

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `Reading Lists Test School ${Date.now()}` })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const [student] = await db.insert(users).values({
    email: `rl-student-${Date.now()}@school.com`,
    passwordHash: 'hash',
    fullName: 'RL Student',
    role: 'student',
    schoolId,
    isActive: true,
    emailVerified: true,
    approvalStatus: 'approved',
  }).returning({ id: users.id });
  studentId = student!.id;
  createdUserIds.push(studentId);
  studentToken = signAccessToken({ sub: studentId, role: 'student', schoolId });

  const [other] = await db.insert(users).values({
    email: `rl-other-${Date.now()}@school.com`,
    passwordHash: 'hash',
    fullName: 'RL Other Student',
    role: 'student',
    schoolId,
    isActive: true,
    emailVerified: true,
    approvalStatus: 'approved',
  }).returning({ id: users.id });
  otherStudentId = other!.id;
  createdUserIds.push(otherStudentId);
  otherStudentToken = signAccessToken({ sub: otherStudentId, role: 'student', schoolId });

  const [book] = await db.insert(books).values({
    title: 'Test Book for Reading Lists',
    author: 'Test Author',
    schoolId,
  }).returning({ id: books.id });
  bookId = book!.id;
});

afterAll(async () => {
  if (createdListIds.length > 0) {
    await db.delete(readingListItems).where(inArray(readingListItems.listId, createdListIds));
    await db.delete(readingLists).where(inArray(readingLists.id, createdListIds));
  }
  // clean up any remaining lists for our test users
  const remaining = await db
    .select({ id: readingLists.id })
    .from(readingLists)
    .where(inArray(readingLists.userId, createdUserIds));
  if (remaining.length > 0) {
    const ids = remaining.map((r) => r.id);
    await db.delete(readingListItems).where(inArray(readingListItems.listId, ids));
    await db.delete(readingLists).where(inArray(readingLists.id, ids));
  }
  await db.delete(books).where(eq(books.id, bookId));
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  await db.delete(schools).where(eq(schools.id, schoolId));
});

// ─── POST /api/v1/reading-lists ───────────────────────────────────────────────

describe('POST /api/v1/reading-lists', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/reading-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'My List' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 422 when title is missing', async () => {
    const res = await app.request('/api/v1/reading-lists', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'no title here' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { success: boolean; code: string };
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 201 and creates a list', async () => {
    const res = await app.request('/api/v1/reading-lists', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'My Test List', description: 'A test list', isPublic: false }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { id: string; title: string } };
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('My Test List');
    createdListIds.push(body.data.id);
  });
});

// ─── GET /api/v1/reading-lists ────────────────────────────────────────────────

describe('GET /api/v1/reading-lists', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/reading-lists');
    expect(res.status).toBe(401);
  });

  it('returns 200 with user lists', async () => {
    const res = await app.request('/api/v1/reading-lists', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('does not return lists belonging to other users', async () => {
    const res = await app.request('/api/v1/reading-lists', {
      headers: { Authorization: `Bearer ${otherStudentToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: Array<{ id: string }> };
    const studentListIds = createdListIds;
    const leaked = body.data.some((l) => studentListIds.includes(l.id));
    expect(leaked).toBe(false);
  });
});

// ─── GET /api/v1/reading-lists/:id ────────────────────────────────────────────

describe('GET /api/v1/reading-lists/:id', () => {
  let listId: string;

  beforeAll(async () => {
    const res = await app.request('/api/v1/reading-lists', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Detail Test List' }),
    });
    const body = await res.json() as { data: { id: string } };
    listId = body.data.id;
    createdListIds.push(listId);
  });

  it('returns 401 without auth token', async () => {
    const res = await app.request(`/api/v1/reading-lists/${listId}`);
    expect(res.status).toBe(401);
  });

  it('returns 200 with list and items for owner', async () => {
    const res = await app.request(`/api/v1/reading-lists/${listId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { id: string; items: unknown[] } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(listId);
    expect(Array.isArray(body.data.items)).toBe(true);
  });

  it('returns 403 when another user accesses the list', async () => {
    const res = await app.request(`/api/v1/reading-lists/${listId}`, {
      headers: { Authorization: `Bearer ${otherStudentToken}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('LIST_ACCESS_DENIED');
  });

  it('returns 404 for non-existent list', async () => {
    const res = await app.request('/api/v1/reading-lists/00000000-0000-0000-0000-000000000000', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('LIST_NOT_FOUND');
  });
});

// ─── Book operations ──────────────────────────────────────────────────────────

describe('Reading list book operations', () => {
  let listId: string;

  beforeAll(async () => {
    const res = await app.request('/api/v1/reading-lists', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Book Ops List' }),
    });
    const body = await res.json() as { data: { id: string } };
    listId = body.data.id;
    createdListIds.push(listId);
  });

  it('POST /books returns 201 and adds book', async () => {
    const res = await app.request(`/api/v1/reading-lists/${listId}/books`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, status: 'to_read' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { bookId: string; status: string } };
    expect(body.success).toBe(true);
    expect(body.data.bookId).toBe(bookId);
    expect(body.data.status).toBe('to_read');
  });

  it('POST /books returns 409 on duplicate', async () => {
    const res = await app.request(`/api/v1/reading-lists/${listId}/books`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId }),
    });
    expect(res.status).toBe(409);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('BOOK_ALREADY_IN_LIST');
  });

  it('PATCH /books/:bookId returns 200 and updates status', async () => {
    const res = await app.request(`/api/v1/reading-lists/${listId}/books/${bookId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reading' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { status: string } };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('reading');
  });

  it('PATCH /books/:bookId returns 401 without token', async () => {
    const res = await app.request(`/api/v1/reading-lists/${listId}/books/${bookId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /books/:bookId returns 200 and removes book', async () => {
    const res = await app.request(`/api/v1/reading-lists/${listId}/books/${bookId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('DELETE /books/:bookId returns 404 after removal', async () => {
    const res = await app.request(`/api/v1/reading-lists/${listId}/books/${bookId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(404);
  });
});

// ─── PATCH + DELETE list ──────────────────────────────────────────────────────

describe('PATCH and DELETE /api/v1/reading-lists/:id', () => {
  let listId: string;

  beforeAll(async () => {
    const res = await app.request('/api/v1/reading-lists', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Patch Delete List' }),
    });
    const body = await res.json() as { data: { id: string } };
    listId = body.data.id;
    createdListIds.push(listId);
  });

  it('PATCH returns 403 for non-owner', async () => {
    const res = await app.request(`/api/v1/reading-lists/${listId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${otherStudentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Stolen Title' }),
    });
    expect(res.status).toBe(403);
  });

  it('PATCH returns 200 and updates title', async () => {
    const res = await app.request(`/api/v1/reading-lists/${listId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Title', isPublic: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { title: string; isPublic: boolean } };
    expect(body.success).toBe(true);
    expect(body.data.title).toBe('Updated Title');
    expect(body.data.isPublic).toBe(true);
  });

  it('DELETE returns 403 for non-owner', async () => {
    const res = await app.request(`/api/v1/reading-lists/${listId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${otherStudentToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('DELETE returns 200 and removes list', async () => {
    const res = await app.request(`/api/v1/reading-lists/${listId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
    // Remove from cleanup array since already deleted
    const idx = createdListIds.indexOf(listId);
    if (idx !== -1) createdListIds.splice(idx, 1);
  });

  it('DELETE returns 404 for already-deleted list', async () => {
    const res = await app.request(`/api/v1/reading-lists/${listId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(404);
  });
});
