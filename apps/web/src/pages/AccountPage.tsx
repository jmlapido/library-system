import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { i18n } from '../i18n/index';
import { usePushNotifications } from '../hooks/usePushNotifications';

/** Account page with user profile, language toggle, push notification toggle, and sign out. */
export function AccountPage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const currentLang = i18n.language;
  const { isSupported, isSubscribed, isLoading, error, subscribe, unsubscribe } = usePushNotifications();

  function handleLogout() { logout(); navigate('/login', { replace: true }); }

  function toggleLanguage() {
    const next = currentLang === 'en' ? 'tl' : 'en';
    void i18n.changeLanguage(next);
    localStorage.setItem('librams-lang', next);
  }

  function handlePushToggle() {
    if (isSubscribed) {
      void unsubscribe();
    } else {
      void subscribe();
    }
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
        {isSupported && (
          <PushNotificationRow
            isSubscribed={isSubscribed}
            isLoading={isLoading}
            onToggle={handlePushToggle}
          />
        )}
      </div>
      {error && (
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8,
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
          color: '#fca5a5', fontSize: 13 }}>
          {error}
        </div>
      )}
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

function PushNotificationRow({ isSubscribed, isLoading, onToggle }: {
  isSubscribed: boolean;
  isLoading: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)',
      borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>Push Notifications</div>
        <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>
          Due date reminders and hold alerts
        </div>
      </div>
      <button
        onClick={onToggle}
        disabled={isLoading}
        style={{
          padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer',
          border: 'none',
          background: isSubscribed ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.15)',
          color: isSubscribed ? '#86efac' : 'rgba(255,255,255,0.7)',
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        {isLoading ? '...' : isSubscribed ? 'Disable' : 'Enable'}
      </button>
    </div>
  );
}
