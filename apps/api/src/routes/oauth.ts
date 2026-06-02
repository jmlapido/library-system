import { Hono } from 'hono';
import { oauthInitController, oauthCallbackController } from '../controllers/oauth.controller.js';

export const oauthRouter = new Hono();

oauthRouter.get('/oauth/:provider', oauthInitController);
oauthRouter.get('/oauth/:provider/callback', oauthCallbackController);
