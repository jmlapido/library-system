import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { LoginSchema } from 'shared';
import { AppError, login, refreshSession, logout } from '../services/auth.service.js';

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
      if (err.code === 'INVALID_CREDENTIALS') {
        return c.json({ success: false, error: 'Invalid credentials', code: err.code }, 401);
      }
      if (err.code === 'ACCOUNT_INACTIVE') {
        return c.json({ success: false, error: 'Account is inactive', code: err.code }, 403);
      }
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
  const user = c.get('user');
  return c.json({ success: true, data: user });
}
