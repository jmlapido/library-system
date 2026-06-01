import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { importStudentsController, importBooksController } from '../controllers/import.controller.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

export const importRouter = new Hono<{ Variables: Variables }>();

importRouter.post(
  '/users/import',
  requireAuth,
  requireRole('librarian', 'admin'),
  importStudentsController,
);

importRouter.post(
  '/books/import/csv',
  requireAuth,
  requireRole('librarian', 'admin'),
  importBooksController,
);
