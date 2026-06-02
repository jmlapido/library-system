import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { verifyAccessToken, type AccessTokenPayload } from '../lib/jwt.js';
import type { UserRole } from 'shared';

type Variables = { user: AccessTokenPayload };

/**
 * Middleware that enforces a valid Bearer JWT on the request.
 * Attaches the decoded payload to `c.get('user')` on success.
 * Throws HTTP 401 if the header is missing, malformed, or token is invalid/expired.
 */
export const requireAuth = createMiddleware<{ Variables: Variables }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    c.set('user', payload);
    await next();
  } catch {
    throw new HTTPException(401, { message: 'Invalid or expired token' });
  }
});

/**
 * Middleware factory that enforces one or more allowed roles.
 * Must be used after `requireAuth` (depends on `c.get('user')`).
 * Throws HTTP 403 if the authenticated user's role is not in the allowed list.
 * @param roles - One or more UserRole values that are permitted.
 */
export function requireRole(...roles: UserRole[]) {
  return createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Unauthorized' });
    if (!roles.includes(user.role)) {
      throw new HTTPException(403, { message: 'Insufficient permissions' });
    }
    await next();
  });
}

/** Shorthand middleware that restricts access to super_admin role only. */
export const requireSuperAdmin = requireRole('super_admin');
