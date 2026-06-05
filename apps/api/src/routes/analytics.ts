import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getDashboardController,
  getAdminStatsController,
  getOverdueReportController,
  getPopularBooksController,
  getActivityReportController,
  getInventoryAuditController,
} from '../controllers/analytics.controller.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

export const analyticsRouter = new Hono<{ Variables: Variables }>();

const staffGuard = [requireAuth, requireRole('librarian', 'library_assistant', 'admin')] as const;

analyticsRouter.get('/analytics/dashboard', ...staffGuard, getDashboardController);
analyticsRouter.get('/admin/stats', ...staffGuard, getAdminStatsController);
analyticsRouter.get('/admin/reports/overdue', ...staffGuard, getOverdueReportController);
analyticsRouter.get('/admin/reports/popular', ...staffGuard, getPopularBooksController);
analyticsRouter.get('/admin/reports/activity', ...staffGuard, getActivityReportController);
analyticsRouter.get('/admin/inventory/audit', ...staffGuard, getInventoryAuditController);
