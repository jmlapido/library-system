import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { verificationTokens } from '../db/schema/index.js';
import { AppError } from './auth.service.js';

export type TokenType = 'email_verify' | 'staff_invite' | 'password_reset';

/**
 * Create a one-time verification token and store its SHA-256 hash.
 * @param userId - Owner of this token.
 * @param type - Token purpose (email_verify | staff_invite | password_reset).
 * @param expiresInHours - TTL in hours.
 * @returns Raw 64-char hex token to embed in the link URL.
 */
export async function createToken(
  userId: string,
  type: TokenType,
  expiresInHours: number,
): Promise<string> {
  const raw = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(raw).digest('hex');

  await db.insert(verificationTokens).values({
    userId,
    tokenHash: hash,
    type,
    expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
  });

  return raw;
}

/**
 * Validate and consume a one-time token. Marks it used so it cannot be reused.
 * @param rawToken - The raw hex token from the link URL.
 * @param expectedType - Expected token type; throws if mismatched.
 * @returns The userId the token belongs to.
 * @throws AppError TOKEN_INVALID if expired, used, wrong type, or not found.
 */
export async function consumeToken(
  rawToken: string,
  expectedType: TokenType,
): Promise<{ userId: string }> {
  const hash = createHash('sha256').update(rawToken).digest('hex');

  const [token] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.tokenHash, hash),
        eq(verificationTokens.type, expectedType),
        gt(verificationTokens.expiresAt, new Date()),
        isNull(verificationTokens.usedAt),
      ),
    )
    .limit(1);

  if (!token) throw new AppError('TOKEN_INVALID', 'Token is invalid, expired, or already used');

  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(verificationTokens.id, token.id));

  return { userId: token.userId };
}
