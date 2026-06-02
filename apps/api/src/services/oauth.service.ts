import bcrypt from 'bcryptjs';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, refreshTokens, oauthAccounts } from '../db/schema/index.js';
import { schools } from '../db/schema/index.js';
import { signAccessToken, signRefreshToken } from '../lib/jwt.js';
import { getEffectivePermissions } from './permissions.service.js';
import { AppError } from '../utils/errors.js';

export type OAuthProvider = 'google' | 'microsoft';

interface OAuthUserInfo {
  providerUserId: string;
  email: string;
  fullName: string;
}

/** Build the provider-specific authorization URL. */
function buildAuthUrl(
  provider: OAuthProvider,
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'online',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile User.Read',
    state,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
}

/** Exchange authorization code for user info. */
async function fetchUserInfo(
  provider: OAuthProvider,
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<OAuthUserInfo> {
  const tokenUrl =
    provider === 'google'
      ? 'https://oauth2.googleapis.com/token'
      : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new AppError('OAUTH_TOKEN_FAILED', `Token exchange failed: ${text}`);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  if (provider === 'google') {
    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!infoRes.ok) throw new AppError('OAUTH_USERINFO_FAILED', 'Failed to fetch Google user info');
    const info = (await infoRes.json()) as { sub: string; email: string; name: string };
    return { providerUserId: info.sub, email: info.email, fullName: info.name };
  }

  const infoRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!infoRes.ok) throw new AppError('OAUTH_USERINFO_FAILED', 'Failed to fetch Microsoft user info');
  const info = (await infoRes.json()) as {
    id: string;
    mail?: string;
    userPrincipalName?: string;
    displayName: string;
  };
  return {
    providerUserId: info.id,
    email: info.mail ?? info.userPrincipalName ?? '',
    fullName: info.displayName,
  };
}

/** Retrieve provider credentials from school settings. */
async function getProviderConfig(
  provider: OAuthProvider,
  schoolId: string,
): Promise<{ clientId: string; clientSecret: string }> {
  const [school] = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1);
  if (!school) throw new AppError('SCHOOL_NOT_FOUND', 'School not found');

  const s = (school.settings ?? {}) as Record<string, unknown>;
  const clientId =
    provider === 'google' ? String(s.ssoGoogleClientId ?? '') : String(s.ssoMicrosoftClientId ?? '');
  const clientSecret =
    provider === 'google'
      ? String(s.ssoGoogleClientSecret ?? '')
      : String(s.ssoMicrosoftClientSecret ?? '');

  if (!clientId || !clientSecret) {
    throw new AppError('SSO_NOT_CONFIGURED', `${provider} SSO is not configured for this school`);
  }
  return { clientId, clientSecret };
}

/**
 * Build the OAuth redirect URL for a given provider and school.
 * @param provider - 'google' or 'microsoft'
 * @param schoolId - The school whose SSO config to use
 * @param baseApiUrl - Public API base URL (e.g. http://localhost:3000)
 * @returns Absolute provider authorization URL
 */
export async function getOAuthRedirectUrl(
  provider: OAuthProvider,
  schoolId: string,
  baseApiUrl: string,
): Promise<string> {
  const { clientId } = await getProviderConfig(provider, schoolId);
  const state = Buffer.from(JSON.stringify({ provider, schoolId, ts: Date.now() })).toString(
    'base64url',
  );
  const redirectUri = `${baseApiUrl}/api/v1/auth/oauth/${provider}/callback`;
  return buildAuthUrl(provider, clientId, redirectUri, state);
}

/**
 * Handle the OAuth callback: exchange code, link account, issue JWT session.
 * Only staff accounts (not students) may use OAuth.
 * @returns Access token, refresh token, and public user fields
 */
export async function handleOAuthCallback(
  provider: OAuthProvider,
  code: string,
  stateRaw: string,
  baseApiUrl: string,
) {
  let state: { provider: string; schoolId: string; ts: number };
  try {
    state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString()) as typeof state;
  } catch {
    throw new AppError('INVALID_OAUTH_STATE', 'Invalid OAuth state parameter');
  }

  if (state.provider !== provider) {
    throw new AppError('INVALID_OAUTH_STATE', 'Provider mismatch in state');
  }
  if (Date.now() - state.ts > 10 * 60 * 1000) {
    throw new AppError('OAUTH_STATE_EXPIRED', 'OAuth flow expired — please try again');
  }

  const { schoolId } = state;
  const { clientId, clientSecret } = await getProviderConfig(provider, schoolId);
  const redirectUri = `${baseApiUrl}/api/v1/auth/oauth/${provider}/callback`;
  const info = await fetchUserInfo(provider, code, clientId, clientSecret, redirectUri);

  // Resolve user: existing link → by email
  const [linked] = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerUserId, info.providerUserId),
      ),
    )
    .limit(1);

  let userId = linked?.userId;

  if (!userId) {
    const [byEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, info.email))
      .limit(1);

    if (!byEmail) {
      throw new AppError(
        'USER_NOT_FOUND',
        'No staff account exists for this email. Contact your administrator.',
      );
    }
    userId = byEmail.id;
    await db.insert(oauthAccounts).values({
      userId,
      provider,
      providerUserId: info.providerUserId,
      email: info.email,
    });
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError('USER_NOT_FOUND', 'User account not found');
  if (!user.isActive) throw new AppError('ACCOUNT_INACTIVE', 'Account is inactive');
  if (user.approvalStatus === 'pending') throw new AppError('APPROVAL_PENDING', 'Account awaiting approval');
  if (user.approvalStatus === 'rejected') throw new AppError('ACCOUNT_INACTIVE', 'Account has been rejected');
  if (user.role === 'student') throw new AppError('FORBIDDEN', 'Students cannot use SSO login');

  const accessToken = signAccessToken({ sub: user.id, role: user.role, schoolId: user.schoolId });
  const rawRefreshToken = signRefreshToken();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: await bcrypt.hash(rawRefreshToken, 10),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  const effectivePermissions = await getEffectivePermissions(user.id, user.role);

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: {
      id: user.id,
      fullName: user.fullName,
      role: user.role,
      schoolId: user.schoolId,
      effectivePermissions,
    },
  };
}
