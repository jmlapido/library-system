import { serve } from '@hono/node-server';
import { app } from './index.js';
import { startNotificationScheduler } from './services/notifications/notifications.scheduler.js';

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port }, () => {
  console.log(`LibraMS API running on http://localhost:${port}`);
});

if (process.env.NODE_ENV !== 'test') {
  startNotificationScheduler();
}
