import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import {
  getMyListsController,
  getListWithItemsController,
  createListController,
  updateListController,
  deleteListController,
  addBookController,
  updateItemStatusController,
  removeBookController,
} from '../controllers/readingLists.controller.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

export const readingListsRouter = new Hono<{ Variables: Variables }>();

readingListsRouter.get('/', requireAuth, getMyListsController);
readingListsRouter.post('/', requireAuth, createListController);
readingListsRouter.get('/:id', requireAuth, getListWithItemsController);
readingListsRouter.patch('/:id', requireAuth, updateListController);
readingListsRouter.delete('/:id', requireAuth, deleteListController);
readingListsRouter.post('/:id/books', requireAuth, addBookController);
readingListsRouter.patch('/:id/books/:bookId', requireAuth, updateItemStatusController);
readingListsRouter.delete('/:id/books/:bookId', requireAuth, removeBookController);
