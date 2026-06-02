import type { Context } from 'hono';
import {
  listSchoolYears,
  createSchoolYear,
  updateSchoolYear,
  activateSchoolYear,
  deleteSchoolYear,
  CreateSchoolYearSchema,
  UpdateSchoolYearSchema,
} from '../services/schoolYears.service.js';

/** GET /api/v1/school-years */
export async function listYearsController(c: Context) {
  const user = c.get('user') as { sub: string; schoolId: string | null };
  if (!user.schoolId) return c.json({ success: false, error: 'School not found', code: 'NO_SCHOOL' }, 400);
  try {
    const years = await listSchoolYears(user.schoolId);
    return c.json({ success: true, data: years });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'LIST_FAILED' }, 500);
  }
}

/** POST /api/v1/school-years */
export async function createYearController(c: Context) {
  const user = c.get('user') as { sub: string; schoolId: string | null };
  if (!user.schoolId) return c.json({ success: false, error: 'School not found', code: 'NO_SCHOOL' }, 400);
  const body: unknown = await c.req.json();
  const parsed = CreateSchoolYearSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
  }
  try {
    const year = await createSchoolYear(user.schoolId, parsed.data);
    return c.json({ success: true, data: year }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'CREATE_FAILED' }, 500);
  }
}

/** PATCH /api/v1/school-years/:id */
export async function updateYearController(c: Context) {
  const user = c.get('user') as { sub: string; schoolId: string | null };
  if (!user.schoolId) return c.json({ success: false, error: 'School not found', code: 'NO_SCHOOL' }, 400);
  const id = c.req.param('id') ?? '';
  if (!id) return c.json({ success: false, error: 'Missing id', code: 'MISSING_PARAM' }, 400);
  const body: unknown = await c.req.json();
  const parsed = UpdateSchoolYearSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
  }
  try {
    const year = await updateSchoolYear(id, user.schoolId, parsed.data);
    if (!year) return c.json({ success: false, error: 'Not found', code: 'NOT_FOUND' }, 404);
    return c.json({ success: true, data: year });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'UPDATE_FAILED' }, 500);
  }
}

/** POST /api/v1/school-years/:id/activate */
export async function activateYearController(c: Context) {
  const user = c.get('user') as { sub: string; schoolId: string | null };
  if (!user.schoolId) return c.json({ success: false, error: 'School not found', code: 'NO_SCHOOL' }, 400);
  const id = c.req.param('id') ?? '';
  if (!id) return c.json({ success: false, error: 'Missing id', code: 'MISSING_PARAM' }, 400);
  try {
    const year = await activateSchoolYear(id, user.schoolId);
    if (!year) return c.json({ success: false, error: 'Not found', code: 'NOT_FOUND' }, 404);
    return c.json({ success: true, data: year });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'ACTIVATE_FAILED' }, 500);
  }
}

/** DELETE /api/v1/school-years/:id */
export async function deleteYearController(c: Context) {
  const user = c.get('user') as { sub: string; schoolId: string | null };
  if (!user.schoolId) return c.json({ success: false, error: 'School not found', code: 'NO_SCHOOL' }, 400);
  const id = c.req.param('id') ?? '';
  if (!id) return c.json({ success: false, error: 'Missing id', code: 'MISSING_PARAM' }, 400);
  try {
    await deleteSchoolYear(id, user.schoolId);
    return c.json({ success: true, data: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'DELETE_FAILED' }, 500);
  }
}
