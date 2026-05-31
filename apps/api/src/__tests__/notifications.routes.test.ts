import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray, eq } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools } from '../db/schema/index.js';
import { notificationLog } from '../db/schema/notificationLog.js';
import { signAccessToken } from '../lib/jwt.js';

let schoolId: string;
let adminId: string;
let librarianId: string;
let studentId: string;
let adminToken: string;
let librarianToken: string;
let studentToken: string;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `Notif Routes School ${Date.now()}` })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const [admin] = await db.insert(users).values({
    email: `notif-admin-${Date.now()}@school.com`,
    passwordHash: 'hash',
    fullName: 'Notif Admin',
    role: 'admin',
    schoolId,
    isActive: true,
    emailVerified: true,
    approvalStatus: 'approved',
  }).returning({ id: users.id });
  adminId = admin!.id;
  createdUserIds.push(adminId);
  adminToken = signAccessToken({ sub: adminId, role: 'admin', schoolId });

  const [librarian] = await db.insert(users).values({
    email: `notif-librarian-${Date.now()}@school.com`,
    passwordHash: 'hash',
    fullName: 'Notif Librarian',
    role: 'librarian',
    schoolId,
    isActive: true,
    emailVerified: true,
    approvalStatus: 'approved',
  }).returning({ id: users.id });
  librarianId = librarian!.id;
  createdUserIds.push(librarianId);
  librarianToken = signAccessToken({ sub: librarianId, role: 'librarian', schoolId });

  const [student] = await db.insert(users).values({
    email: `notif-student-${Date.now()}@school.com`,
    passwordHash: 'hash',
    fullName: 'Notif Student',
    role: 'student',
    schoolId,
    isActive: true,
    emailVerified: true,
    approvalStatus: 'approved',
  }).returning({ id: users.id });
  studentId = student!.id;
  createdUserIds.push(studentId);
  studentToken = signAccessToken({ sub: studentId, role: 'student', schoolId });
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.delete(notificationLog).where(inArray(notificationLog.userId, createdUserIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  await db.delete(schools).where(eq(schools.id, schoolId));
});

describe('GET /api/v1/notifications/me', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/notifications/me');
    expect(res.status).toBe(401);
  });

  it('returns 200 with empty array for user with no logs', async () => {
    const res = await app.request('/api/v1/notifications/me', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('only returns logs for the authenticated user', async () => {
    // Insert a log for admin — student should not see it
    await db.insert(notificationLog).values({
      userId: adminId,
      schoolId,
      notificationType: 'due_reminder',
      channel: 'email',
      status: 'sent',
      messagePreview: 'Admin test log',
    });

    const res = await app.request('/api/v1/notifications/me', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: Array<{ userId: string }> };
    expect(body.data.every((log) => log.userId === studentId)).toBe(true);
  });
});

describe('PATCH /api/v1/users/me/notification-prefs', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/users/me/notification-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'sms' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 and updates channel to sms', async () => {
    const res = await app.request('/api/v1/users/me/notification-prefs', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: 'sms' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);

    const [updated] = await db
      .select({ notificationChannel: users.notificationChannel })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);
    expect(updated!.notificationChannel).toBe('sms');
  });

  it('returns 200 and allows null channel', async () => {
    const res = await app.request('/api/v1/users/me/notification-prefs', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: null }),
    });
    expect(res.status).toBe(200);
  });

  it('returns 422 on invalid channel value', async () => {
    const res = await app.request('/api/v1/users/me/notification-prefs', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${studentToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: 'push' }),
    });
    expect(res.status).toBe(422);
    const body = await res.json() as { success: boolean; code: string };
    expect(body.success).toBe(false);
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/admin/notifications/log', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/admin/notifications/log');
    expect(res.status).toBe(401);
  });

  it('returns 403 for student role', async () => {
    const res = await app.request('/api/v1/admin/notifications/log', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 for librarian role', async () => {
    const res = await app.request('/api/v1/admin/notifications/log', {
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('returns 200 for admin role', async () => {
    const res = await app.request('/api/v1/admin/notifications/log', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/admin/notifications/test', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/admin/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: adminId, type: 'due_reminder' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 for librarian role', async () => {
    const res = await app.request('/api/v1/admin/notifications/test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${librarianToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: adminId, type: 'due_reminder' }),
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent userId', async () => {
    const res = await app.request('/api/v1/admin/notifications/test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: '00000000-0000-0000-0000-000000000000', type: 'due_reminder' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 422 on invalid body', async () => {
    const res = await app.request('/api/v1/admin/notifications/test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: 'not-a-uuid', type: 'due_reminder' }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 200 for valid admin test request', async () => {
    const res = await app.request('/api/v1/admin/notifications/test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: adminId, type: 'due_reminder' }),
    });
    // 200 regardless of whether email actually sends (no sendgrid key in test)
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });
});
