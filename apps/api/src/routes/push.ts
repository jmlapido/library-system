import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { registerDevice, unregisterDevice } from '../controllers/push.controller.js';
import type { AccessTokenPayload } from '../lib/jwt.js';

type Variables = { user: AccessTokenPayload };

export const pushRouter = new Hono<{ Variables: Variables }>();

pushRouter.post('/subscribe', requireAuth, registerDevice);
pushRouter.delete('/subscribe', requireAuth, unregisterDevice);
