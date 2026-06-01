import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray, and } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools } from '../db/schema/index.js';
import { challenges, challengeProgress } from '../db/schema/engagement.js';
import { signAccessToken } from '../lib/jwt.js';

let schoolId: string;
let adminId: string;
let studentId: string;
let adminToken: string;
let studentToken: string;

const createdUserIds: string[] = [];
const createdChallengeIds: string[] = [];

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `Challenges Test School ${Date.now()}` })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const makeUser = async (prefix: string, role: 'student' | 'admin') => {
    const [u] = await db.insert(users).values({
      email: `ch-${prefix}-${Date.now()}@school.com`,
      passwordHash: 'hash',
      fullName: `Ch ${prefix}`,
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
  studentId = await makeUser('student', 'student');

  adminToken = signAccessToken({ sub: adminId, role: 'admin', schoolId });
  studentToken = signAccessToken({ sub: studentId, role: 'student', schoolId });
});

afterAll(async () => {
  if (createdChallengeIds.length > 0) {
    await db.delete(challengeProgress).where(inArray(challengeProgress.challengeId, createdChallengeIds));
    await db.delete(challenges).where(inArray(challenges.id, createdChallengeIds));
  }
  // Clean up any remaining challenges for the test school
  const remaining = await db.select({ id: challenges.id }).from(challenges).where(eq(challenges.schoolId, schoolId));
  if (remaining.length > 0) {
    const ids = remaining.map((r) => r.id);
    await db.delete(challengeProgress).where(inArray(challengeProgress.challengeId, ids));
    await db.delete(challenges).where(inArray(challenges.id, ids));
  }
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  await db.delete(schools).where(eq(schools.id, schoolId));
});

// ─── GET /api/v1/challenges ──────────────────────────────────────────────────

describe('GET /api/v1/challenges', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/challenges');
    expect(res.status).toBe(401);
  });

  it('returns 200 with challenge list', async () => {
    const res = await app.request('/api/v1/challenges', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ─── POST /api/v1/challenges ─────────────────────────────────────────────────

describe('POST /api/v1/challenges', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'No Auth' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for student role', async () => {
    const res = await app.request('/api/v1/challenges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hack', goal: 5, goalType: 'books', startDate: '2026-06-01', endDate: '2026-06-30' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 when title is missing', async () => {
    const res = await app.request('/api/v1/challenges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: 5, goalType: 'books', startDate: '2026-06-01', endDate: '2026-06-30' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 201 and auto-sets status for upcoming challenge', async () => {
    const res = await app.request('/api/v1/challenges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Summer Reading 2027',
        description: 'Read 10 books',
        goal: 10,
        goalType: 'books',
        startDate: '2027-07-01',
        endDate: '2027-08-31',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { id: string; status: string; schoolId: string } };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('upcoming');
    expect(body.data.schoolId).toBe(schoolId);
    createdChallengeIds.push(body.data.id);
  });

  it('returns 201 and auto-sets status to active for current date range', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const res = await app.request('/api/v1/challenges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Active Challenge ${today}`,
        goal: 5,
        goalType: 'books',
        startDate: yesterday,
        endDate: tomorrow,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { id: string; status: string } };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('active');
    createdChallengeIds.push(body.data.id);
  });
});

// ─── GET /api/v1/challenges/:id ──────────────────────────────────────────────

describe('GET /api/v1/challenges/:id', () => {
  let challengeId: string;

  beforeAll(async () => {
    const res = await app.request('/api/v1/challenges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Detail Challenge', goal: 3, goalType: 'books', startDate: '2027-01-01', endDate: '2027-12-31' }),
    });
    const body = await res.json() as { data: { id: string } };
    challengeId = body.data.id;
    createdChallengeIds.push(challengeId);
  });

  it('returns 401 without auth token', async () => {
    const res = await app.request(`/api/v1/challenges/${challengeId}`);
    expect(res.status).toBe(401);
  });

  it('returns 200 with challenge details', async () => {
    const res = await app.request(`/api/v1/challenges/${challengeId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { id: string; enrolledCount: number } };
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(challengeId);
    expect(typeof body.data.enrolledCount).toBe('number');
  });

  it('returns 404 for non-existent challenge', async () => {
    const res = await app.request('/api/v1/challenges/00000000-0000-0000-0000-000000000000', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('CHALLENGE_NOT_FOUND');
  });
});

// ─── GET /api/v1/challenges/me ───────────────────────────────────────────────

describe('GET /api/v1/challenges/me', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/challenges/me');
    expect(res.status).toBe(401);
  });

  it('returns 200 with enrollments array', async () => {
    const res = await app.request('/api/v1/challenges/me', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

// ─── POST /api/v1/challenges/:id/enroll ──────────────────────────────────────

describe('POST /api/v1/challenges/:id/enroll', () => {
  let upcomingChallengeId: string;
  let completedChallengeId: string;

  beforeAll(async () => {
    // Create an upcoming challenge for enrollment tests
    const res1 = await app.request('/api/v1/challenges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Enroll Test Challenge', goal: 5, goalType: 'books', startDate: '2027-06-01', endDate: '2027-06-30' }),
    });
    const b1 = await res1.json() as { data: { id: string } };
    upcomingChallengeId = b1.data.id;
    createdChallengeIds.push(upcomingChallengeId);

    // Create and mark a challenge as completed
    const [comp] = await db.insert(challenges).values({
      schoolId,
      title: 'Completed Challenge',
      goal: 5,
      goalType: 'books',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      status: 'completed',
    }).returning({ id: challenges.id });
    completedChallengeId = comp!.id;
    createdChallengeIds.push(completedChallengeId);
  });

  it('returns 401 without auth token', async () => {
    const res = await app.request(`/api/v1/challenges/${upcomingChallengeId}/enroll`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('returns 200 and enrolls user in upcoming challenge', async () => {
    const res = await app.request(`/api/v1/challenges/${upcomingChallengeId}/enroll`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { challengeId: string; userId: string } };
    expect(body.success).toBe(true);
    expect(body.data.challengeId).toBe(upcomingChallengeId);
    expect(body.data.userId).toBe(studentId);
  });

  it('returns 409 when already enrolled', async () => {
    const res = await app.request(`/api/v1/challenges/${upcomingChallengeId}/enroll`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(409);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('ALREADY_ENROLLED');
  });

  it('returns 400 when challenge is completed', async () => {
    const res = await app.request(`/api/v1/challenges/${completedChallengeId}/enroll`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('CHALLENGE_NOT_OPEN');
  });
});

// ─── GET /api/v1/challenges/:id/leaderboard ───────────────────────────────────

describe('GET /api/v1/challenges/:id/leaderboard', () => {
  let challengeId: string;

  beforeAll(async () => {
    const res = await app.request('/api/v1/challenges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Leaderboard Challenge', goal: 10, goalType: 'books', startDate: '2027-01-01', endDate: '2027-12-31' }),
    });
    const body = await res.json() as { data: { id: string } };
    challengeId = body.data.id;
    createdChallengeIds.push(challengeId);
  });

  it('returns 401 without auth token', async () => {
    const res = await app.request(`/api/v1/challenges/${challengeId}/leaderboard`);
    expect(res.status).toBe(401);
  });

  it('returns 200 with leaderboard array', async () => {
    const res = await app.request(`/api/v1/challenges/${challengeId}/leaderboard`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('leaderboard entries contain fullName and progress only', async () => {
    // Enroll student first so there is at least one entry
    await app.request(`/api/v1/challenges/${challengeId}/enroll`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const res = await app.request(`/api/v1/challenges/${challengeId}/leaderboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await res.json() as { data: Array<{ fullName: string; progress: number; email?: string }> };
    expect(body.data.length).toBeGreaterThan(0);
    const entry = body.data[0]!;
    expect(typeof entry.fullName).toBe('string');
    expect(typeof entry.progress).toBe('number');
    expect(entry.email).toBeUndefined();
  });
});

