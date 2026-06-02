import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth.js';
import { staffAuthRouter, staffAdminRouter } from './routes/staff.js';
import { catalogRouter } from './routes/catalog.js';
import { circulationRouter } from './routes/circulation.js';
import { notificationsRouter } from './routes/notifications.js';
import { printingRouter } from './routes/printing.js';
import { readingListsRouter } from './routes/readingLists.js';
import { bookClubsRouter } from './routes/bookClubs.js';
import { recommendationsRouter } from './routes/recommendations.js';
import { pushRouter } from './routes/push.js';
import { badgesRouter } from './routes/badges.js';
import { challengesRouter } from './routes/challenges.js';
import { analyticsRouter } from './routes/analytics.js';
import { importRouter } from './routes/import.js';
import { schoolsRouter } from './routes/schools.js';
import { oauthRouter } from './routes/oauth.js';
import { ldapRouter } from './routes/ldap.js';
import { webhooksRouter } from './routes/webhooks.js';
import { superAdminRouter } from './routes/superAdmin.js';
import { finesRouter } from './routes/fines.js';
import { inventoryRouter } from './routes/inventory.js';
import { schoolYearsRouter } from './routes/schoolYears.js';
import { classSectionsRouter } from './routes/classSections.js';
import { startWebhookWorker } from './workers/webhook.worker.js';
import { startHoldExpiryWorker } from './workers/holdExpiry.worker.js';
import { registry } from './lib/metrics.js';
import { metricsMiddleware } from './middleware/metrics.js';

export const app = new Hono();

app.use('*', logger());
app.use('/api/*', metricsMiddleware);

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(
  '/api/*',
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

app.get('/health', (c) =>
  c.json({ status: 'ok', timestamp: new Date().toISOString() })
);

/** Prometheus scrape endpoint — no auth required (firewall in production). */
app.get('/metrics', async (c) => {
  const metrics = await registry.metrics();
  return c.text(metrics, 200, { 'Content-Type': registry.contentType });
});

app.route('/api/v1/auth', authRouter);
app.route('/api/v1/auth', staffAuthRouter);
app.route('/api/v1/admin/staff', staffAdminRouter);
app.route('/api/v1/catalog', catalogRouter);
app.route('/api/v1/circulation', circulationRouter);
app.route('/api/v1', notificationsRouter);
app.route('/api/v1', printingRouter);
app.route('/api/v1/reading-lists', readingListsRouter);
app.route('/api/v1/book-clubs', bookClubsRouter);
app.route('/api/v1/recommendations', recommendationsRouter);
app.route('/api/v1/push', pushRouter);
app.route('/api/v1/badges', badgesRouter);
app.route('/api/v1/challenges', challengesRouter);
app.route('/api/v1', analyticsRouter);
app.route('/api/v1', importRouter);
app.route('/api/v1', schoolsRouter);
app.route('/api/v1/auth', oauthRouter);
app.route('/api/v1/auth', ldapRouter);
app.route('/api/v1/webhooks', webhooksRouter);
app.route('/api/v1/super-admin', superAdminRouter);
app.route('/api/v1/fines', finesRouter);
app.route('/api/v1/inventory', inventoryRouter);
app.route('/api/v1/school-years', schoolYearsRouter);
app.route('/api/v1/class-sections', classSectionsRouter);

app.notFound((c) => c.json({ success: false, error: 'Not found', code: 'NOT_FOUND' }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ success: false, error: err.message, code: 'HTTP_ERROR' }, err.status);
  }
  console.error({ name: err.name, message: err.message, path: c.req.path });
  return c.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
});

if (process.env.NODE_ENV !== 'test') {
  startWebhookWorker();
  startHoldExpiryWorker();
}
