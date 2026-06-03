import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

interface LoginResponse {
  success: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
    user: { id: string; name: string; role: string; studentId: string | null; gradeLevel: string | null; interests: string[] };
  };
  error?: string;
}

/**
 * Kiosk login page — student ID + PIN entry optimised for a touchscreen terminal.
 * On success, redirects to /kiosk/checkout so the student can scan a book.
 */
export function KioskLoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const [studentId, setStudentId] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId.trim() || !pin.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: studentId.trim(), pin: pin.trim() }),
      });
      const json: LoginResponse = await res.json();
      if (json.success && json.data) {
        setSession(json.data);
        navigate('/kiosk/checkout', { replace: true });
      } else {
        setError(json.error ?? 'Invalid student ID or PIN.');
      }
    } catch {
      setError('Could not connect to the server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        gap: 32,
      }}
    >
      <button
        onClick={() => navigate('/kiosk/home')}
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          background: 'rgba(255,255,255,0.1)',
          border: 'none',
          borderRadius: 12,
          color: '#fff',
          fontSize: 20,
          cursor: 'pointer',
          padding: '10px 16px',
          minHeight: 60,
          minWidth: 60,
        }}
        aria-label="Back"
      >
        ←
      </button>

      <div style={{ fontSize: 56 }}>🔐</div>
      <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900 }}>Student Login</h1>
      <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 18, textAlign: 'center' }}>
        Enter your student ID and PIN to check out books
      </p>

      <form
        onSubmit={handleLogin}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          width: '100%',
          maxWidth: 460,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="kiosk-student-id" style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)' }}>
            Student ID
          </label>
          <input
            id="kiosk-student-id"
            type="text"
            inputMode="numeric"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="e.g. 20240001"
            autoComplete="off"
            style={{
              height: 70,
              background: 'rgba(255,255,255,0.1)',
              border: '2px solid rgba(255,255,255,0.2)',
              borderRadius: 14,
              padding: '0 24px',
              fontSize: 22,
              color: '#fff',
              outline: 'none',
              letterSpacing: '0.05em',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label htmlFor="kiosk-pin" style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)' }}>
            PIN
          </label>
          <input
            id="kiosk-pin"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="4-digit PIN"
            maxLength={8}
            autoComplete="off"
            style={{
              height: 70,
              background: 'rgba(255,255,255,0.1)',
              border: '2px solid rgba(255,255,255,0.2)',
              borderRadius: 14,
              padding: '0 24px',
              fontSize: 22,
              color: '#fff',
              outline: 'none',
              letterSpacing: '0.3em',
            }}
          />
        </div>

        {error && (
          <div
            role="alert"
            style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 12,
              padding: '14px 20px',
              color: '#fca5a5',
              fontSize: 16,
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !studentId.trim() || !pin.trim()}
          style={{
            background: loading ? 'rgba(245,158,11,0.5)' : '#f59e0b',
            color: '#0f172a',
            border: 'none',
            borderRadius: 14,
            height: 70,
            fontSize: 20,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: 8,
          }}
        >
          {loading ? 'Logging in…' : 'Log In'}
        </button>
      </form>

      <button
        onClick={() => navigate('/kiosk/home')}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.4)',
          fontSize: 16,
          cursor: 'pointer',
          padding: '12px 24px',
          minHeight: 60,
        }}
      >
        Continue as Guest
      </button>
    </div>
  );
}
