import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  listYearsController,
  createYearController,
  updateYearController,
  activateYearController,
  deleteYearController,
} from '../controllers/schoolYears.controller.js';

export const schoolYearsRouter = new Hono();

const adminOnly = [requireAuth, requireRole('admin', 'librarian')] as const;

schoolYearsRouter.get('/', ...adminOnly, listYearsController);
schoolYearsRouter.post('/', ...adminOnly, createYearController);
schoolYearsRouter.patch('/:id', ...adminOnly, updateYearController);
schoolYearsRouter.post('/:id/activate', ...adminOnly, activateYearController);
schoolYearsRouter.delete('/:id', ...adminOnly, deleteYearController);
