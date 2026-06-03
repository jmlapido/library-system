import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  isbnLookupController,
  searchBooksController,
  createBookController,
  getBookController,
  updateBookController,
  deleteBookController,
  addCopyController,
  updateCopyController,
  deleteCopyController,
  semanticSearchController,
  uploadCoverController,
} from '../controllers/catalog.controller.js';

export const catalogRouter = new Hono();

const staffOnly = [requireAuth, requireRole('librarian', 'admin', 'library_assistant')] as const;

catalogRouter.get('/isbn/:isbn', requireAuth, isbnLookupController);
catalogRouter.get('/search/semantic', requireAuth, semanticSearchController);

catalogRouter.get('/books', requireAuth, searchBooksController);
catalogRouter.post('/books', ...staffOnly, createBookController);
catalogRouter.get('/books/:id', requireAuth, getBookController);
catalogRouter.patch('/books/:id', ...staffOnly, updateBookController);
catalogRouter.delete('/books/:id', ...staffOnly, deleteBookController);

catalogRouter.patch('/books/:id/cover', ...staffOnly, uploadCoverController);
catalogRouter.post('/books/:id/copies', ...staffOnly, addCopyController);
catalogRouter.patch('/books/:id/copies/:copyId', ...staffOnly, updateCopyController);
catalogRouter.delete('/books/:id/copies/:copyId', ...staffOnly, deleteCopyController);
