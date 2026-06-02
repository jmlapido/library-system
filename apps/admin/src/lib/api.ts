import { useAuthStore } from '../stores/auth';

const BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

/** Structured error thrown for non-2xx API responses. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let refreshPromise: Promise<string> | null = null;

/** Attempts a silent token refresh, coalescing concurrent calls. */
async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const { refreshToken, setAccessToken, logout } = useAuthStore.getState();
    if (!refreshToken) {
      logout();
      throw new ApiError(401, 'NO_REFRESH_TOKEN', 'Not authenticated');
    }
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      logout();
      throw new ApiError(401, 'REFRESH_FAILED', 'Session expired');
    }
    const json = (await res.json()) as { data: { accessToken: string } };
    setAccessToken(json.data.accessToken);
    return json.data.accessToken;
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/**
 * Core fetch wrapper — attaches auth header, handles 401 refresh retry,
 * and unwraps the standard { success, data, error, code } envelope.
 */
async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    headers['Authorization'] = `Bearer ${newToken}`;
    return request<T>(path, { ...init, headers }, false);
  }

  // 204 No Content or empty body — return empty object
  const contentType = res.headers.get('content-type');
  const hasBody = res.status !== 204 && contentType?.includes('application/json');

  if (!hasBody) {
    if (!res.ok) throw new ApiError(res.status, 'REQUEST_FAILED', 'Request failed');
    return undefined as T;
  }

  const json = (await res.json()) as {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
  };

  if (!res.ok || !json.success) {
    throw new ApiError(res.status, json.code ?? 'UNKNOWN', json.error ?? 'Request failed');
  }
  return json.data as T;
}

/**
 * POST /api/v1/{path} with multipart FormData (file upload).
 * Does NOT set Content-Type — browser sets it with the correct boundary.
 */
async function uploadFile<T>(path: string, formData: FormData, retry = true): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {};
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE}${path}`, { method: 'POST', body: formData, headers });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    headers['Authorization'] = `Bearer ${newToken}`;
    return uploadFile<T>(path, formData, false);
  }

  const json = (await res.json()) as {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
  };

  if (!res.ok || !json.success) {
    throw new ApiError(res.status, json.code ?? 'UNKNOWN', json.error ?? 'Request failed');
  }
  return json.data as T;
}

/** Typed HTTP helpers for all admin API calls. */
export const api = {
  /** GET /api/v1/{path} */
  get: <T>(path: string) => request<T>(path),
  /** POST /api/v1/{path} with JSON body */
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  /** PATCH /api/v1/{path} with JSON body */
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  /** DELETE /api/v1/{path} */
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  /** POST /api/v1/{path} with multipart FormData */
  upload: <T>(path: string, formData: FormData) => uploadFile<T>(path, formData),
};
