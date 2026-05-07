import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import type { UserRole } from 'shared';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  schoolId: string;
}

const ACCESS_SECRET: string = (() => {
  const s = process.env.ACCESS_TOKEN_SECRET;
  if (!s) throw new Error('ACCESS_TOKEN_SECRET is not set');
  return s;
})();

/**
 * Sign a short-lived access token (8h).
 * @param payload - The token payload containing sub, role, and schoolId.
 */
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: '8h' });
}

/**
 * Verify and decode an access token. Throws on invalid/expired.
 * @param token - The JWT string to verify.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, ACCESS_SECRET);
  if (typeof decoded === 'string') throw new Error('Invalid token payload');
  return decoded as unknown as AccessTokenPayload;
}

/**
 * Generate a cryptographically random opaque refresh token (128 hex chars).
 */
export function signRefreshToken(): string {
  return randomBytes(64).toString('hex');
}
