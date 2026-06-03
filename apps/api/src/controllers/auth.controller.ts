import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { LoginSchema } from 'shared';
import { AppError, login, refreshSession, logout, getMe, saveInterests } from '../services/auth.service.js';

const InterestsSchema = z.object({
  interests: z.array(z.string().max(100)).max(20),
});

/** POST /api/v1/auth/login */
export async function loginController(c: Context) {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON' });
  });

  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' },
      422
    );
  }

  try {
    const result = await login(parsed.data);
    return c.json({ success: true, data: result, message: 'Login successful' });
  } catch (err) {
    if (err instanceof AppError) {
      const STATUS_BY_CODE: Record<string, 401 | 403 | 503> = {
        INVALID_CREDENTIALS: 401,
        LDAP_AUTH_FAILED: 401,
        ACCOUNT_INACTIVE: 403,
        APPROVAL_PENDING: 403,
        EMAIL_NOT_VERIFIED: 403,
        FORBIDDEN: 403,
        LDAP_UNAVAILABLE: 503,
      };
      const status = STATUS_BY_CODE[err.code] ?? 500;
      const SAFE_MESSAGES: Record<string, string> = {
        INVALID_CREDENTIALS: 'Invalid email or password',
        LDAP_AUTH_FAILED: 'Invalid credentials',
        ACCOUNT_INACTIVE: 'Account is inactive',
        APPROVAL_PENDING: 'Account is pending approval',
        EMAIL_NOT_VERIFIED: 'Email address not verified',
        LDAP_UNAVAILABLE: 'Authentication service temporarily unavailable',
      };
      return c.json(
        { success: false, error: SAFE_MESSAGES[err.code] ?? 'Authentication failed', code: err.code },
        status as 401 | 403 | 500 | 503
      );
    }
    throw err;
  }
}

/** POST /api/v1/auth/refresh */
export async function refreshController(c: Context) {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON' });
  });

  const { refreshToken } = body as { refreshToken?: string };
  if (!refreshToken) {
    return c.json({ success: false, error: 'refreshToken required', code: 'MISSING_TOKEN' }, 400);
  }

  try {
    const result = await refreshSession(refreshToken);
    return c.json({ success: true, data: result, message: 'Token refreshed' });
  } catch {
    return c.json({ success: false, error: 'Invalid or expired token', code: 'INVALID_TOKEN' }, 401);
  }
}

/** POST /api/v1/auth/logout */
export async function logoutController(c: Context) {
  const body = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON' });
  });

  const { refreshToken } = body as { refreshToken?: string };
  if (refreshToken) await logout(refreshToken);
  return c.json({ success: true, message: 'Logged out' });
}

/** GET /api/v1/auth/me */
export async function meController(c: Context) {
  const { sub, role } = c.get('user');
  try {
    const data = await getMe(sub, role);
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ success: false, error: err.message, code: err.code }, 404);
    }
    throw err;
  }
}

/** PATCH /api/v1/auth/me/interests */
export async function saveInterestsController(c: Context) {
  const { sub } = c.get('user');
  const body: unknown = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON' });
  });
  const parsed = InterestsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
  }
  try {
    await saveInterests(sub, parsed.data.interests);
    return c.json({ success: true, data: null, message: 'Interests saved' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'SAVE_FAILED' }, 500);
  }
}
