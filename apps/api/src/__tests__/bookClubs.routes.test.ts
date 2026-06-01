import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray, and } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools, books } from '../db/schema/index.js';
import { bookClubs, bookClubMembers } from '../db/schema/bookClubs.js';
import { signAccessToken } from '../lib/jwt.js';

let schoolId: string;
let organizerId: string;
let memberId: string;
let outsiderId: string;
let organizerToken: string;
let memberToken: string;
let outsiderToken: string;
let bookId: string;

const createdUserIds: string[] = [];
const createdClubIds: string[] = [];

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `Book Clubs Test School ${Date.now()}` })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const makeUser = async (prefix: string, role: 'student' | 'librarian' = 'student') => {
    const [u] = await db.insert(users).values({
      email: `bc-${prefix}-${Date.now()}@school.com`,
      passwordHash: 'hash',
      fullName: `BC ${prefix}`,
      role,
      schoolId,
      isActive: true,
      emailVerified: true,
      approvalStatus: 'approved',
    }).returning({ id: users.id });
    createdUserIds.push(u!.id);
    return u!.id;
  };

  organizerId = await makeUser('organizer');
  memberId = await makeUser('member');
  outsiderId = await makeUser('outsider');

  organizerToken = signAccessToken({ sub: organizerId, role: 'student', schoolId });
  memberToken = signAccessToken({ sub: memberId, role: 'student', schoolId });
  outsiderToken = signAccessToken({ sub: outsiderId, role: 'student', schoolId });

  const [book] = await db.insert(books).values({
    title: 'Club Book',
    author: 'Author',
    schoolId,
  }).returning({ id: books.id });
  bookId = book!.id;
});

afterAll(async () => {
  if (createdClubIds.length > 0) {
    await db.delete(bookClubMembers).where(inArray(bookClubMembers.clubId, createdClubIds));
    await db.delete(bookClubs).where(inArray(bookClubs.id, createdClubIds));
  }
  // clean up any remaining clubs created by test users
  for (const uid of createdUserIds) {
    const remaining = await db.select({ id: bookClubs.id }).from(bookClubs).where(eq(bookClubs.organizerId, uid));
    if (remaining.length > 0) {
      const ids = remaining.map((r) => r.id);
      await db.delete(bookClubMembers).where(inArray(bookClubMembers.clubId, ids));
      await db.delete(bookClubs).where(inArray(bookClubs.id, ids));
    }
  }
  await db.delete(books).where(eq(books.id, bookId));
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  await db.delete(schools).where(eq(schools.id, schoolId));
});

// ─── POST /api/v1/book-clubs ──────────────────────────────────────────────────

describe('POST /api/v1/book-clubs', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/book-clubs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Unauthorized Club' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 422 when name is missing', async () => {
    const res = await app.request('/api/v1/book-clubs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${organizerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'no name' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { success: boolean; code: string };
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 201 and creates a club, auto-joining organizer', async () => {
    const res = await app.request('/api/v1/book-clubs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${organizerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Book Club', description: 'A test club', maxMembers: 10 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { id: string; name: string; organizerId: string } };
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Test Book Club');
    expect(body.data.organizerId).toBe(organizerId);
    createdClubIds.push(body.data.id);

    // verify organizer was auto-joined
    const members = await db
      .select()
      .from(bookClubMembers)
      .where(and(eq(bookClubMembers.clubId, body.data.id), eq(bookClubMembers.userId, organizerId)));
    expect(members.length).toBe(1);
    expect(members[0]!.role).toBe('organizer');
  });
});

// ─── GET /api/v1/book-clubs ───────────────────────────────────────────────────

