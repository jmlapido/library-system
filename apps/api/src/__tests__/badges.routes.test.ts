import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools } from '../db/schema/index.js';
import { badges, userBadges } from '../db/schema/engagement.js';
import { signAccessToken } from '../lib/jwt.js';

let schoolId: string;
let adminId: string;
let librarianId: string;
let studentId: string;
let adminToken: string;
let librarianToken: string;
let studentToken: string;

const createdUserIds: string[] = [];
const createdBadgeIds: string[] = [];

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `Badges Test School ${Date.now()}` })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const makeUser = async (prefix: string, role: 'student' | 'librarian' | 'admin') => {
    const [u] = await db.insert(users).values({
      email: `badges-${prefix}-${Date.now()}@school.com`,
      passwordHash: 'hash',
      fullName: `Badges ${prefix}`,
      role,
      schoolId,
      isActive: true,
      emailVerified: true,
      approvalStatus: 'approved',
    }).returning({ id: users.id });
    createdUserIds.push(u!.id);
    return u!.id;
  };

  adminId = await makeUser('admin', 'admin');
  librarianId = await makeUser('librarian', 'librarian');
  studentId = await makeUser('student', 'student');

  adminToken = signAccessToken({ sub: adminId, role: 'admin', schoolId });
  librarianToken = signAccessToken({ sub: librarianId, role: 'librarian', schoolId });
  studentToken = signAccessToken({ sub: studentId, role: 'student', schoolId });
});

afterAll(async () => {
  if (createdBadgeIds.length > 0) {
    await db.delete(userBadges).where(inArray(userBadges.badgeId, createdBadgeIds));
    await db.delete(badges).where(inArray(badges.id, createdBadgeIds));
  }
  // clean up any remaining badges for the test school
  const remaining = await db.select({ id: badges.id }).from(badges).where(eq(badges.schoolId, schoolId));
  if (remaining.length > 0) {
    const ids = remaining.map((r) => r.id);
    await db.delete(userBadges).where(inArray(userBadges.badgeId, ids));
    await db.delete(badges).where(inArray(badges.id, ids));
  }
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  await db.delete(schools).where(eq(schools.id, schoolId));
});

// ─── GET /api/v1/badges ──────────────────────────────────────────────────────

