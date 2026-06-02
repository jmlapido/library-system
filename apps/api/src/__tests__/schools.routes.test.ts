import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools } from '../db/schema/index.js';
import { signAccessToken } from '../lib/jwt.js';

let schoolId: string;
let adminToken: string;
let librarianToken: string;
let studentToken: string;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `Settings School ${Date.now()}` })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const mkUser = async (role: 'admin' | 'librarian' | 'student') => {
    const [u] = await db.insert(users).values({
      email: `settings-${role}-${Date.now()}@test.com`,
      passwordHash: 'hash',
      fullName: `Settings ${role}`,
      role,
      schoolId,
      isActive: true,
      emailVerified: true,
      approvalStatus: 'approved',
    }).returning({ id: users.id });
    createdUserIds.push(u!.id);
    return u!.id;
  };

  const [adminId, libId, stuId] = await Promise.all([mkUser('admin'), mkUser('librarian'), mkUser('student')]);
  adminToken = signAccessToken({ sub: adminId, role: 'admin', schoolId });
  librarianToken = signAccessToken({ sub: libId, role: 'librarian', schoolId });
  studentToken = signAccessToken({ sub: stuId, role: 'student', schoolId });
});

afterAll(async () => {
  for (const id of createdUserIds) await db.delete(users).where(eq(users.id, id));
  await db.delete(schools).where(eq(schools.id, schoolId));
});

describe('GET /api/v1/schools/settings', () => {
  it('returns 401 without token', async () => {
    const res = await app.request('/api/v1/schools/settings');
    expect(res.status).toBe(401);
  });

  it('returns 403 for student', async () => {
    const res = await app.request('/api/v1/schools/settings', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns school info and default settings for librarian', async () => {
    const res = await app.request('/api/v1/schools/settings', {
      headers: { Authorization: `Bearer ${librarianToken}` },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { info: { name: string }; settings: { studentCheckoutDays: number } } };
    expect(json.success).toBe(true);
    expect(json.data.info.name).toContain('Settings School');
    expect(json.data.settings.studentCheckoutDays).toBe(14);
    expect(json.data.settings.teacherCheckoutDays).toBe(28);
  });
});

describe('PATCH /api/v1/schools/settings', () => {
  it('returns 403 for librarian (admin only)', async () => {
    const res = await app.request('/api/v1/schools/settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${librarianToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentCheckoutDays: 10 }),
    });
    expect(res.status).toBe(403);
  });

  it('updates checkout days for admin', async () => {
    const res = await app.request('/api/v1/schools/settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentCheckoutDays: 21, teacherCheckoutDays: 42 }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { studentCheckoutDays: number; teacherCheckoutDays: number } };
    expect(json.data.studentCheckoutDays).toBe(21);
    expect(json.data.teacherCheckoutDays).toBe(42);
  });

  it('enables fines when fineEnabled=true', async () => {
    const res = await app.request('/api/v1/schools/settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fineEnabled: true, finePerDay: 5 }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { fineEnabled: boolean; finePerDay: number } };
    expect(json.data.fineEnabled).toBe(true);
    expect(json.data.finePerDay).toBe(5);
  });

  it('persists settings across subsequent GET', async () => {
    await app.request('/api/v1/schools/settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ overdueReminderDays: 3 }),
    });
    const res = await app.request('/api/v1/schools/settings', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const json = (await res.json()) as { data: { settings: { overdueReminderDays: number } } };
    expect(json.data.settings.overdueReminderDays).toBe(3);
  });

  it('returns 422 for out-of-range value', async () => {
    const res = await app.request('/api/v1/schools/settings', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentCheckoutDays: 9999 }),
    });
    expect(res.status).toBe(422);
  });
});
