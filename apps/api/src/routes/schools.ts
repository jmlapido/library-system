import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getSettingsController, updateSettingsController } from '../controllers/school.controller.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

export const schoolsRouter = new Hono<{ Variables: Variables }>();

schoolsRouter.get('/schools/settings', requireAuth, requireRole('librarian', 'admin'), getSettingsController);
schoolsRouter.patch('/schools/settings', requireAuth, requireRole('admin'), updateSettingsController);
