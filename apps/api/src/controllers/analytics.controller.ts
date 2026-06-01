import type { Context } from 'hono';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import * as analyticsService from '../services/analytics.service.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

// ─── Query param schemas ──────────────────────────────────────────────────────

const PopularQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

const ActivityQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse and validate query params against a Zod schema. Returns parsed data or a 422 Response. */
function parseQuery<T>(c: Context, schema: z.ZodType<T>): T | Response {
  const result = schema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!result.success) {
    return c.json({ success: false, error: result.error.message, code: 'VALIDATION_ERROR' }, 422) as unknown as Response;
  }
  return result.data;
}

/** Map known AppError codes to HTTP status. */
function errorStatus(code: string): 400 | 403 | 404 {
  if (code === 'NOT_FOUND') return 404;
  if (code === 'FORBIDDEN') return 403;
  return 400;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/stats
 * Returns summary dashboard metrics for the authenticated user's school.
 */
export async function getAdminStatsController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  try {
    const data = await analyticsService.getAdminStats(user.schoolId);
    return c.json({ success: true, data, message: 'Dashboard stats retrieved' });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * GET /api/v1/admin/reports/overdue
 * Returns all overdue checkouts with user and book details for the school.
 */
export async function getOverdueReportController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  try {
    const data = await analyticsService.getOverdueReport(user.schoolId);
    return c.json({ success: true, data, message: `${data.length} overdue checkout(s)` });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * GET /api/v1/admin/reports/popular
 * Returns the top N most-borrowed books for the school.
 * Query params: limit (1–100, default 10).
 */
export async function getPopularBooksController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const query = parseQuery(c, PopularQuerySchema);
  if (query instanceof Response) return query;
  try {
    const data = await analyticsService.getPopularBooks(user.schoolId, query.limit);
    return c.json({ success: true, data, message: `Top ${data.length} popular book(s)` });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * GET /api/v1/admin/reports/activity
 * Returns daily checkout and return counts for the last N days.
 * Query params: days (1–365, default 30).
 */
export async function getActivityReportController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  const query = parseQuery(c, ActivityQuerySchema);
  if (query instanceof Response) return query;
  try {
    const data = await analyticsService.getActivityReport(user.schoolId, query.days);
    return c.json({ success: true, data, message: `Activity for last ${query.days} day(s)` });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}

/**
 * GET /api/v1/admin/inventory/audit
 * Returns inventory status breakdown and list of lost copies for the school.
 */
export async function getInventoryAuditController(c: Context<{ Variables: Variables }>) {
  const user = c.get('user');
  try {
    const data = await analyticsService.getInventoryAudit(user.schoolId);
    return c.json({ success: true, data, message: 'Inventory audit retrieved' });
  } catch (err) {
    if (err instanceof AppError) return c.json({ success: false, error: err.message, code: err.code }, errorStatus(err.code));
    throw err;
  }
}
