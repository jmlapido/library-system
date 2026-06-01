import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, inArray, and } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools } from '../db/schema/index.js';
import { pushSubscriptions } from '../db/schema/pushSubscriptions.js';
import { signAccessToken } from '../lib/jwt.js';

let schoolId: string;
let studentId: string;
let otherStudentId: string;
let studentToken: string;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `Push Routes School ${Date.now()}` })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const [student] = await db.insert(users).values({
    email: `push-student-${Date.now()}@school.com`,
    passwordHash: 'hash',
    fullName: 'Push Student',
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
    email: `push-other-${Date.now()}@school.com`,
    passwordHash: 'hash',
    fullName: 'Push Other',
    role: 'student',
    schoolId,
    isActive: true,
    emailVerified: true,
    approvalStatus: 'approved',
  }).returning({ id: users.id });
  otherStudentId = other!.id;
  createdUserIds.push(otherStudentId);
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.userId, createdUserIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  await db.delete(schools).where(eq(schools.id, schoolId));
});

describe('POST /api/v1/push/subscribe', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fcmToken: 'test-token-123' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 422 when fcmToken is missing', async () => {
    const res = await app.request('/api/v1/push/subscribe', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { success: boolean; code: string };
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when fcmToken is empty string', async () => {
    const res = await app.request('/api/v1/push/subscribe', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fcmToken: '' }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 201 with a valid FCM token', async () => {
    const token = `fcm-token-${Date.now()}`;
    const res = await app.request('/api/v1/push/subscribe', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fcmToken: token, deviceName: 'Chrome on Android' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);

    const [row] = await db
      .select()
      .from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, studentId),
        eq(pushSubscriptions.fcmToken, token)
      ));
    expect(row).toBeDefined();
    expect(row!.deviceName).toBe('Chrome on Android');
  });

  it('returns 201 on duplicate token (upsert — no error)', async () => {
    const token = `fcm-upsert-${Date.now()}`;
    // First insert
    await app.request('/api/v1/push/subscribe', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fcmToken: token }),
    });
    // Second insert (same token, same user)
    const res = await app.request('/api/v1/push/subscribe', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fcmToken: token }),
    });
    expect(res.status).toBe(201);
  });
});

describe('DELETE /api/v1/push/subscribe', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fcmToken: 'any-token' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 and removes a registered token', async () => {
    const token = `fcm-del-${Date.now()}`;
    // Register first
    await app.request('/api/v1/push/subscribe', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fcmToken: token }),
    });

    const res = await app.request('/api/v1/push/subscribe', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fcmToken: token }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);

    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(and(
        eq(pushSubscriptions.userId, studentId),
        eq(pushSubscriptions.fcmToken, token)
      ));
    expect(rows).toHaveLength(0);
  });

  it('returns 200 even when token does not exist (idempotent)', async () => {
    const res = await app.request('/api/v1/push/subscribe', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fcmToken: 'non-existent-token' }),
    });
    expect(res.status).toBe(200);
  });

  it('returns 422 when fcmToken is missing', async () => {
    const res = await app.request('/api/v1/push/subscribe', {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { success: boolean; code: string };
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});
