import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { getRecommendationsController } from '../controllers/recommendations.controller.js';

export const recommendationsRouter = new Hono();

/**
 * GET /api/v1/recommendations
 * Returns personalized AI-powered book recommendations for the authenticated user.
 * Accessible by any authenticated role (student, teacher, librarian, etc.).
 */
recommendationsRouter.get('/', requireAuth, getRecommendationsController);
