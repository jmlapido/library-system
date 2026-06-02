import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, type AdminUser } from '../../stores/auth';

const ERROR_LABELS: Record<string, string> = {
  INVALID_PROVIDER: 'Unknown SSO provider.',
  MISSING_PARAMS: 'Incomplete OAuth response. Please try again.',
  USER_NOT_FOUND: 'No staff account found for your email. Contact your administrator.',
  ACCOUNT_INACTIVE: 'Your account has been deactivated.',
  APPROVAL_PENDING: 'Your account is awaiting admin approval.',
  FORBIDDEN: 'Students cannot use SSO login.',
  SSO_NOT_CONFIGURED: 'SSO is not configured for this school.',
  OAUTH_STATE_EXPIRED: 'Login session expired. Please try again.',
  access_denied: 'You cancelled the sign-in.',
};

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check query string for errors first
    const params = new URLSearchParams(window.location.search);
    const qError = params.get('error');
    if (qError) {
      setError(ERROR_LABELS[qError] ?? `SSO error: ${qError}`);
      return;
    }

    // Parse tokens from fragment
    const hash = window.location.hash.slice(1);
    const fragment = new URLSearchParams(hash);
    const accessToken = fragment.get('access_token');
    const refreshToken = fragment.get('refresh_token');
    const userJson = fragment.get('user');

    if (!accessToken || !refreshToken || !userJson) {
      setError('Invalid SSO response. Please try again.');
      return;
    }

    let user: AdminUser;
    try {
      user = JSON.parse(decodeURIComponent(userJson)) as AdminUser;
    } catch {
      setError('Failed to parse SSO response. Please try again.');
      return;
    }

    setSession({ accessToken, refreshToken, user });
    navigate(user.role === 'admin' ? '/staff-management' : '/circulation', { replace: true });
  }, [navigate, setSession]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-muted/40 p-8">
        <p className="text-destructive text-sm max-w-sm text-center" role="alert">
          {error}
        </p>
        <a
          href="/login"
          className="text-sm text-primary underline underline-offset-4"
        >
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <p className="text-muted-foreground text-sm">Completing sign in…</p>
    </div>
  );
}
