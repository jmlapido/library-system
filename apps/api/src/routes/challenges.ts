import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  listChallengesController,
  getChallengeController,
  createChallengeController,
  updateChallengeStatusController,
  deleteChallengeController,
  enrollController,
  getMyEnrollmentsController,
  leaderboardController,
} from '../controllers/challenges.controller.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

export const challengesRouter = new Hono<{ Variables: Variables }>();

// Static routes before parameterized to avoid /me matching /:id
challengesRouter.get('/', requireAuth, listChallengesController);
challengesRouter.get('/me', requireAuth, getMyEnrollmentsController);
challengesRouter.post('/', requireAuth, requireRole('admin', 'librarian'), createChallengeController);
challengesRouter.get('/:id', requireAuth, getChallengeController);
challengesRouter.patch('/:id/status', requireAuth, requireRole('admin', 'librarian'), updateChallengeStatusController);
challengesRouter.delete('/:id', requireAuth, requireRole('admin', 'librarian'), deleteChallengeController);
challengesRouter.post('/:id/enroll', requireAuth, enrollController);
challengesRouter.get('/:id/leaderboard', requireAuth, leaderboardController);
