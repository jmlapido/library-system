import type { Context } from 'hono';
import { z } from 'zod';
import {
  runShelfAudit,
  getMissingBooks,
  updateCopyCondition,
} from '../services/inventory.service.js';
import { AppError } from '../utils/errors.js';

const AuditBodySchema = z.object({
  scannedBarcodes: z.array(z.string().min(1)).min(0),
});

const ConditionBodySchema = z.object({
  condition: z.enum(['excellent', 'good', 'fair', 'poor']),
});

/**
 * POST /api/v1/inventory/audit
 * Run a shelf audit comparing scanned barcodes to expected on-shelf copies.
 */
export async function handleAudit(c: Context): Promise<Response> {
  const schoolId = c.get('user').schoolId;
  if (!schoolId) {
    return c.json({ success: false, error: 'School context required', code: 'NO_SCHOOL' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = AuditBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'VALIDATION_ERROR' },
      400,
    );
  }

  try {
    const result = await runShelfAudit(schoolId, parsed.data.scannedBarcodes);
    return c.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ success: false, error: err.message, code: err.code }, 422);
    }
    throw err;
  }
}

/**
 * GET /api/v1/inventory/missing
 * Return copies with status 'available' whose updatedAt is older than 90 days.
 */
export async function handleMissingBooks(c: Context): Promise<Response> {
  const schoolId = c.get('user').schoolId;
  if (!schoolId) {
    return c.json({ success: false, error: 'School context required', code: 'NO_SCHOOL' }, 403);
  }

  try {
    const data = await getMissingBooks(schoolId);
    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ success: false, error: err.message, code: err.code }, 422);
    }
    throw err;
  }
}

/**
 * PATCH /api/v1/inventory/copies/:copyId/condition
 * Update the physical condition of a book copy.
 */
export async function handleUpdateCondition(c: Context): Promise<Response> {
  const { copyId } = c.req.param();
  const schoolId = c.get('user').schoolId;
  if (!schoolId) {
    return c.json({ success: false, error: 'School context required', code: 'NO_SCHOOL' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = ConditionBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid body', code: 'VALIDATION_ERROR' },
      400,
    );
  }

  try {
    const result = await updateCopyCondition(copyId, schoolId, parsed.data.condition);
    return c.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'COPY_NOT_FOUND' ? 404 : 422;
      return c.json({ success: false, error: err.message, code: err.code }, status);
    }
    throw err;
  }
}
