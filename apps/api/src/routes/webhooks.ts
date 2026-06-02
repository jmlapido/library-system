import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  listWebhooksController,
  createWebhookController,
  deleteWebhookController,
  toggleWebhookController,
} from '../controllers/webhooks.controller.js';

export const webhooksRouter = new Hono();

webhooksRouter.use('*', requireAuth);
webhooksRouter.use('*', requireRole('admin'));

webhooksRouter.get('/', listWebhooksController);
webhooksRouter.post('/', createWebhookController);
webhooksRouter.delete('/:id', deleteWebhookController);
webhooksRouter.patch('/:id/toggle', toggleWebhookController);
