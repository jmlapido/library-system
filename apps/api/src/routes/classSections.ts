import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  listSectionsController,
  getSectionController,
  createSectionController,
  updateSectionController,
  deleteSectionController,
  addTeacherController,
  removeTeacherController,
  addStudentController,
  removeStudentController,
} from '../controllers/classSections.controller.js';

export const classSectionsRouter = new Hono();

const staffOnly = [requireAuth, requireRole('admin', 'librarian', 'teacher')] as const;
const adminOnly = [requireAuth, requireRole('admin', 'librarian')] as const;

classSectionsRouter.get('/', ...staffOnly, listSectionsController);
classSectionsRouter.get('/:id', ...staffOnly, getSectionController);
classSectionsRouter.post('/', ...adminOnly, createSectionController);
classSectionsRouter.patch('/:id', ...adminOnly, updateSectionController);
classSectionsRouter.delete('/:id', ...adminOnly, deleteSectionController);

classSectionsRouter.post('/:id/teachers', ...adminOnly, addTeacherController);
classSectionsRouter.delete('/:id/teachers/:userId', ...adminOnly, removeTeacherController);
classSectionsRouter.post('/:id/students', ...adminOnly, addStudentController);
classSectionsRouter.delete('/:id/students/:userId', ...adminOnly, removeStudentController);
