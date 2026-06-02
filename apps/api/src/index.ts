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

export const app = new Hono();

app.use('*', logger());

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

app.notFound((c) => c.json({ success: false, error: 'Not found', code: 'NOT_FOUND' }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ success: false, error: err.message, code: 'HTTP_ERROR' }, err.status);
  }
  console.error({ name: err.name, message: err.message, path: c.req.path });
  return c.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
});
