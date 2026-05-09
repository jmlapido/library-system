import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { i18n } from '../i18n/index';

/** Account page with user profile, language toggle, and sign out. */
export function AccountPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const currentLang = i18n.language;

  function handleLogout() { logout(); navigate('/login', { replace: true }); }

  function toggleLanguage() {
    const next = currentLang === 'en' ? 'tl' : 'en';
    void i18n.changeLanguage(next);
    localStorage.setItem('librams-lang', next);
  }

  const initials = user?.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) ?? '?';

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 24, paddingBottom: 32 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 12 }}>
          {initials}
        </div>
        <div style={{ color: 'white', fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{user?.name ?? '—'}</div>
        {user?.studentId && <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>ID: {user.studentId}</div>}
        {user?.gradeLevel && <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13 }}>{user.gradeLevel}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SettingRow label="Language" value={currentLang === 'en' ? 'English' : 'Filipino'} onPress={toggleLanguage} />
      </div>
      <button onClick={handleLogout} style={{ width: '100%', marginTop: 40, padding: 14, borderRadius: 10,
        background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
        color: '#fca5a5', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
        Sign Out
      </button>
    </div>
  );
}

function SettingRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <button onClick={onPress} style={{ width: '100%', background: 'rgba(255,255,255,0.1)', border: 'none',
      borderRadius: 10, padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{label}</span>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{value} ›</span>
    </button>
  );
}
