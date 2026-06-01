import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import * as readingListsService from '../services/readingLists.service.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

const CreateListSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

const UpdateListSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

const AddBookSchema = z.object({
  bookId: z.string().uuid(),
  status: z.enum(['to_read', 'reading', 'completed']).optional(),
});

const UpdateItemStatusSchema = z.object({
  status: z.enum(['to_read', 'reading', 'completed']),
});

/** Parse body or return 422. */
async function parseBody<T>(c: Context, schema: z.ZodType<T>): Promise<T | Response> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON', code: 'VALIDATION_ERROR' }, 422) as unknown as Response;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422) as unknown as Response;
  }
  return parsed.data;
}

/** Map AppError codes to HTTP status codes. */
function errorStatus(code: string): 400 | 403 | 404 | 409 {
  if (code === 'LIST_NOT_FOUND' || code === 'BOOK_NOT_FOUND') return 404;
  if (code === 'LIST_ACCESS_DENIED') return 403;
  if (code === 'BOOK_ALREADY_IN_LIST') return 409;
  return 400;
}

/**
 * GET /api/v1/reading-lists
 * Returns all reading lists for the authenticated user.
 */
export async function getMyListsController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  try {
    const lists = await readingListsService.getMyLists(user.sub);
    return c.json({ success: true, data: lists });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * GET /api/v1/reading-lists/:id
 * Returns a single reading list with its books. Owner only.
 */
export async function getListWithItemsController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const listId = c.req.param('id') ?? '';
  try {
    const list = await readingListsService.getListWithItems(listId, user.sub, user.schoolId);
    return c.json({ success: true, data: list });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * POST /api/v1/reading-lists
 * Creates a new reading list for the authenticated user.
 */
export async function createListController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const body = await parseBody(c, CreateListSchema);
  if (body instanceof Response) return body;
  try {
    const data: { title: string; description?: string; isPublic?: boolean } = { title: body.title };
    if (body.description !== undefined) data.description = body.description;
    if (body.isPublic !== undefined) data.isPublic = body.isPublic;
    const list = await readingListsService.createList(user.sub, user.schoolId, data);
    return c.json({ success: true, data: list, message: 'Reading list created' }, 201);
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * PATCH /api/v1/reading-lists/:id
 * Updates a reading list. Owner only.
 */
export async function updateListController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const listId = c.req.param('id') ?? '';
  const body = await parseBody(c, UpdateListSchema);
  if (body instanceof Response) return body;
  try {
    const data: { title?: string; description?: string; isPublic?: boolean } = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.isPublic !== undefined) data.isPublic = body.isPublic;
    const list = await readingListsService.updateList(listId, user.sub, user.schoolId, data);
    return c.json({ success: true, data: list, message: 'Reading list updated' });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * DELETE /api/v1/reading-lists/:id
 * Deletes a reading list and all its items. Owner only.
 */
export async function deleteListController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const listId = c.req.param('id') ?? '';
  try {
    await readingListsService.deleteList(listId, user.sub, user.schoolId);
    return c.json({ success: true, message: 'Reading list deleted' });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * POST /api/v1/reading-lists/:id/books
 * Adds a book to a reading list. Owner only.
 */
export async function addBookController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const listId = c.req.param('id') ?? '';
  const body = await parseBody(c, AddBookSchema);
  if (body instanceof Response) return body;
  try {
    const item = await readingListsService.addBook(listId, user.sub, user.schoolId, body.bookId, body.status);
    return c.json({ success: true, data: item, message: 'Book added to list' }, 201);
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * PATCH /api/v1/reading-lists/:id/books/:bookId
 * Updates reading status for a book in a list. Owner only.
 */
export async function updateItemStatusController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const listId = c.req.param('id') ?? '';
  const bookId = c.req.param('bookId') ?? '';
  const body = await parseBody(c, UpdateItemStatusSchema);
  if (body instanceof Response) return body;
  try {
    const item = await readingListsService.updateItemStatus(listId, user.sub, user.schoolId, bookId, body.status);
    return c.json({ success: true, data: item, message: 'Status updated' });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * DELETE /api/v1/reading-lists/:id/books/:bookId
 * Removes a book from a reading list. Owner only.
 */
export async function removeBookController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const listId = c.req.param('id') ?? '';
  const bookId = c.req.param('bookId') ?? '';
  try {
    await readingListsService.removeBook(listId, user.sub, user.schoolId, bookId);
    return c.json({ success: true, message: 'Book removed from list' });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}
