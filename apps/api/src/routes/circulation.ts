import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  checkoutController, returnController, advanceStageController,
  renewController, placeHoldController, cancelHoldController,
  myCheckoutsController, myHoldsController, shelvingQueueController,
  expireHoldController,
} from '../controllers/circulation.controller.js';

export const circulationRouter = new Hono();

const staffOnly = [requireAuth, requireRole('librarian', 'admin', 'library_assistant')] as const;

// Any authenticated user can checkout (student self-checkout or staff on behalf)
circulationRouter.post('/checkout', requireAuth, checkoutController);

// Return processing — staff only
circulationRouter.post('/return', ...staffOnly, returnController);
circulationRouter.post('/return/advance', ...staffOnly, advanceStageController);

// Renewal — any authenticated user (service enforces ownership for students)
circulationRouter.post('/renew', requireAuth, renewController);

// Holds — any authenticated user
circulationRouter.post('/holds', requireAuth, placeHoldController);
circulationRouter.delete('/holds/:holdId', requireAuth, cancelHoldController);

// Student self-service
circulationRouter.get('/my/checkouts', requireAuth, myCheckoutsController);
circulationRouter.get('/my/holds', requireAuth, myHoldsController);

// Staff shelving queue
circulationRouter.get('/shelving-queue', ...staffOnly, shelvingQueueController);

// Manual hold expiry — staff only
circulationRouter.delete('/holds/:id/expire', ...staffOnly, expireHoldController);
