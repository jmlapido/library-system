import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import * as permissionsService from '../services/permissions.service.js';
import { ALL_GRANTABLE_PERMISSIONS } from '../services/permissions.service.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

const SetPermissionsSchema = z.object({
  permissions: z.array(z.enum(ALL_GRANTABLE_PERMISSIONS)),
});

/**
 * GET /api/v1/admin/staff/:id/permissions
 * Returns the granted extras for the target user (not role-floor defaults).
 * Scoped to the admin's school — cross-school reads are rejected with 403.
 */
export async function getPermissionsController(c: Context<{ Variables: Variables }>) {
  const targetId = c.req.param('id') ?? '';
  const admin = c.get('user');
  try {
    const permissions = await permissionsService.getUserGrantedPermissionsScoped(targetId, admin.schoolId!);
    return c.json({ success: true, data: { permissions } });
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'USER_NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
      return c.json({ success: false, error: err.message, code: err.code }, status);
    }
    throw err;
  }
}

/**
 * PATCH /api/v1/admin/staff/:id/permissions
 * Replaces the granted extras for the target user. Admin only.
 * Validates JSON body, school isolation, and that target is a library_assistant.
 */
export async function setPermissionsController(c: Context<{ Variables: Variables }>) {
  const targetId = c.req.param('id') ?? '';
  const admin = c.get('user');

  const rawBody = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON' });
  });

  const parsed = SetPermissionsSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
  }

  try {
    await permissionsService.setUserPermissions(
      targetId,
      parsed.data.permissions,
      admin.sub,
      admin.schoolId!,
    );
    return c.json({ success: true, data: { permissions: parsed.data.permissions } });
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'USER_NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
      return c.json({ success: false, error: err.message, code: err.code }, status);
    }
    throw err;
  }
}
