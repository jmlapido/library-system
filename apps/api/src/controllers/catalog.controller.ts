import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  CreateBookSchema,
  UpdateBookSchema,
  AddCopySchema,
  UpdateCopySchema,
  BookSearchSchema,
} from 'shared';
import {
  createBook,
  getBook,
  updateBook,
  deleteBook,
  searchBooks,
  lookupIsbnMetadata,
  addCopy,
  updateCopy,
  deleteCopy,
} from '../services/catalog.service.js';
import { findSimilarBooks } from '../services/embedding.service.js';
import { AppError } from '../utils/errors.js';

function parseBody(c: Context) {
  return c.req.json().catch(() => {
    throw new HTTPException(400, { message: 'Invalid JSON' });
  });
}

function handleAppError(err: unknown, c: Context) {
  if (err instanceof AppError) {
    const status = err.code === 'BOOK_NOT_FOUND' || err.code === 'COPY_NOT_FOUND' ? 404
      : err.code === 'COPY_IS_CHECKED_OUT' ? 409
      : 422;
    return c.json({ success: false, error: err.message, code: err.code }, status);
  }
  throw err;
}

/** GET /api/v1/catalog/isbn/:isbn */
export async function isbnLookupController(c: Context) {
  const isbn = c.req.param('isbn')!;
  const metadata = await lookupIsbnMetadata(isbn);
  if (!metadata) {
    return c.json({ success: false, error: 'No metadata found for this ISBN', code: 'ISBN_NOT_FOUND' }, 404);
  }
  return c.json({ success: true, data: metadata, message: 'ISBN metadata retrieved' });
}

/** GET /api/v1/catalog/books */
export async function searchBooksController(c: Context) {
  const parsed = BookSearchSchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
  }
  const user = c.get('user') as { schoolId: string };
  const result = await searchBooks(parsed.data, user.schoolId);
  return c.json({ success: true, data: result, message: 'Books retrieved' });
}

/** POST /api/v1/catalog/books */
export async function createBookController(c: Context) {
  const body = await parseBody(c);
  const parsed = CreateBookSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
  }
  const user = c.get('user') as { schoolId: string };
  try {
    const book = await createBook(parsed.data, user.schoolId);
    return c.json({ success: true, data: book, message: 'Book created' }, 201);
  } catch (err) {
    return handleAppError(err, c);
  }
}

/** GET /api/v1/catalog/books/:id */
export async function getBookController(c: Context) {
  const id = c.req.param('id')!;
  const user = c.get('user') as { schoolId: string };
  try {
    const book = await getBook(id, user.schoolId);
    return c.json({ success: true, data: book, message: 'Book retrieved' });
  } catch (err) {
    return handleAppError(err, c);
  }
}

/** PATCH /api/v1/catalog/books/:id */
export async function updateBookController(c: Context) {
  const id = c.req.param('id')!;
  const body = await parseBody(c);
  const parsed = UpdateBookSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
  }
  const user = c.get('user') as { schoolId: string };
  try {
    const book = await updateBook(id, parsed.data, user.schoolId);
    return c.json({ success: true, data: book, message: 'Book updated' });
  } catch (err) {
    return handleAppError(err, c);
  }
}

/** DELETE /api/v1/catalog/books/:id */
export async function deleteBookController(c: Context) {
  const id = c.req.param('id')!;
  const user = c.get('user') as { schoolId: string };
  try {
    await deleteBook(id, user.schoolId);
    return c.json({ success: true, data: null, message: 'Book deleted' });
  } catch (err) {
    return handleAppError(err, c);
  }
}

/** POST /api/v1/catalog/books/:id/copies */
export async function addCopyController(c: Context) {
  const bookId = c.req.param('id')!;
  const body = await parseBody(c);
  const parsed = AddCopySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
  }
  const user = c.get('user') as { schoolId: string };
  try {
    const copy = await addCopy(bookId, parsed.data, user.schoolId);
    return c.json({ success: true, data: copy, message: 'Copy added' }, 201);
  } catch (err) {
    return handleAppError(err, c);
  }
}

/** PATCH /api/v1/catalog/books/:id/copies/:copyId */
export async function updateCopyController(c: Context) {
  const copyId = c.req.param('copyId')!;
  const body = await parseBody(c);
  const parsed = UpdateCopySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
  }
  const user = c.get('user') as { schoolId: string };
  try {
    const copy = await updateCopy(copyId, parsed.data, user.schoolId);
    return c.json({ success: true, data: copy, message: 'Copy updated' });
  } catch (err) {
    return handleAppError(err, c);
  }
}

/** DELETE /api/v1/catalog/books/:id/copies/:copyId */
export async function deleteCopyController(c: Context) {
  const copyId = c.req.param('copyId')!;
  const user = c.get('user') as { schoolId: string };
  try {
    await deleteCopy(copyId, user.schoolId);
    return c.json({ success: true, data: null, message: 'Copy deleted' });
  } catch (err) {
    return handleAppError(err, c);
  }
}

/** GET /api/v1/catalog/search/semantic */
export async function semanticSearchController(c: Context) {
  const user = c.get('user') as { schoolId: string };
  const q = c.req.query('q') ?? '';
  const limit = Math.min(parseInt(c.req.query('limit') ?? '10', 10), 50);
  const excludeBookId = c.req.query('excludeBookId');

  if (!q.trim()) {
    return c.json({ success: false, error: 'q parameter required', code: 'VALIDATION_ERROR' }, 400);
  }

  const results = await findSimilarBooks(q, user.schoolId, limit, excludeBookId);
  return c.json({ success: true, data: results, message: 'Semantic search results' });
}
