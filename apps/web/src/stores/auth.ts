import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** User data stored in auth session. */
interface AuthUser {
  id: string;
  name: string;
  role: string;
  studentId: string | null;
  gradeLevel: string | null;
  interests: string[];
}

/** Tokens + user returned from login / refresh. */
interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  /** Returns true when an access token is present. */
  isAuthenticated: () => boolean;
  /** Stores all session data after successful login. */
  setSession: (session: AuthSession) => void;
  /** Updates only the access token (used after silent refresh). */
  setAccessToken: (token: string) => void;
  /** Updates the interests list after onboarding completes. */
  setInterests: (interests: string[]) => void;
  /** Clears all session data. */
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
      setInterests: (interests) =>
        set((s) => ({ user: s.user ? { ...s.user, interests } : s.user })),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'librams-auth' }
  )
);
