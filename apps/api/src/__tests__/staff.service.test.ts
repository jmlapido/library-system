import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, schools, verificationTokens } from '../db/schema/index.js';
import {
  registerStaff,
  approveStaff,
  rejectStaff,
  createStaffByAdmin,
  verifyEmail,
  setPasswordFromInvite,
  listPendingStaff,
} from '../services/staff.service.js';
import { AppError } from '../services/auth.service.js';

vi.mock('../services/email.service.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendStaffInviteEmail: vi.fn().mockResolvedValue(undefined),
  sendRejectionEmail: vi.fn().mockResolvedValue(undefined),
}));

import * as emailService from '../services/email.service.js';

let schoolId: string;
const createdUserIds: string[] = [];

beforeAll(async () => {
  const [school] = await db.insert(schools).values({
    name: 'Staff Service Test School',
  }).returning({ id: schools.id });
  schoolId = school!.id;
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.delete(verificationTokens).where(inArray(verificationTokens.userId, createdUserIds));
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

describe('registerStaff', () => {
  it('creates a user with pending approval and isActive=false', async () => {
    await registerStaff({
      email: `register-test-${Date.now()}@school.com`,
      password: 'password123',
      fullName: 'Ana Reyes',
      role: 'teacher',
      schoolId,
    });

    const pending = await listPendingStaff(schoolId);
    const found = pending.find((u) => u.fullName === 'Ana Reyes');
    expect(found).toBeDefined();
    if (found) createdUserIds.push(found.id);
  });

  it('throws EMAIL_ALREADY_EXISTS on duplicate email', async () => {
    const email = `dup-${Date.now()}@school.com`;
    await registerStaff({ email, password: 'password123', fullName: 'Dup User', role: 'teacher', schoolId });
    const pending = await listPendingStaff(schoolId);
    const found = pending.find((u) => u.email === email);
    if (found) createdUserIds.push(found.id);

    await expect(
      registerStaff({ email, password: 'password123', fullName: 'Dup User 2', role: 'librarian', schoolId })
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_EXISTS' });
  });
});

describe('approveStaff', () => {
  it('sets approvalStatus=approved, isActive=true, and sends verification email', async () => {
    const email = `approve-test-${Date.now()}@school.com`;
    await registerStaff({ email, password: 'password123', fullName: 'Ben Santos', role: 'librarian', schoolId });
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    createdUserIds.push(user!.id);

    await approveStaff(user!.id);

    const [updated] = await db.select().from(users).where(eq(users.id, user!.id)).limit(1);
    expect(updated!.approvalStatus).toBe('approved');
    expect(updated!.isActive).toBe(true);
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(email, expect.stringContaining('verify-email'));
  });

  it('throws STAFF_NOT_FOUND when user does not exist', async () => {
    await expect(approveStaff('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({
      code: 'STAFF_NOT_FOUND',
    });
  });

  it('throws STAFF_NOT_FOUND when user is already approved', async () => {
    const email = `already-approved-${Date.now()}@school.com`;
    await registerStaff({ email, password: 'password123', fullName: 'Already', role: 'teacher', schoolId });
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    createdUserIds.push(user!.id);
    await approveStaff(user!.id);

    await expect(approveStaff(user!.id)).rejects.toMatchObject({ code: 'STAFF_NOT_FOUND' });
  });
});

describe('rejectStaff', () => {
  it('sets approvalStatus=rejected and sends rejection email', async () => {
    const email = `reject-test-${Date.now()}@school.com`;
    await registerStaff({ email, password: 'password123', fullName: 'Cora Lim', role: 'teacher', schoolId });
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    createdUserIds.push(user!.id);

    await rejectStaff(user!.id);

    const [updated] = await db.select().from(users).where(eq(users.id, user!.id)).limit(1);
    expect(updated!.approvalStatus).toBe('rejected');
    expect(emailService.sendRejectionEmail).toHaveBeenCalledWith(email, 'Cora Lim');
  });
});

describe('createStaffByAdmin', () => {
  it('creates approved+active user and sends invite email', async () => {
    const email = `admin-create-${Date.now()}@school.com`;
    const result = await createStaffByAdmin({ email, fullName: 'Dan Uy', role: 'library_assistant', schoolId });
    createdUserIds.push(result.id);

    const [user] = await db.select().from(users).where(eq(users.id, result.id)).limit(1);
    expect(user!.approvalStatus).toBe('approved');
    expect(user!.isActive).toBe(true);
    expect(user!.emailVerified).toBe(false);
    expect(emailService.sendStaffInviteEmail).toHaveBeenCalledWith(email, expect.stringContaining('set-password'), 'Dan Uy');
  });
});

describe('verifyEmail', () => {
  it('sets emailVerified=true on valid token', async () => {
    const email = `verify-email-${Date.now()}@school.com`;
    await registerStaff({ email, password: 'password123', fullName: 'Eve Go', role: 'teacher', schoolId });
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    createdUserIds.push(user!.id);
    await approveStaff(user!.id);

    // createToken directly to get a known raw token for test
    const { createToken } = await import('../services/token.service.js');
    const raw = await createToken(user!.id, 'email_verify', 24);

    await verifyEmail(raw);

    const [updated] = await db.select().from(users).where(eq(users.id, user!.id)).limit(1);
    expect(updated!.emailVerified).toBe(true);
  });
});

describe('setPasswordFromInvite', () => {
  it('sets passwordHash and emailVerified=true', async () => {
    const email = `set-pwd-${Date.now()}@school.com`;
    const result = await createStaffByAdmin({ email, fullName: 'Frank Lu', role: 'librarian', schoolId });
    createdUserIds.push(result.id);

    const { createToken } = await import('../services/token.service.js');
    const raw = await createToken(result.id, 'staff_invite', 72);

    await setPasswordFromInvite(raw, 'newpassword123');

    const [updated] = await db.select().from(users).where(eq(users.id, result.id)).limit(1);
    expect(updated!.emailVerified).toBe(true);
    expect(updated!.passwordHash).not.toBeNull();
  });
});
