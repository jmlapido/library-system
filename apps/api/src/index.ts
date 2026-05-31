import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { authRouter } from './routes/auth.js';
import { staffAuthRouter, staffAdminRouter } from './routes/staff.js';
import { catalogRouter } from './routes/catalog.js';
import { circulationRouter } from './routes/circulation.js';

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

app.notFound((c) => c.json({ success: false, error: 'Not found', code: 'NOT_FOUND' }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ success: false, error: err.message, code: 'HTTP_ERROR' }, err.status);
  }
  console.error({ name: err.name, message: err.message, path: c.req.path });
  return c.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
});
