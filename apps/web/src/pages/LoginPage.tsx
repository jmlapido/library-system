import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../lib/api';
import { useAuthStore } from '../stores/auth';

function detectMode(value: string): 'studentId' | 'email' | 'unknown' {
  if (/^\d/.test(value)) return 'studentId';
  if (value.includes('@') || /^[a-zA-Z]/.test(value)) return 'email';
  return 'unknown';
}

export function LoginPage() {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);

  const mode = detectMode(identifier);
  const secretLabel = mode === 'studentId' ? t('login.pin') : t('login.password');
  const secretType = mode === 'studentId' ? 'tel' : 'password';
  const detectionHint =
    mode === 'studentId' ? t('login.detectedStudentId') :
    mode === 'email' ? t('login.detectedEmail') : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; name: string; role: string; studentId: string | null; gradeLevel: string | null; interests: string[] };
      }>('/auth/login', { identifier, secret });
      setSession(data);
      navigate('/search', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? t('login.error') : 'Network error.');
      setShake(true);
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <motion.div
        animate={shake ? { x: [-8, 8, -8, 8, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        style={{ width: '100%', maxWidth: 360 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📚</div>
          <h1 style={{ color: 'white', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{t('login.title')}</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{t('login.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, display: 'block', marginBottom: 4 }}>
              {t('login.identifier')}
              {detectionHint && (
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginLeft: 6 }}>
                  ({detectionHint})
                </span>
              )}
            </label>
            <input
              type="text"
              placeholder="Email or Student ID"
              value={identifier}
              onChange={(e) => { setIdentifier(e.target.value); setSecret(''); }}
              required
              style={inputStyle}
            />
          </div>

          <AnimatePresence mode="wait">
            {identifier.length > 0 && (
              <motion.div
                key={secretLabel}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, display: 'block', marginBottom: 4 }}>
                  {secretLabel}
                </label>
                <input
                  type={secretType}
                  placeholder={secretLabel}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  maxLength={mode === 'studentId' ? 6 : undefined}
                  inputMode={mode === 'studentId' ? 'numeric' : undefined}
                  required
                  style={inputStyle}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <p style={{ color: '#fca5a5', fontSize: 12, textAlign: 'center' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'white',
              color: '#4f46e5',
              border: 'none',
              borderRadius: 10,
              padding: '14px',
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.8 : 1,
              marginTop: 4,
            }}
          >
            {loading ? '...' : t('login.submit')}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.2)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 15,
  color: 'white',
  outline: 'none',
};
