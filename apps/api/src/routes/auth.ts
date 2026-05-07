import { Hono } from 'hono';
import { rateLimitAuth } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { loginController, refreshController, logoutController, meController } from '../controllers/auth.controller.js';

export const authRouter = new Hono();

authRouter.post('/login', rateLimitAuth(), loginController);
authRouter.post('/refresh', refreshController);
authRouter.post('/logout', logoutController);
authRouter.get('/me', requireAuth, meController);
