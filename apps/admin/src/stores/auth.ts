import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Admin user profile returned from the API. */
export interface AdminUser {
  id: string;
  fullName: string;
  role: 'librarian' | 'library_assistant' | 'admin';
  schoolId: string;
  effectivePermissions: string[];
}

interface AdminSession {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AdminUser | null;
  /** Returns true when an access token is present. */
  isAuthenticated: () => boolean;
  /** Stores a full session (tokens + user) after successful login. */
  setSession: (session: AdminSession) => void;
  /** Replaces only the access token (used after silent token refresh). */
  setAccessToken: (token: string) => void;
  /** Clears all auth state (logout). */
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: () => get().accessToken !== null,
      setSession: ({ accessToken, refreshToken, user }) =>
        set({ accessToken, refreshToken, user }),
      setAccessToken: (token) => set({ accessToken: token }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'librams-admin-auth' }
  )
);
