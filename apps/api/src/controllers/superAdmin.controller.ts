import type { Context } from 'hono';
import { AppError } from '../utils/errors.js';
import {
  listAllSchools,
  getSchoolById,
  createSchool,
  updateSchool,
} from '../services/superAdmin.service.js';

/**
 * GET /api/v1/super-admin/schools — return all schools.
 */
export async function listSchoolsController(c: Context) {
  const data = await listAllSchools();
  return c.json({ success: true, data });
}

/**
 * GET /api/v1/super-admin/schools/:id — return one school.
 */
export async function getSchoolController(c: Context) {
  const id = c.req.param('id') ?? '';
  try {
    const school = await getSchoolById(id);
    return c.json({ success: true, data: school });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ success: false, error: err.message, code: err.code }, 404);
    }
    throw err;
  }
}

/**
 * POST /api/v1/super-admin/schools — create a new school.
 */
export async function createSchoolController(c: Context) {
  const body = await c.req.json() as { name?: unknown; location?: unknown };
  if (typeof body.name !== 'string' || !body.name.trim()) {
    return c.json({ success: false, error: 'name is required', code: 'VALIDATION_ERROR' }, 400);
  }
  try {
    const input: { name: string; location?: string } = { name: body.name };
    if (typeof body.location === 'string') input.location = body.location;
    const school = await createSchool(input);
    return c.json({ success: true, data: school, message: 'School created' }, 201);
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ success: false, error: err.message, code: err.code }, 400);
    }
    throw err;
  }
}

/**
 * PATCH /api/v1/super-admin/schools/:id — update school name/location.
 */
export async function updateSchoolController(c: Context) {
  const id = c.req.param('id') ?? '';
  const body = await c.req.json() as { name?: unknown; location?: unknown };
  const input: { name?: string; location?: string } = {};
  if (typeof body.name === 'string') input.name = body.name;
  if (typeof body.location === 'string') input.location = body.location;
  try {
    const school = await updateSchool(id, input);
    return c.json({ success: true, data: school });
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'SCHOOL_NOT_FOUND' ? 404 : 400;
      return c.json({ success: false, error: err.message, code: err.code }, status);
    }
    throw err;
  }
}
