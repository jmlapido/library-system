import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import {
  listClubsController,
  createClubController,
  getMyClubsController,
  getClubController,
  updateClubController,
  deleteClubController,
  getClubMembersController,
  joinClubController,
  leaveClubController,
} from '../controllers/bookClubs.controller.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

export const bookClubsRouter = new Hono<{ Variables: Variables }>();

bookClubsRouter.get('/', requireAuth, listClubsController);
bookClubsRouter.post('/', requireAuth, createClubController);
bookClubsRouter.get('/my', requireAuth, getMyClubsController);
bookClubsRouter.get('/:id', requireAuth, getClubController);
bookClubsRouter.patch('/:id', requireAuth, updateClubController);
bookClubsRouter.delete('/:id', requireAuth, deleteClubController);
bookClubsRouter.get('/:id/members', requireAuth, getClubMembersController);
bookClubsRouter.post('/:id/join', requireAuth, joinClubController);
bookClubsRouter.post('/:id/leave', requireAuth, leaveClubController);
