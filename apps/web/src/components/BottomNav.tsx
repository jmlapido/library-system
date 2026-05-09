import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/search', icon: '🔍', label: 'Search' },
  { to: '/my-books', icon: '📖', label: 'My Books' },
  { to: '/scan', icon: '📷', label: 'Scan' },
  { to: '/account', icon: '👤', label: 'Account' },
] as const;

/** Bottom navigation bar rendered on all authenticated pages. */
export function BottomNav() {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: '#3730a3',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        zIndex: 100,
      }}
    >
      {tabs.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '8px 0 12px',
            textDecoration: 'none',
            color: isActive ? 'white' : 'rgba(255,255,255,0.5)',
            fontSize: 10,
            gap: 2,
          })}
        >
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
