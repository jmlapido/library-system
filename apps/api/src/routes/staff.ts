import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as staffController from '../controllers/staff.controller.js';
import * as permissionsController from '../controllers/permissions.controller.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

/** Public auth routes for staff self-registration and token-based flows. */
export const staffAuthRouter = new Hono();
staffAuthRouter.post('/register', staffController.register);
staffAuthRouter.post('/verify-email', staffController.verifyEmailHandler);
staffAuthRouter.post('/set-password', staffController.setPasswordHandler);

/** Admin-protected routes for staff management (admin and librarian only). */
export const staffAdminRouter = new Hono<{ Variables: Variables }>();
staffAdminRouter.use('*', requireAuth, requireRole('admin', 'librarian'));
staffAdminRouter.get('/pending', staffController.listPending);
staffAdminRouter.get('/', staffController.listActive);
staffAdminRouter.post('/:id/approve', staffController.approve);
staffAdminRouter.post('/:id/reject', staffController.reject);
staffAdminRouter.post('/', staffController.createByAdmin);
staffAdminRouter.get('/:id/permissions', requireRole('admin'), permissionsController.getPermissionsController);
staffAdminRouter.patch('/:id/permissions', requireRole('admin'), permissionsController.setPermissionsController);
