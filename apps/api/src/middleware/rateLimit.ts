import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/**
 * In-memory rate limiter for auth endpoints.
 * Replace with Redis-backed implementation for multi-replica production deployments.
 * @param maxAttempts - Maximum requests allowed per window (default: 5).
 * @param windowMs - Time window in milliseconds (default: 15 minutes).
 */
export function rateLimitAuth(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  return createMiddleware(async (c, next) => {
    if (process.env.NODE_ENV === 'development') {
      await next();
      return;
    }

    const ip =
      c.req.header('x-forwarded-for') ??
      c.req.header('x-real-ip') ??
      'unknown';
    const now = Date.now();
    const key = `auth:${ip}`;

    const entry = store.get(key);
    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      entry.count += 1;
      if (entry.count > maxAttempts) {
        throw new HTTPException(429, {
          message: `Too many attempts. Try again in ${Math.ceil((entry.resetAt - now) / 1000)}s`,
        });
      }
    }

    await next();
  });
}
