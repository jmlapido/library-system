import bcrypt from 'bcryptjs';
import { eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, refreshTokens } from '../db/schema/index.js';
import { signAccessToken, signRefreshToken } from '../lib/jwt.js';
import type { LoginInput } from 'shared';

/** Structured error with a machine-readable code for HTTP mapping. */
export class AppError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Authenticate a user via auto-detected credential type.
 * Email identifiers use password; all others use student ID + PIN.
 * @param input - Validated login payload (identifier + credential).
 * @returns Access token, raw refresh token, and public user fields.
 * @throws AppError with code INVALID_CREDENTIALS, ACCOUNT_INACTIVE (covers isActive=false and
 *   approvalStatus='rejected'), APPROVAL_PENDING, or EMAIL_NOT_VERIFIED.
 */
export async function login(input: LoginInput) {
  const isEmail = input.identifier.includes('@');

  const [user] = await db
    .select()
    .from(users)
    .where(isEmail ? eq(users.email, input.identifier) : eq(users.studentId, input.identifier))
    .limit(1);

  if (!user) throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials');
  if (user.approvalStatus === 'pending') throw new AppError('APPROVAL_PENDING', 'Account awaiting admin approval');
  if (user.approvalStatus === 'rejected') throw new AppError('ACCOUNT_INACTIVE', 'Account has been rejected');
  if (!user.isActive) throw new AppError('ACCOUNT_INACTIVE', 'Account is inactive');

  const hashToCheck = isEmail ? user.passwordHash : user.pinHash;
  if (!hashToCheck) throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials');

  const valid = await bcrypt.compare(input.credential, hashToCheck);
  if (!valid) throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials');

  if (isEmail && !user.emailVerified) throw new AppError('EMAIL_NOT_VERIFIED', 'Please verify your email address before logging in');

  const accessToken = signAccessToken({ sub: user.id, role: user.role, schoolId: user.schoolId });
  const rawRefreshToken = signRefreshToken();
  const tokenHash = await bcrypt.hash(rawRefreshToken, 10);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: { id: user.id, fullName: user.fullName, role: user.role, schoolId: user.schoolId },
  };
}

/**
 * Rotate a refresh token — revoke the old token and issue a new token pair.
 * @param rawToken - The raw opaque refresh token from the client.
 * @returns New access token and new raw refresh token.
 * @throws AppError with code INVALID_TOKEN or ACCOUNT_INACTIVE.
 */
export async function refreshSession(rawToken: string) {
  const active = await db
    .select()
    .from(refreshTokens)
    .where(isNull(refreshTokens.revokedAt));

  let matched = null;
  for (const stored of active) {
    if (stored.expiresAt < new Date()) continue;
    if (await bcrypt.compare(rawToken, stored.tokenHash)) {
      matched = stored;
      break;
    }
  }

  if (!matched) throw new AppError('INVALID_TOKEN', 'Refresh token is invalid or expired');

  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, matched.id));

  const [user] = await db.select().from(users).where(eq(users.id, matched.userId)).limit(1);
  if (!user || !user.isActive) throw new AppError('ACCOUNT_INACTIVE', 'Account is inactive');

  const newAccessToken = signAccessToken({ sub: user.id, role: user.role, schoolId: user.schoolId });
  const newRawToken = signRefreshToken();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: await bcrypt.hash(newRawToken, 10),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return { accessToken: newAccessToken, refreshToken: newRawToken };
}

/**
 * Revoke a refresh token on logout.
 * No-op if the token is not found or already revoked.
 * @param rawToken - The raw opaque refresh token from the client.
 */
export async function logout(rawToken: string): Promise<void> {
  const all = await db.select().from(refreshTokens);
  for (const stored of all) {
    if (await bcrypt.compare(rawToken, stored.tokenHash)) {
      await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, stored.id));
      return;
    }
  }
}
