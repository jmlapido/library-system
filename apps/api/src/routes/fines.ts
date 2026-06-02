import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listFines, waiveFine, markFinePaid, type FineStatus } from '../services/fines.service.js';
import { AppError } from '../utils/errors.js';

export const finesRouter = new Hono();

const staffOnly = [requireAuth, requireRole('librarian', 'admin', 'library_assistant')] as const;

const StatusSchema = z.enum(['outstanding', 'paid', 'waived', 'all']).default('outstanding');

const WaiveBodySchema = z.object({
  reason: z.string().max(500).optional(),
});

/**
 * GET /api/v1/fines — list fines for the school filtered by status.
 */
finesRouter.get('/', ...staffOnly, async (c) => {
  const schoolId = c.get('user').schoolId;
  if (!schoolId) return c.json({ success: false, error: 'School context required', code: 'NO_SCHOOL' }, 403);

  const rawStatus = c.req.query('status') ?? 'outstanding';
  const parsed = StatusSchema.safeParse(rawStatus);
  if (!parsed.success) {
    return c.json({ success: false, error: 'Invalid status value', code: 'INVALID_STATUS' }, 400);
  }

  const fines = await listFines(schoolId, parsed.data as FineStatus);
  return c.json({ success: true, data: fines });
});

/**
 * POST /api/v1/fines/:checkoutId/waive — waive a fine.
 */
finesRouter.post('/:checkoutId/waive', ...staffOnly, async (c) => {
  const { checkoutId } = c.req.param();
  const actor = c.get('user');

  const body = await c.req.json().catch(() => ({}));
  const parsed = WaiveBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'VALIDATION_ERROR' }, 400);
  }

  try {
    const result = await waiveFine(checkoutId, actor.sub);
    return c.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'CHECKOUT_NOT_FOUND' ? 404 : 422;
      return c.json({ success: false, error: err.message, code: err.code }, status);
    }
    throw err;
  }
});

/**
 * POST /api/v1/fines/:checkoutId/mark-paid — mark fine as paid.
 */
finesRouter.post('/:checkoutId/mark-paid', ...staffOnly, async (c) => {
  const { checkoutId } = c.req.param();

  try {
    const result = await markFinePaid(checkoutId);
    return c.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'CHECKOUT_NOT_FOUND' ? 404 : 422;
      return c.json({ success: false, error: err.message, code: err.code }, status);
    }
    throw err;
  }
});
