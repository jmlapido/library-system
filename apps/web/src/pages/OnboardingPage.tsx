import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';

const INTERESTS = [
  { id: 'space',    label: 'Space & Science', emoji: '🚀' },
  { id: 'animals',  label: 'Animals',          emoji: '🐾' },
  { id: 'mystery',  label: 'Mystery',           emoji: '🔍' },
  { id: 'adventure',label: 'Adventure',         emoji: '⛰️' },
  { id: 'filipino', label: 'Filipino History',  emoji: '🇵🇭' },
  { id: 'sports',   label: 'Sports',            emoji: '⚽' },
  { id: 'fantasy',  label: 'Fantasy',           emoji: '🧙' },
  { id: 'nature',   label: 'Nature',            emoji: '🌿' },
  { id: 'funny',    label: 'Funny & Comics',    emoji: '😂' },
  { id: 'true',     label: 'True Stories',      emoji: '📰' },
  { id: 'history',  label: 'History',           emoji: '🏛️' },
  { id: 'arts',     label: 'Arts & Music',      emoji: '🎨' },
];

/**
 * First-login interest selection screen for students.
 * Sets users.interests via PATCH /auth/me/interests, then redirects to /search.
 */
export function OnboardingPage() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const setInterests = useAuthStore((s) => s.setInterests);
  const navigate = useNavigate();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    const interestList = Array.from(selected);
    try {
      await api.patch('/auth/me/interests', { interests: interestList });
      setInterests(interestList);
      navigate('/search', { replace: true });
    } catch {
      setSaving(false);
    }
  }

  function handleSkip() {
    setInterests(['__skipped__']);
    navigate('/search', { replace: true });
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '40px 20px 80px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: 500 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📖</div>
          <h1 style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>
            {t('onboarding.title')}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, margin: 0 }}>
            {t('onboarding.subtitle')}
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 32,
        }}>
          {INTERESTS.map((item, i) => {
            const active = selected.has(item.id);
            return (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => toggle(item.id)}
                style={{
                  background: active ? 'white' : 'rgba(255,255,255,0.15)',
                  border: active ? '2px solid white' : '2px solid rgba(255,255,255,0.2)',
                  borderRadius: 14,
                  padding: '16px 8px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: 28 }}>{item.emoji}</span>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: active ? '#4f46e5' : 'rgba(255,255,255,0.9)',
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}>
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>

        <button
          onClick={handleSave}
          disabled={saving || selected.size === 0}
          style={{
            width: '100%',
            background: selected.size > 0 ? 'white' : 'rgba(255,255,255,0.3)',
            color: selected.size > 0 ? '#4f46e5' : 'rgba(255,255,255,0.5)',
            border: 'none',
            borderRadius: 12,
            padding: '16px',
            fontSize: 16,
            fontWeight: 700,
            cursor: selected.size > 0 && !saving ? 'pointer' : 'not-allowed',
            marginBottom: 12,
            transition: 'all 0.15s ease',
          }}
        >
          {saving ? t('onboarding.saving') : selected.size > 0 ? t('onboarding.continueWith', { count: selected.size }) : t('onboarding.continue')}
        </button>

        <button
          onClick={handleSkip}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 13,
            cursor: 'pointer',
            padding: '8px',
          }}
        >
          {t('onboarding.skip')}
        </button>
      </motion.div>
    </div>
  );
}
