import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  listBadgesController,
  getMyBadgesController,
  createBadgeController,
  deleteBadgeController,
  seedDefaultBadgesController,
  checkAndAwardController,
} from '../controllers/badges.controller.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

export const badgesRouter = new Hono<{ Variables: Variables }>();

badgesRouter.get('/', requireAuth, listBadgesController);
badgesRouter.get('/me', requireAuth, getMyBadgesController);
badgesRouter.post('/seed', requireAuth, requireRole('admin'), seedDefaultBadgesController);
badgesRouter.post('/check', requireAuth, requireRole('admin', 'librarian'), checkAndAwardController);
badgesRouter.post('/', requireAuth, requireRole('admin', 'librarian'), createBadgeController);
badgesRouter.delete('/:id', requireAuth, requireRole('admin', 'librarian'), deleteBadgeController);
