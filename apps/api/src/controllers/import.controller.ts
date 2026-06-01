import type { Context } from 'hono';
import { AppError } from '../utils/errors.js';
import { importStudents, importBooks } from '../services/import.service.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

/** Extract the uploaded file from a multipart form request and return its text. */
async function readUploadedFile(c: Context): Promise<string | Response> {
  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || typeof file === 'string') {
    return c.json(
      { success: false, error: 'Missing file field in form data', code: 'MISSING_FILE' },
      422,
    ) as unknown as Response;
  }

  const text = await (file as File).text();
  if (!text.trim()) {
    return c.json(
      { success: false, error: 'Uploaded file is empty', code: 'EMPTY_FILE' },
      422,
    ) as unknown as Response;
  }

  return text;
}

/**
 * POST /api/v1/users/import
 * Accepts a multipart CSV of student records and bulk-upserts them into the school.
 * Roles: librarian, admin.
 */
export async function importStudentsController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const fileOrError = await readUploadedFile(c);
  if (fileOrError instanceof Response) return fileOrError;

  try {
    const result = await importStudents(fileOrError, user.schoolId);
    return c.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ success: false, error: err.message, code: err.code }, 400);
    }
    throw err;
  }
}

/**
 * POST /api/v1/books/import/csv
 * Accepts a multipart CSV of book records and upserts them with inventory copies.
 * Roles: librarian, admin.
 */
export async function importBooksController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const fileOrError = await readUploadedFile(c);
  if (fileOrError instanceof Response) return fileOrError;

  try {
    const result = await importBooks(fileOrError, user.schoolId);
    return c.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ success: false, error: err.message, code: err.code }, 400);
    }
    throw err;
  }
}
