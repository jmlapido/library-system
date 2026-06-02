import type { Context } from 'hono';
import {
  listClassSections,
  getClassSectionDetail,
  createClassSection,
  updateClassSection,
  deleteClassSection,
  addTeacher,
  removeTeacher,
  addStudent,
  removeStudent,
  CreateSectionSchema,
  UpdateSectionSchema,
} from '../services/classSections.service.js';
import { z } from 'zod';

const MemberSchema = z.object({ userId: z.string().uuid() });

/** GET /api/v1/class-sections */
export async function listSectionsController(c: Context) {
  const user = c.get('user') as { sub: string; schoolId: string | null; role: string };
  if (!user.schoolId) return c.json({ success: false, error: 'School not found', code: 'NO_SCHOOL' }, 400);
  const options = user.role === 'teacher' ? { teacherId: user.sub } : undefined;
  try {
    const sections = await listClassSections(user.schoolId, options);
    return c.json({ success: true, data: sections });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'LIST_FAILED' }, 500);
  }
}

/** GET /api/v1/class-sections/:id */
export async function getSectionController(c: Context) {
  const user = c.get('user') as { sub: string; schoolId: string | null };
  if (!user.schoolId) return c.json({ success: false, error: 'School not found', code: 'NO_SCHOOL' }, 400);
  const id = c.req.param('id') ?? '';
  if (!id) return c.json({ success: false, error: 'Missing id', code: 'MISSING_PARAM' }, 400);
  try {
    const section = await getClassSectionDetail(id, user.schoolId);
    if (!section) return c.json({ success: false, error: 'Not found', code: 'NOT_FOUND' }, 404);
    return c.json({ success: true, data: section });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'GET_FAILED' }, 500);
  }
}

/** POST /api/v1/class-sections */
export async function createSectionController(c: Context) {
  const user = c.get('user') as { sub: string; schoolId: string | null };
  if (!user.schoolId) return c.json({ success: false, error: 'School not found', code: 'NO_SCHOOL' }, 400);
  const body: unknown = await c.req.json();
  const parsed = CreateSectionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
  }
  try {
    const section = await createClassSection(user.schoolId, parsed.data);
    return c.json({ success: true, data: section }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'CREATE_FAILED' }, 500);
  }
}

/** PATCH /api/v1/class-sections/:id */
export async function updateSectionController(c: Context) {
  const user = c.get('user') as { sub: string; schoolId: string | null };
  if (!user.schoolId) return c.json({ success: false, error: 'School not found', code: 'NO_SCHOOL' }, 400);
  const id = c.req.param('id') ?? '';
  if (!id) return c.json({ success: false, error: 'Missing id', code: 'MISSING_PARAM' }, 400);
  const body: unknown = await c.req.json();
  const parsed = UpdateSectionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
  }
  try {
    const section = await updateClassSection(id, user.schoolId, parsed.data);
    if (!section) return c.json({ success: false, error: 'Not found', code: 'NOT_FOUND' }, 404);
    return c.json({ success: true, data: section });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'UPDATE_FAILED' }, 500);
  }
}

/** DELETE /api/v1/class-sections/:id */
export async function deleteSectionController(c: Context) {
  const user = c.get('user') as { sub: string; schoolId: string | null };
  if (!user.schoolId) return c.json({ success: false, error: 'School not found', code: 'NO_SCHOOL' }, 400);
  const id = c.req.param('id') ?? '';
  if (!id) return c.json({ success: false, error: 'Missing id', code: 'MISSING_PARAM' }, 400);
  try {
    await deleteClassSection(id, user.schoolId);
    return c.json({ success: true, data: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'DELETE_FAILED' }, 500);
  }
}

/** POST /api/v1/class-sections/:id/teachers */
export async function addTeacherController(c: Context) {
  const id = c.req.param('id') ?? '';
  if (!id) return c.json({ success: false, error: 'Missing id', code: 'MISSING_PARAM' }, 400);
  const body: unknown = await c.req.json();
  const parsed = MemberSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'userId is required', code: 'VALIDATION_ERROR' }, 422);
  }
  try {
    await addTeacher(id, parsed.data.userId);
    return c.json({ success: true, data: null }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'ADD_TEACHER_FAILED' }, 500);
  }
}

/** DELETE /api/v1/class-sections/:id/teachers/:userId */
export async function removeTeacherController(c: Context) {
  const id = c.req.param('id') ?? '';
  const userId = c.req.param('userId') ?? '';
  if (!id || !userId) return c.json({ success: false, error: 'Missing param', code: 'MISSING_PARAM' }, 400);
  try {
    await removeTeacher(id, userId);
    return c.json({ success: true, data: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'REMOVE_TEACHER_FAILED' }, 500);
  }
}

/** POST /api/v1/class-sections/:id/students */
export async function addStudentController(c: Context) {
  const id = c.req.param('id') ?? '';
  if (!id) return c.json({ success: false, error: 'Missing id', code: 'MISSING_PARAM' }, 400);
  const body: unknown = await c.req.json();
  const parsed = MemberSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: 'userId is required', code: 'VALIDATION_ERROR' }, 422);
  }
  try {
    await addStudent(id, parsed.data.userId);
    return c.json({ success: true, data: null }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'ADD_STUDENT_FAILED' }, 500);
  }
}

/** DELETE /api/v1/class-sections/:id/students/:userId */
export async function removeStudentController(c: Context) {
  const id = c.req.param('id') ?? '';
  const userId = c.req.param('userId') ?? '';
  if (!id || !userId) return c.json({ success: false, error: 'Missing param', code: 'MISSING_PARAM' }, 400);
  try {
    await removeStudent(id, userId);
    return c.json({ success: true, data: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'REMOVE_STUDENT_FAILED' }, 500);
  }
}
