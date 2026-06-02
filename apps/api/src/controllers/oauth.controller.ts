import type { Context } from 'hono';
import { getOAuthRedirectUrl, handleOAuthCallback, type OAuthProvider } from '../services/oauth.service.js';
import { AppError } from '../utils/errors.js';
import { db } from '../db/index.js';
import { schools } from '../db/schema/index.js';

const PROVIDERS: ReadonlySet<string> = new Set(['google', 'microsoft']);
const ADMIN_FRONTEND_URL = process.env.ADMIN_URL ?? 'http://localhost:5174';

function getBaseApiUrl(c: Context): string {
  return process.env.API_BASE_URL ?? `${c.req.raw.url.split('/api/')[0]}`;
}

/** GET /auth/oauth/:provider?schoolId=xxx — redirect to provider */
export async function oauthInitController(c: Context) {
  const provider = c.req.param('provider') as string;
  if (!PROVIDERS.has(provider)) {
    return c.json({ success: false, error: 'Unknown provider', code: 'INVALID_PROVIDER' }, 400);
  }

  let schoolId = c.req.query('schoolId');
  if (!schoolId) {
    const [school] = await db.select({ id: schools.id }).from(schools).limit(1);
    if (!school) {
      return c.json({ success: false, error: 'No school configured', code: 'SCHOOL_NOT_FOUND' }, 400);
    }
    schoolId = school.id;
  }

  try {
    const url = await getOAuthRedirectUrl(provider as OAuthProvider, schoolId, getBaseApiUrl(c));
    return c.redirect(url);
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ success: false, error: err.message, code: err.code }, 400);
    }
    throw err;
  }
}

/** GET /auth/oauth/:provider/callback?code=xxx&state=xxx — finish login */
export async function oauthCallbackController(c: Context) {
  const provider = c.req.param('provider') as string;
  if (!PROVIDERS.has(provider)) {
    return c.redirect(`${ADMIN_FRONTEND_URL}/auth/oauth-callback?error=INVALID_PROVIDER`);
  }

  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.redirect(`${ADMIN_FRONTEND_URL}/auth/oauth-callback?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return c.redirect(`${ADMIN_FRONTEND_URL}/auth/oauth-callback?error=MISSING_PARAMS`);
  }

  try {
    const session = await handleOAuthCallback(provider as OAuthProvider, code, state, getBaseApiUrl(c));
    const userJson = encodeURIComponent(JSON.stringify(session.user));
    const fragment =
      `access_token=${encodeURIComponent(session.accessToken)}` +
      `&refresh_token=${encodeURIComponent(session.refreshToken)}` +
      `&user=${userJson}`;
    return c.redirect(`${ADMIN_FRONTEND_URL}/auth/oauth-callback#${fragment}`);
  } catch (err) {
    const code = err instanceof AppError ? err.code : 'OAUTH_ERROR';
    return c.redirect(`${ADMIN_FRONTEND_URL}/auth/oauth-callback?error=${code}`);
  }
}
