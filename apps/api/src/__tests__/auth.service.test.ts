import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { schools, users } from '../db/schema/index.js';
import { login } from '../services/auth.service.js';

let schoolId: string;
let studentUserId: string;

beforeAll(async () => {
  const [school] = await db.insert(schools).values({ name: 'Auth Service Test School' }).returning();
  schoolId = school!.id;

  const [student] = await db.insert(users).values({
    fullName: 'Test Student',
    studentId: 'STU_SVC_001',
    pinHash: await bcrypt.hash('1234', 12),
    role: 'student',
    schoolId,
  }).returning();
  studentUserId = student!.id;

  await db.insert(users).values({
    fullName: 'Test Librarian',
    email: 'lib@svc.test',
    passwordHash: await bcrypt.hash('password123', 12),
    role: 'librarian',
    schoolId,
    emailVerified: true,
  });
});

afterAll(async () => {
  await db.delete(users).where(eq(users.schoolId, schoolId));
  await db.delete(schools).where(eq(schools.id, schoolId));
});

describe('login()', () => {
  it('logs in student with studentId + PIN', async () => {
    const result = await login({ identifier: 'STU_SVC_001', credential: '1234' });
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.id).toBe(studentUserId);
  });

  it('logs in staff with email + password', async () => {
    const result = await login({ identifier: 'lib@svc.test', credential: 'password123' });
    expect(result.user.role).toBe('librarian');
  });

  it('throws INVALID_CREDENTIALS on wrong PIN', async () => {
    await expect(login({ identifier: 'STU_SVC_001', credential: '9999' }))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('throws INVALID_CREDENTIALS on unknown identifier', async () => {
    await expect(login({ identifier: 'nobody@svc.test', credential: 'anything' }))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('throws ACCOUNT_INACTIVE for inactive user', async () => {
    await db.update(users).set({ isActive: false }).where(eq(users.id, studentUserId));
    await expect(login({ identifier: 'STU_SVC_001', credential: '1234' }))
      .rejects.toMatchObject({ code: 'ACCOUNT_INACTIVE' });
    await db.update(users).set({ isActive: true }).where(eq(users.id, studentUserId));
  });
});
