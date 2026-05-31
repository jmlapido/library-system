import type { Context } from 'hono';
import { AppError } from '../utils/errors.js';
import * as permissionsService from '../services/permissions.service.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

/**
 * GET /api/v1/admin/staff/:id/permissions
 * Returns the granted extras for the target user (not role-floor defaults).
 */
export async function getPermissionsController(c: Context<{ Variables: Variables }>) {
  const targetId = c.req.param('id') ?? '';
  try {
    const permissions = await permissionsService.getUserGrantedPermissions(targetId);
    return c.json({ success: true, data: { permissions } });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ success: false, error: err.message, code: err.code }, 404);
    }
    throw err;
  }
}

/**
 * PATCH /api/v1/admin/staff/:id/permissions
 * Replaces the granted extras for the target user. Admin only.
 */
export async function setPermissionsController(c: Context<{ Variables: Variables }>) {
  const targetId = c.req.param('id') ?? '';
  const admin = c.get('user');
  const body = (await c.req.json()) as { permissions?: unknown };
  const permissions = Array.isArray(body.permissions)
    ? (body.permissions as string[])
    : [];

  try {
    await permissionsService.setUserPermissions(targetId, permissions, admin.sub);
    return c.json({ success: true, data: { permissions } });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ success: false, error: err.message, code: err.code }, 404);
    }
    throw err;
  }
}
