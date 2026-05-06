import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';

export const app = new Hono();

app.use('*', logger());

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173'];

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

app.notFound((c) => c.json({ success: false, error: 'Not found', code: 'NOT_FOUND' }, 404));

app.onError((err, c) => {
  console.error({ name: err.name, message: err.message, path: c.req.path });
  return c.json({ success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' }, 500);
});
