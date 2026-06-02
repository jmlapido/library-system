import type { Context } from 'hono';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import * as challengesService from '../services/challenges.service.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

const CreateChallengeSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  goal: z.number().int().positive(),
  goalType: z.enum(['books', 'pages', 'genres']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD'),
});

const UpdateStatusSchema = z.object({
  status: z.enum(['upcoming', 'active', 'completed']),
});

const ChallengeFiltersSchema = z.object({
  status: z.enum(['upcoming', 'active', 'completed']).optional(),
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
function errorStatus(code: string): 400 | 404 | 409 {
  if (code === 'CHALLENGE_NOT_FOUND') return 404;
  if (code === 'ALREADY_ENROLLED') return 409;
  return 400;
}

/**
 * GET /api/v1/challenges
 * Lists challenges for the school, optional ?status filter.
 */
export async function listChallengesController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const query = ChallengeFiltersSchema.safeParse(c.req.query());
  const status = query.success ? query.data.status : undefined;
  try {
    const data = await challengesService.listChallenges(user.schoolId!, status);
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * GET /api/v1/challenges/:id
 * Returns a single challenge with enrolled count.
 */
export async function getChallengeController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const challengeId = c.req.param('id') ?? '';
  try {
    const data = await challengesService.getChallenge(challengeId, user.schoolId!);
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * POST /api/v1/challenges
 * Creates a challenge. Admin/librarian only.
 */
export async function createChallengeController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const body = await parseBody(c, CreateChallengeSchema);
  if (body instanceof Response) return body;
  try {
    const data = await challengesService.createChallenge(
      {
        schoolId: user.schoolId!,
        title: body.title,
        goal: body.goal,
        goalType: body.goalType,
        startDate: body.startDate,
        endDate: body.endDate,
        ...(body.description !== undefined && { description: body.description }),
      },
      user.sub,
    );
    return c.json({ success: true, data, message: 'Challenge created' }, 201);
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * PATCH /api/v1/challenges/:id/status
 * Manually override challenge status. Admin/librarian only.
 */
export async function updateChallengeStatusController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const challengeId = c.req.param('id') ?? '';
  const body = await parseBody(c, UpdateStatusSchema);
  if (body instanceof Response) return body;
  try {
    const data = await challengesService.updateChallengeStatus(challengeId, user.schoolId!, body.status);
    return c.json({ success: true, data, message: 'Status updated' });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * DELETE /api/v1/challenges/:id
 * Deletes a challenge (only if upcoming). Admin/librarian only.
 */
export async function deleteChallengeController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const challengeId = c.req.param('id') ?? '';
  try {
    await challengesService.deleteChallenge(challengeId, user.schoolId!);
    return c.json({ success: true, message: 'Challenge deleted' });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * POST /api/v1/challenges/:id/enroll
 * Enroll the authenticated user in a challenge.
 */
export async function enrollController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const challengeId = c.req.param('id') ?? '';
  try {
    const data = await challengesService.enrollInChallenge(challengeId, user.sub, user.schoolId!);
    return c.json({ success: true, data, message: 'Enrolled in challenge' });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * GET /api/v1/challenges/me
 * Returns the authenticated user's challenge enrollments with progress.
 */
export async function getMyEnrollmentsController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  try {
    const data = await challengesService.getMyEnrollments(user.sub, user.schoolId!);
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * GET /api/v1/challenges/:id/leaderboard
 * Returns top 20 students by progress for a challenge.
 */
export async function leaderboardController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const challengeId = c.req.param('id') ?? '';
  try {
    const data = await challengesService.getChallengeLeaderboard(challengeId, user.schoolId!);
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}