describe('GET /api/v1/badges', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/badges');
    expect(res.status).toBe(401);
  });

  it('returns 200 with badge list', async () => {
    const res = await app.request('/api/v1/badges', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('student can also list badges', async () => {
    const res = await app.request('/api/v1/badges', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
  });
});

// ─── GET /api/v1/badges/me ───────────────────────────────────────────────────

describe('GET /api/v1/badges/me', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/badges/me');
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty array initially', async () => {
    const res = await app.request('/api/v1/badges/me', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ─── POST /api/v1/badges ─────────────────────────────────────────────────────

describe('POST /api/v1/badges', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/badges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Auth Badge' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for student trying to create badge', async () => {
    const res = await app.request('/api/v1/badges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Student Badge' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 when name is missing', async () => {
    const res = await app.request('/api/v1/badges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'no name' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { success: boolean; code: string };
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 201 and creates badge (admin token)', async () => {
    const res = await app.request('/api/v1/badges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Badge', description: 'A test badge', criteria: 'books_read_1' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { id: string; name: string; schoolId: string } };
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Test Badge');
    expect(body.data.schoolId).toBe(schoolId);
    createdBadgeIds.push(body.data.id);
  });

  it('returns 201 and creates badge (librarian token)', async () => {
    const res = await app.request('/api/v1/badges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Librarian Badge' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { id: string } };
    expect(body.success).toBe(true);
    createdBadgeIds.push(body.data.id);
  });
});

// ─── DELETE /api/v1/badges/:id ───────────────────────────────────────────────

describe('DELETE /api/v1/badges/:id', () => {
  let badgeToDelete: string;
  let badgeWithAward: string;

  beforeAll(async () => {
    // Create a badge to delete
    const res1 = await app.request('/api/v1/badges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'To Be Deleted' }),
    });
    const b1 = await res1.json() as { data: { id: string } };
    badgeToDelete = b1.data.id;

    // Create a badge that will be awarded to a user
    const res2 = await app.request('/api/v1/badges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Awarded Badge' }),
    });
    const b2 = await res2.json() as { data: { id: string } };
    badgeWithAward = b2.data.id;
    createdBadgeIds.push(badgeWithAward);

    // Manually award badge to student so delete fails
    await db.insert(userBadges).values({ userId: studentId, badgeId: badgeWithAward });
  });

  it('returns 401 without auth token', async () => {
    const res = await app.request(`/api/v1/badges/${badgeToDelete}`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for student trying to delete badge', async () => {
    const res = await app.request(`/api/v1/badges/${badgeToDelete}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns 409 when badge has been awarded', async () => {
    const res = await app.request(`/api/v1/badges/${badgeWithAward}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(409);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('BADGE_IN_USE');
  });

  it('returns 200 and deletes badge (admin token)', async () => {
    const res = await app.request(`/api/v1/badges/${badgeToDelete}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('returns 404 for non-existent badge', async () => {
    const res = await app.request('/api/v1/badges/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('BADGE_NOT_FOUND');
  });
});

// ─── POST /api/v1/badges/seed ────────────────────────────────────────────────

describe('POST /api/v1/badges/seed', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/badges/seed', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for librarian (admin only)', async () => {
    const res = await app.request('/api/v1/badges/seed', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 and seeds default 7 badges (admin token)', async () => {
    // Use a fresh school to avoid conflicts with existing badges
    const [freshSchool] = await db
      .insert(schools)
      .values({ name: `Seed Test School ${Date.now()}` })
      .returning({ id: schools.id });
    const freshSchoolId = freshSchool!.id;

    const [freshAdmin] = await db.insert(users).values({
      email: `seed-admin-${Date.now()}@school.com`,
      passwordHash: 'hash',
      fullName: 'Seed Admin',
      role: 'admin',
      schoolId: freshSchoolId,
      isActive: true,
      emailVerified: true,
      approvalStatus: 'approved',
    }).returning({ id: users.id });
    const freshAdminToken = signAccessToken({ sub: freshAdmin!.id, role: 'admin', schoolId: freshSchoolId });

    const res = await app.request('/api/v1/badges/seed', {
      method: 'POST',
      headers: { Authorization: `Bearer ${freshAdminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(7);

    // Idempotent: second call should return 0 new badges
    const res2 = await app.request('/api/v1/badges/seed', {
      method: 'POST',
      headers: { Authorization: `Bearer ${freshAdminToken}` },
    });
    const body2 = await res2.json() as { success: boolean; data: unknown[] };
    expect(body2.data.length).toBe(0);

    // Cleanup
    const seededBadges = await db.select({ id: badges.id }).from(badges).where(eq(badges.schoolId, freshSchoolId));
    if (seededBadges.length > 0) {
      await db.delete(badges).where(eq(badges.schoolId, freshSchoolId));
    }
    await db.delete(users).where(eq(users.id, freshAdmin!.id));
    await db.delete(schools).where(eq(schools.id, freshSchoolId));
  });
});

// ─── POST /api/v1/badges/check ───────────────────────────────────────────────

describe('POST /api/v1/badges/check', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/badges/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: studentId }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for student role', async () => {
    const res = await app.request('/api/v1/badges/check', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: studentId }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 for missing userId', async () => {
    const res = await app.request('/api/v1/badges/check', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 and runs award check (admin token)', async () => {
    const res = await app.request('/api/v1/badges/check', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: studentId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('returns 200 and runs award check (librarian token)', async () => {
    const res = await app.request('/api/v1/badges/check', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: studentId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
  });
});
