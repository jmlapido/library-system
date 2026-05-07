import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools, verificationTokens } from '../db/schema/index.js';
import { signAccessToken } from '../lib/jwt.js';

vi.mock('../services/email.service.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendStaffInviteEmail: vi.fn().mockResolvedValue(undefined),
  sendRejectionEmail: vi.fn().mockResolvedValue(undefined),
}));

let schoolId: string;
let adminToken: string;
let adminId: string;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const [school] = await db.insert(schools).values({
    name: 'Routes Test School',
    address: '3 Routes Ave',
  }).returning({ id: schools.id });
  schoolId = school.id;

  const [admin] = await db.insert(users).values({
    email: `admin-routes-${Date.now()}@school.com`,
    passwordHash: 'hash',
    fullName: 'Admin User',
    role: 'admin',
    schoolId,
    isActive: true,
    emailVerified: true,
    approvalStatus: 'approved',
  }).returning({ id: users.id });

  adminId = admin.id;
  createdUserIds.push(adminId);
  adminToken = signAccessToken({ sub: adminId, role: 'admin', schoolId });
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.delete(verificationTokens).where(inArray(verificationTokens.userId, createdUserIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe('POST /api/v1/auth/register', () => {
  it('returns 201 on valid self-registration', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `self-register-${Date.now()}@school.com`,
        password: 'password123',
        fullName: 'Self Register',
        role: 'teacher',
        schoolId,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.fullName, 'Self Register')).limit(1);
    if (u) createdUserIds.push(u.id);
  });

  it('returns 409 on duplicate email', async () => {
    const email = `dup-routes-${Date.now()}@school.com`;
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', fullName: 'First', role: 'teacher', schoolId }),
    });
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (u) createdUserIds.push(u.id);

    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', fullName: 'Second', role: 'librarian', schoolId }),
    });
    expect(res.status).toBe(409);
  });

  it('returns 422 when role is student', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `student-role-${Date.now()}@school.com`,
        password: 'password123',
        fullName: 'Student Attempt',
        role: 'student',
        schoolId,
      }),
    });
    expect(res.status).toBe(422);
  });

  it('returns 422 on missing required fields', async () => {
    const res = await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'missing@school.com' }),
    });
    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/admin/staff/pending', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/admin/staff/pending');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin role', async () => {
    const [teacher] = await db.insert(users).values({
      email: `teacher-noauth-${Date.now()}@school.com`,
      passwordHash: 'hash',
      fullName: 'Teacher NoAuth',
      role: 'teacher',
      schoolId,
      isActive: true,
      emailVerified: true,
      approvalStatus: 'approved',
    }).returning({ id: users.id });
    createdUserIds.push(teacher.id);

    const teacherToken = signAccessToken({ sub: teacher.id, role: 'teacher', schoolId });
    const res = await app.request('/api/v1/admin/staff/pending', {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 with pending list for admin', async () => {
    const res = await app.request('/api/v1/admin/staff/pending', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});

describe('POST /api/v1/admin/staff/:id/approve', () => {
  it('returns 200 and approves pending staff', async () => {
    const email = `to-approve-${Date.now()}@school.com`;
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', fullName: 'To Approve', role: 'teacher', schoolId }),
    });
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    createdUserIds.push(user.id);

    const res = await app.request(`/api/v1/admin/staff/${user.id}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const [updated] = await db.select({ approvalStatus: users.approvalStatus }).from(users).where(eq(users.id, user.id)).limit(1);
    expect(updated.approvalStatus).toBe('approved');
  });
});

describe('POST /api/v1/admin/staff/:id/reject', () => {
  it('returns 200 and rejects pending staff', async () => {
    const email = `to-reject-${Date.now()}@school.com`;
    await app.request('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', fullName: 'To Reject', role: 'teacher', schoolId }),
    });
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    createdUserIds.push(user.id);

    const res = await app.request(`/api/v1/admin/staff/${user.id}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const [updated] = await db.select({ approvalStatus: users.approvalStatus }).from(users).where(eq(users.id, user.id)).limit(1);
    expect(updated.approvalStatus).toBe('rejected');
  });
});

describe('POST /api/v1/admin/staff', () => {
  it('returns 201 when admin creates staff', async () => {
    const email = `admin-created-${Date.now()}@school.com`;
    const res = await app.request('/api/v1/admin/staff', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, fullName: 'Admin Created', role: 'librarian', schoolId }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBeDefined();
    createdUserIds.push(body.data.id);
  });
});

describe('POST /api/v1/auth/verify-email', () => {
  it('returns 400 on invalid token', async () => {
    const res = await app.request('/api/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'a'.repeat(64) }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/set-password', () => {
  it('returns 400 on invalid token', async () => {
    const res = await app.request('/api/v1/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'b'.repeat(64), password: 'newpassword123' }),
    });
    expect(res.status).toBe(400);
  });
});
