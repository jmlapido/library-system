import type { Context } from 'hono';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import * as bookClubsService from '../services/bookClubs.service.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };
type ClubStatus = 'planning' | 'active' | 'completed' | 'cancelled';

const ClubStatusEnum = z.enum(['planning', 'active', 'completed', 'cancelled']);

const CreateClubSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  bookId: z.string().uuid().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  maxMembers: z.number().int().positive().optional(),
});

const UpdateClubSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  bookId: z.string().uuid().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  maxMembers: z.number().int().positive().optional(),
  status: ClubStatusEnum.optional(),
});

const ClubFiltersSchema = z.object({
  status: ClubStatusEnum.optional(),
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
  const notFound = ['CLUB_NOT_FOUND'];
  const forbidden = ['CLUB_ACCESS_DENIED', 'ORGANIZER_CANNOT_LEAVE'];
  const conflict = ['ALREADY_A_MEMBER', 'CLUB_FULL'];
  if (notFound.includes(code)) return 404;
  if (forbidden.includes(code)) return 403;
  if (conflict.includes(code)) return 409;
  return 400;
}

/**
 * GET /api/v1/book-clubs
 * Lists all clubs for the authenticated user's school.
 */
export async function listClubsController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const raw = c.req.query();
  const filtersResult = ClubFiltersSchema.safeParse(raw);
  const filters: { status?: ClubStatus } = {};
  if (filtersResult.success && filtersResult.data.status) filters.status = filtersResult.data.status;
  try {
    const clubs = await bookClubsService.listClubs(user.schoolId!, filters);
    return c.json({ success: true, data: clubs });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * POST /api/v1/book-clubs
 * Creates a new book club. Organizer is auto-joined.
 */
export async function createClubController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const body = await parseBody(c, CreateClubSchema);
  if (body instanceof Response) return body;
  try {
    const data: Parameters<typeof bookClubsService.createClub>[0] = { schoolId: user.schoolId!, name: body.name };
    if (body.description !== undefined) data.description = body.description;
    if (body.bookId !== undefined) data.bookId = body.bookId;
    if (body.startDate !== undefined) data.startDate = body.startDate;
    if (body.endDate !== undefined) data.endDate = body.endDate;
    if (body.maxMembers !== undefined) data.maxMembers = body.maxMembers;
    const club = await bookClubsService.createClub(data, user.sub);
    return c.json({ success: true, data: club, message: 'Book club created' }, 201);
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * GET /api/v1/book-clubs/my
 * Returns all clubs the authenticated user is a member of.
 */
export async function getMyClubsController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  try {
    const clubs = await bookClubsService.getMyClubs(user.sub, user.schoolId!);
    return c.json({ success: true, data: clubs });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * GET /api/v1/book-clubs/:id
 * Returns a single club with member count and book details.
 */
export async function getClubController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const clubId = c.req.param('id') ?? '';
  try {
    const club = await bookClubsService.getClub(clubId, user.schoolId!);
    return c.json({ success: true, data: club });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * PATCH /api/v1/book-clubs/:id
 * Updates a club. Organizer only.
 */
export async function updateClubController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const clubId = c.req.param('id') ?? '';
  const body = await parseBody(c, UpdateClubSchema);
  if (body instanceof Response) return body;
  try {
    const data: Parameters<typeof bookClubsService.updateClub>[2] = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.bookId !== undefined) data.bookId = body.bookId;
    if (body.startDate !== undefined) data.startDate = body.startDate;
    if (body.endDate !== undefined) data.endDate = body.endDate;
    if (body.maxMembers !== undefined) data.maxMembers = body.maxMembers;
    if (body.status !== undefined) data.status = body.status;
    const club = await bookClubsService.updateClub(clubId, user.sub, data);
    return c.json({ success: true, data: club, message: 'Book club updated' });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * DELETE /api/v1/book-clubs/:id
 * Deletes a club. Organizer only. Must be in 'planning' status.
 */
export async function deleteClubController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const clubId = c.req.param('id') ?? '';
  try {
    await bookClubsService.deleteClub(clubId, user.sub, user.schoolId!);
    return c.json({ success: true, message: 'Book club deleted' });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * GET /api/v1/book-clubs/:id/members
 * Returns all members of a club with user info.
 */
export async function getClubMembersController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const clubId = c.req.param('id') ?? '';
  try {
    const members = await bookClubsService.getClubMembers(clubId, user.schoolId!);
    return c.json({ success: true, data: members });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * POST /api/v1/book-clubs/:id/join
 * Joins a club as a member.
 */
export async function joinClubController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const clubId = c.req.param('id') ?? '';
  try {
    const member = await bookClubsService.joinClub(clubId, user.sub, user.schoolId!);
    return c.json({ success: true, data: member, message: 'Joined book club' });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * POST /api/v1/book-clubs/:id/leave
 * Leaves a club. Organizer cannot leave.
 */
export async function leaveClubController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const clubId = c.req.param('id') ?? '';
  try {
    await bookClubsService.leaveClub(clubId, user.sub);
    return c.json({ success: true, message: 'Left book club' });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}
