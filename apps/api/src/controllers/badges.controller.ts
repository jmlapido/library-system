import type { Context } from 'hono';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import * as badgesService from '../services/badges.service.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

const CreateBadgeSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  iconUrl: z.string().url().optional(),
  criteria: z.string().max(255).optional(),
});

const CheckAndAwardSchema = z.object({
  userId: z.string().uuid(),
});

/** Parse JSON body against a Zod schema. Returns parsed data or a 422 Response. */
async function parseBody<T>(c: Context, schema: z.ZodType<T>): Promise<T | Response> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, 422) as unknown as Response;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return c.json({ success: false, error: result.error.message, code: 'VALIDATION_ERROR' }, 422) as unknown as Response;
  }
  return result.data;
}

/** Map AppError codes to HTTP status numbers. */
function errorStatus(code: string): 400 | 403 | 404 | 409 {
  if (code === 'BADGE_NOT_FOUND') return 404;
  if (code === 'BADGE_IN_USE') return 409;
  return 400;
}

/**
 * GET /api/v1/badges
 * Lists all badges for the authenticated user's school.
 */
export async function listBadgesController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  try {
    const data = await badgesService.listBadges(user.schoolId!);
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * GET /api/v1/badges/me
 * Returns all badges earned by the authenticated user.
 */
export async function getMyBadgesController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  try {
    const data = await badgesService.getMyBadges(user.sub, user.schoolId!);
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * POST /api/v1/badges
 * Creates a new badge for the school. Admin/librarian only.
 */
export async function createBadgeController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const body = await parseBody(c, CreateBadgeSchema);
  if (body instanceof Response) return body;
  try {
    const badge = await badgesService.createBadge({
      schoolId: user.schoolId!,
      name: body.name,
      ...(body.description !== undefined && { description: body.description }),
      ...(body.iconUrl !== undefined && { iconUrl: body.iconUrl }),
      ...(body.criteria !== undefined && { criteria: body.criteria }),
    });
    return c.json({ success: true, data: badge, message: 'Badge created' }, 201);
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * DELETE /api/v1/badges/:id
 * Deletes a badge. Fails if any user has earned it. Admin/librarian only.
 */
export async function deleteBadgeController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const badgeId = c.req.param('id') ?? '';
  try {
    await badgesService.deleteBadge(badgeId, user.schoolId!);
    return c.json({ success: true, message: 'Badge deleted' });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * POST /api/v1/badges/seed
 * Seeds the 7 default badge definitions for the school. Admin only.
 */
export async function seedDefaultBadgesController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  try {
    const created = await badgesService.seedDefaultBadges(user.schoolId!);
    return c.json({ success: true, data: created, message: `Seeded ${created.length} default badges` });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * POST /api/v1/badges/check
 * Manually triggers badge check for a specific user. Admin/librarian only.
 */
export async function checkAndAwardController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const body = await parseBody(c, CheckAndAwardSchema);
  if (body instanceof Response) return body;
  try {
    const awarded = await badgesService.checkAndAwardBadges(body.userId, user.schoolId!);
    return c.json({ success: true, data: awarded, message: `Awarded ${awarded.length} new badge(s)` });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}
