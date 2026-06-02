import { Hono } from 'hono';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import {
  listSchoolsController,
  getSchoolController,
  createSchoolController,
  updateSchoolController,
} from '../controllers/superAdmin.controller.js';

export const superAdminRouter = new Hono();

superAdminRouter.use('*', requireAuth);
superAdminRouter.use('*', requireSuperAdmin);

superAdminRouter.get('/schools', listSchoolsController);
superAdminRouter.post('/schools', createSchoolController);
superAdminRouter.get('/schools/:id', getSchoolController);
superAdminRouter.patch('/schools/:id', updateSchoolController);
