import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import { AppError } from './auth.service.js';
import { createToken, consumeToken } from './token.service.js';
import * as emailService from './email.service.js';
import type { z } from 'zod';
import { RegisterStaffSchema, CreateStaffByAdminSchema } from 'shared';

type RegisterStaffInput = z.infer<typeof RegisterStaffSchema>;
type CreateStaffByAdminInput = z.infer<typeof CreateStaffByAdminSchema>;

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

/**
 * Self-register a staff account. Sets approvalStatus=pending and isActive=false until admin approves.
 * @param input - Registration data (email, password, fullName, role, schoolId).
 * @throws AppError EMAIL_ALREADY_EXISTS if the email is taken.
 */
export async function registerStaff(input: RegisterStaffInput): Promise<void> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError('EMAIL_ALREADY_EXISTS', 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  await db.insert(users).values({
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    role: input.role,
    schoolId: input.schoolId,
    approvalStatus: 'pending',
    isActive: false,
    emailVerified: false,
  });
}

/**
 * Approve a pending staff account and send an email verification link.
 * @param userId - ID of the staff user to approve.
 * @throws AppError STAFF_NOT_FOUND if user not found or not in pending state.
 */
export async function approveStaff(userId: string): Promise<void> {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.approvalStatus, 'pending')))
    .limit(1);

  if (!user) {
    throw new AppError('STAFF_NOT_FOUND', 'Staff member not found or not in pending state');
  }

  await db
    .update(users)
    .set({ approvalStatus: 'approved', isActive: true })
    .where(eq(users.id, userId));

  const raw = await createToken(userId, 'email_verify', 24);
  const verifyUrl = `${APP_URL}/auth/verify-email?token=${raw}`;
  await emailService.sendVerificationEmail(user.email!, verifyUrl);
}

/**
 * Reject a pending staff account and notify the applicant.
 * @param userId - ID of the staff user to reject.
 * @throws AppError STAFF_NOT_FOUND if user not found or not in pending state.
 */
export async function rejectStaff(userId: string): Promise<void> {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), eq(users.approvalStatus, 'pending')))
    .limit(1);

  if (!user) {
    throw new AppError('STAFF_NOT_FOUND', 'Staff member not found or not in pending state');
  }

  await db
    .update(users)
    .set({ approvalStatus: 'rejected' })
    .where(eq(users.id, userId));

  await emailService.sendRejectionEmail(user.email!, user.fullName);
}

/**
 * Admin-creates a staff account and sends an invite email for password setup.
 * @param input - Staff data (email, fullName, role, schoolId). No password — set via invite link.
 * @throws AppError EMAIL_ALREADY_EXISTS if the email is taken.
 */
export async function createStaffByAdmin(
  input: CreateStaffByAdminInput,
): Promise<{ id: string }> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError('EMAIL_ALREADY_EXISTS', 'Email already registered');
  }

  const [newUser] = await db
    .insert(users)
    .values({
      email: input.email,
      fullName: input.fullName,
      role: input.role,
      schoolId: input.schoolId,
      approvalStatus: 'approved',
      isActive: true,
      emailVerified: false,
    })
    .returning({ id: users.id });

  const raw = await createToken(newUser!.id, 'staff_invite', 72);
  const inviteUrl = `${APP_URL}/auth/set-password?token=${raw}`;
  await emailService.sendStaffInviteEmail(input.email, inviteUrl, input.fullName);

  return { id: newUser!.id };
}

/**
 * Consume an email_verify token and mark the user's email as verified.
 * @param rawToken - Raw token from the verification link URL.
 * @throws AppError TOKEN_INVALID if token is bad, expired, or used.
 */
export async function verifyEmail(rawToken: string): Promise<void> {
  const { userId } = await consumeToken(rawToken, 'email_verify');
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
}

/**
 * Consume a staff_invite token, set the user's password, and verify their email.
 * @param rawToken - Raw token from the invite link URL.
 * @param password - Plain-text password to hash and store.
 * @throws AppError TOKEN_INVALID if token is bad, expired, or used.
 */
export async function setPasswordFromInvite(
  rawToken: string,
  password: string,
): Promise<void> {
  const { userId } = await consumeToken(rawToken, 'staff_invite');
  const passwordHash = await bcrypt.hash(password, 12);
  await db
    .update(users)
    .set({ passwordHash, emailVerified: true })
    .where(eq(users.id, userId));
}

/**
 * List all staff accounts in pending approval state for a given school.
 * @param schoolId - Scopes the query to the admin's school.
 */
export async function listPendingStaff(schoolId: string) {
  return db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.approvalStatus, 'pending'), eq(users.schoolId, schoolId)));
}
