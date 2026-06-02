import type { Context } from 'hono';
import { AppError } from '../utils/errors.js';
import { getSchoolSettings, updateSchoolSettings, SchoolSettingsSchema, SchoolInfoSchema } from '../services/school.service.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

/**
 * GET /api/v1/schools/settings
 * Returns current school info and settings. Roles: librarian, admin.
 */
export async function getSettingsController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  try {
    const data = await getSchoolSettings(user.schoolId);
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ success: false, error: err.message, code: err.code }, 400);
    }
    throw err;
  }
}

/**
 * PATCH /api/v1/schools/settings
 * Updates school info and/or settings. Roles: admin only.
 */
export async function updateSettingsController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body', code: 'INVALID_BODY' }, 400);
  }

  const bodyObj = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};

  const infoResult = SchoolInfoSchema.safeParse(bodyObj);
  if (!infoResult.success) {
    return c.json({ success: false, error: infoResult.error.issues[0]?.message ?? 'Invalid info', code: 'INVALID_INFO' }, 422);
  }

  const { name: _n, location: _l, ...settingsFields } = bodyObj;
  const settingsResult = SchoolSettingsSchema.partial().safeParse(settingsFields);
  if (!settingsResult.success) {
    return c.json({ success: false, error: settingsResult.error.issues[0]?.message ?? 'Invalid settings', code: 'INVALID_SETTINGS' }, 422);
  }

  try {
    const settings = await updateSchoolSettings(user.schoolId, infoResult.data, settingsResult.data);
    return c.json({ success: true, data: settings });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ success: false, error: err.message, code: err.code }, 400);
    }
    throw err;
  }
}