describe('GET /api/v1/book-clubs', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/book-clubs');
    expect(res.status).toBe(401);
  });

  it('returns 200 with clubs for school', async () => {
    const res = await app.request('/api/v1/book-clubs', {
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('filters by status query param', async () => {
    const res = await app.request('/api/v1/book-clubs?status=planning', {
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: Array<{ status: string }> };
    expect(body.success).toBe(true);
    for (const club of body.data) {
      expect(club.status).toBe('planning');
    }
  });
});

// ─── GET /api/v1/book-clubs/my ────────────────────────────────────────────────

describe('GET /api/v1/book-clubs/my', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/book-clubs/my');
    expect(res.status).toBe(401);
  });

  it('returns 200 with user\'s clubs', async () => {
    const res = await app.request('/api/v1/book-clubs/my', {
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: Array<{ id: string }> };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    const ids = body.data.map((c) => c.id);
    // At least one of the clubs we created should be in results
    const hasCreated = createdClubIds.some((id) => ids.includes(id));
    expect(hasCreated).toBe(true);
  });

  it('does not return clubs the user has not joined', async () => {
    const res = await app.request('/api/v1/book-clubs/my', {
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: Array<{ id: string }> };
    const ids = body.data.map((c) => c.id);
    const leaked = createdClubIds.some((id) => ids.includes(id));
    expect(leaked).toBe(false);
  });
});

// ─── GET /api/v1/book-clubs/:id ───────────────────────────────────────────────

describe('GET /api/v1/book-clubs/:id', () => {
  let clubId: string;

  beforeAll(async () => {
    const res = await app.request('/api/v1/book-clubs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${organizerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Detail Club', bookId }),
    });
    const body = await res.json() as { data: { id: string } };
    clubId = body.data.id;
    createdClubIds.push(clubId);
  });

  it('returns 401 without auth token', async () => {
    const res = await app.request(`/api/v1/book-clubs/${clubId}`);
    expect(res.status).toBe(401);
  });

  it('returns 200 with club details including book', async () => {
    const res = await app.request(`/api/v1/book-clubs/${clubId}`, {
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { id: string; memberCount: number; book: { id: string } | null } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(clubId);
    expect(typeof body.data.memberCount).toBe('number');
    expect(body.data.book?.id).toBe(bookId);
  });

  it('returns 404 for non-existent club', async () => {
    const res = await app.request('/api/v1/book-clubs/00000000-0000-0000-0000-000000000000', {
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    expect(res.status).toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('CLUB_NOT_FOUND');
  });
});

// ─── POST /:id/join and POST /:id/leave ───────────────────────────────────────

describe('Join and leave club', () => {
  let clubId: string;

  beforeAll(async () => {
    const res = await app.request('/api/v1/book-clubs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${organizerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Join Leave Club', maxMembers: 5 }),
    });
    const body = await res.json() as { data: { id: string } };
    clubId = body.data.id;
    createdClubIds.push(clubId);
  });

  it('POST /:id/join returns 401 without token', async () => {
    const res = await app.request(`/api/v1/book-clubs/${clubId}/join`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('POST /:id/join returns 200 and joins club', async () => {
    const res = await app.request(`/api/v1/book-clubs/${clubId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { role: string } };
    expect(body.success).toBe(true);
    expect(body.data.role).toBe('member');
  });

  it('POST /:id/join returns 409 if already a member', async () => {
    const res = await app.request(`/api/v1/book-clubs/${clubId}/join`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(res.status).toBe(409);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('ALREADY_A_MEMBER');
  });

  it('POST /:id/leave returns 401 without token', async () => {
    const res = await app.request(`/api/v1/book-clubs/${clubId}/leave`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('POST /:id/leave returns 403 if organizer tries to leave', async () => {
    const res = await app.request(`/api/v1/book-clubs/${clubId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('ORGANIZER_CANNOT_LEAVE');
  });

  it('POST /:id/leave returns 200 and leaves club', async () => {
    const res = await app.request(`/api/v1/book-clubs/${clubId}/leave`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });
});

// ─── GET /:id/members ─────────────────────────────────────────────────────────

describe('GET /api/v1/book-clubs/:id/members', () => {
  let clubId: string;

  beforeAll(async () => {
    const res = await app.request('/api/v1/book-clubs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${organizerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Members List Club' }),
    });
    const body = await res.json() as { data: { id: string } };
    clubId = body.data.id;
    createdClubIds.push(clubId);
  });

  it('returns 401 without auth token', async () => {
    const res = await app.request(`/api/v1/book-clubs/${clubId}/members`);
    expect(res.status).toBe(401);
  });

  it('returns 200 with member list including user info', async () => {
    const res = await app.request(`/api/v1/book-clubs/${clubId}/members`, {
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: Array<{ userId: string; role: string; fullName: string }> };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    // Organizer should be in the member list
    const org = body.data.find((m) => m.userId === organizerId);
    expect(org).toBeDefined();
    expect(org?.role).toBe('organizer');
  });
});

// ─── PATCH /api/v1/book-clubs/:id ────────────────────────────────────────────

describe('PATCH /api/v1/book-clubs/:id', () => {
  let clubId: string;

  beforeAll(async () => {
    const res = await app.request('/api/v1/book-clubs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${organizerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Patch Test Club' }),
    });
    const body = await res.json() as { data: { id: string } };
    clubId = body.data.id;
    createdClubIds.push(clubId);
  });

  it('returns 401 without auth token', async () => {
    const res = await app.request(`/api/v1/book-clubs/${clubId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-organizer', async () => {
    const res = await app.request(`/api/v1/book-clubs/${clubId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${memberToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hijacked Name' }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('CLUB_ACCESS_DENIED');
  });

  it('returns 200 and updates club', async () => {
    const res = await app.request(`/api/v1/book-clubs/${clubId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${organizerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Club Name', status: 'active' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { name: string; status: string } };
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Updated Club Name');
    expect(body.data.status).toBe('active');
  });
});

// ─── DELETE /api/v1/book-clubs/:id ───────────────────────────────────────────

describe('DELETE /api/v1/book-clubs/:id', () => {
  let planningClubId: string;
  let activeClubId: string;

  beforeAll(async () => {
    const res1 = await app.request('/api/v1/book-clubs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${organizerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Planning Club To Delete' }),
    });
    const b1 = await res1.json() as { data: { id: string } };
    planningClubId = b1.data.id;
    // Don't push to createdClubIds — will be deleted in test

    const res2 = await app.request('/api/v1/book-clubs', {
      method: 'POST',
      headers: { Authorization: `Bearer ${organizerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Active Club Cannot Delete' }),
    });
    const b2 = await res2.json() as { data: { id: string } };
    activeClubId = b2.data.id;
    createdClubIds.push(activeClubId);

    // Set active club to 'active' status
    await db.update(bookClubs).set({ status: 'active' }).where(eq(bookClubs.id, activeClubId));
  });

  it('returns 401 without auth token', async () => {
    const res = await app.request(`/api/v1/book-clubs/${planningClubId}`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when trying to delete active club', async () => {
    const res = await app.request(`/api/v1/book-clubs/${activeClubId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('CANNOT_DELETE_ACTIVE_CLUB');
  });

  it('returns 200 and deletes planning club', async () => {
    const res = await app.request(`/api/v1/book-clubs/${planningClubId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('returns 404 after club is deleted', async () => {
    const res = await app.request(`/api/v1/book-clubs/${planningClubId}`, {
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    expect(res.status).toBe(404);
  });
});
