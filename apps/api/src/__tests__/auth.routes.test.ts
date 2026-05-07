import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { schools, users } from '../db/schema/index.js';

let schoolId: string;

beforeAll(async () => {
  const [school] = await db.insert(schools).values({ name: 'Route Test School' }).returning();
  schoolId = school!.id;
  await db.insert(users).values({
    fullName: 'Route Test Staff',
    email: 'staff@route.test',
    passwordHash: await bcrypt.hash('pass1234', 12),
    role: 'librarian',
    schoolId,
    emailVerified: true,
    isActive: true,
  });
});

afterAll(async () => {
  await db.delete(users).where(eq(users.schoolId, schoolId));
  await db.delete(schools).where(eq(schools.id, schoolId));
});

describe('POST /api/v1/auth/login', () => {
  it('returns 200 with tokens on valid credentials', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'staff@route.test', credential: 'pass1234' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { accessToken: string } };
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeTruthy();
  });

  it('returns 401 on wrong password', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'staff@route.test', credential: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 422 on missing body fields', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'staff@route.test' }),
    });
    expect(res.status).toBe(422);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns 401 with no token', async () => {
    const res = await app.request('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});
