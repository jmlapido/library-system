import type { Context } from 'hono';
import { AppError } from '../utils/errors.js';
import {
  listWebhooks,
  createWebhook,
  deleteWebhook,
  toggleWebhook,
} from '../services/webhooks.service.js';

/** GET /api/v1/webhooks */
export async function listWebhooksController(c: Context) {
  const { schoolId } = c.get('user') as { schoolId: string };
  const data = await listWebhooks(schoolId);
  return c.json({ success: true, data });
}

/** POST /api/v1/webhooks */
export async function createWebhookController(c: Context) {
  const { schoolId } = c.get('user') as { schoolId: string };
  const body = await c.req.json() as { url?: string; events?: string[]; description?: string };

  if (!body.url || !body.events?.length) {
    return c.json({ success: false, error: 'url and events required', code: 'VALIDATION_ERROR' }, 400);
  }

  try {
    const webhook = await createWebhook(schoolId, {
      url: body.url,
      events: body.events,
      description: body.description,
    });
    return c.json({ success: true, data: webhook, message: 'Webhook created' }, 201);
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ success: false, error: err.message, code: err.code }, 400);
    }
    throw err;
  }
}

/** DELETE /api/v1/webhooks/:id */
export async function deleteWebhookController(c: Context) {
  const { schoolId } = c.get('user') as { schoolId: string };
  const id = c.req.param('id');

  try {
    await deleteWebhook(id, schoolId);
    return c.json({ success: true, message: 'Webhook deleted' });
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'WEBHOOK_NOT_FOUND' ? 404 : 400;
      return c.json({ success: false, error: err.message, code: err.code }, status);
    }
    throw err;
  }
}

/** PATCH /api/v1/webhooks/:id/toggle */
export async function toggleWebhookController(c: Context) {
  const { schoolId } = c.get('user') as { schoolId: string };
  const id = c.req.param('id');
  const body = await c.req.json() as { isActive?: boolean };

  if (typeof body.isActive !== 'boolean') {
    return c.json({ success: false, error: 'isActive (boolean) required', code: 'VALIDATION_ERROR' }, 400);
  }

  try {
    const webhook = await toggleWebhook(id, schoolId, body.isActive);
    return c.json({ success: true, data: webhook });
  } catch (err) {
    if (err instanceof AppError) {
      const status = err.code === 'WEBHOOK_NOT_FOUND' ? 404 : 400;
      return c.json({ success: false, error: err.message, code: err.code }, status);
    }
    throw err;
  }
}
