import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { usePermission } from '../hooks/usePermission';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Separator } from './ui/separator';

const NAV_ITEMS = [
  { label: 'Circulation Desk', to: '/circulation', roles: ['library_assistant', 'librarian', 'admin'] },
  { label: 'Shelving Queue', to: '/shelving-queue', roles: ['library_assistant', 'librarian', 'admin'] },
  { label: 'Catalog', to: '/catalog', roles: ['librarian', 'admin'], permission: 'catalog.view' },
  { label: 'Staff Management', to: '/staff-management', roles: ['librarian', 'admin'] },
  { label: 'Students', to: '/students', roles: ['librarian', 'admin'], permission: 'students.view' },
  { label: 'Audit Log', to: '/audit-log', roles: ['admin'] },
] as const;

export function AppShell() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const canViewCatalog = usePermission('catalog.view');
  const canViewStudents = usePermission('students.view');

  function isVisible(item: (typeof NAV_ITEMS)[number]) {
    if (!user) return false;
    const roleOk = (item.roles as readonly string[]).includes(user.role);
    if (roleOk) return true;
    if ('permission' in item && item.permission === 'catalog.view') return canViewCatalog;
    if ('permission' in item && item.permission === 'students.view') return canViewStudents;
    return false;
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r bg-card flex flex-col shrink-0">
        <div className="p-4">
          <h1 className="text-lg font-bold">LibraMS Admin</h1>
        </div>
        <Separator />
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.filter(isVisible).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Separator />
        <div className="p-4 space-y-2">
          <p className="text-sm font-medium truncate">{user?.fullName}</p>
          <Badge variant="secondary" className="capitalize">
            {user?.role?.replace('_', ' ')}
          </Badge>
          <Button variant="outline" size="sm" className="w-full" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