// ─── PATCH /api/v1/challenges/:id/status ─────────────────────────────────────

describe('PATCH /api/v1/challenges/:id/status', () => {
  let challengeId: string;

  beforeAll(async () => {
    const res = await app.request('/api/v1/challenges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Status Patch Challenge', goal: 5, goalType: 'books', startDate: '2027-03-01', endDate: '2027-03-31' }),
    });
    const body = await res.json() as { data: { id: string } };
    challengeId = body.data.id;
    createdChallengeIds.push(challengeId);
  });

  it('returns 401 without auth token', async () => {
    const res = await app.request(`/api/v1/challenges/${challengeId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for student role', async () => {
    const res = await app.request(`/api/v1/challenges/${challengeId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${studentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 and updates status (admin)', async () => {
    const res = await app.request(`/api/v1/challenges/${challengeId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { status: string } };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('active');
  });
});

// ─── DELETE /api/v1/challenges/:id ───────────────────────────────────────────

describe('DELETE /api/v1/challenges/:id', () => {
  let upcomingId: string;
  let activeId: string;

  beforeAll(async () => {
    const res1 = await app.request('/api/v1/challenges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'To Delete Upcoming', goal: 5, goalType: 'books', startDate: '2027-05-01', endDate: '2027-05-31' }),
    });
    const b1 = await res1.json() as { data: { id: string } };
    upcomingId = b1.data.id;
    // Don't push — will be deleted in test

    // Active challenge (cannot delete)
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const nextMonth = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const res2 = await app.request('/api/v1/challenges', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Active Cannot Delete', goal: 5, goalType: 'books', startDate: yesterday, endDate: nextMonth }),
    });
    const b2 = await res2.json() as { data: { id: string } };
    activeId = b2.data.id;
    createdChallengeIds.push(activeId);
  });

  it('returns 401 without auth token', async () => {
    const res = await app.request(`/api/v1/challenges/${upcomingId}`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for student role', async () => {
    const res = await app.request(`/api/v1/challenges/${upcomingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns 400 when deleting active challenge', async () => {
    const res = await app.request(`/api/v1/challenges/${activeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('CHALLENGE_NOT_OPEN');
  });

  it('returns 200 and deletes upcoming challenge (admin)', async () => {
    const res = await app.request(`/api/v1/challenges/${upcomingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('returns 404 after deletion', async () => {
    const res = await app.request(`/api/v1/challenges/${upcomingId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(404);
  });
});
