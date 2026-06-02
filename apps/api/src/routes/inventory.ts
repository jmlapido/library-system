import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  handleAudit,
  handleMissingBooks,
  handleUpdateCondition,
} from '../controllers/inventory.controller.js';

export const inventoryRouter = new Hono();

const librarianPlus = [requireAuth, requireRole('librarian', 'admin')] as const;

/**
 * POST /api/v1/inventory/audit
 * Shelf audit: compare scanned barcodes to expected on-shelf copies.
 */
inventoryRouter.post('/audit', ...librarianPlus, handleAudit);

/**
 * GET /api/v1/inventory/missing
 * Missing books report: available copies with no activity in 90+ days.
 */
inventoryRouter.get('/missing', ...librarianPlus, handleMissingBooks);

/**
 * PATCH /api/v1/inventory/copies/:copyId/condition
 * Update the physical condition of a specific book copy.
 */
inventoryRouter.patch('/copies/:copyId/condition', ...librarianPlus, handleUpdateCondition);
