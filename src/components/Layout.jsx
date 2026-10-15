import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';

const MANAGER_NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/indents', label: 'Indents' },
  { to: '/import', label: 'Import' },
  { to: '/users', label: 'Users' },
  { to: '/audit', label: 'Audit log' },
];
const EMPLOYEE_NAV = [
  { to: '/', label: 'My indents', end: true },
  { to: '/performance', label: 'My performance' },
];

function Count({ n }) {
  if (!n) return null;
  return <span className="ml-auto rounded-full bg-amber-400 px-2 text-xs font-semibold text-ink">{n}</span>;
}

export default function Layout({ children }) {
  const { profile, logout } = useAuth();
  const { unread, error, isManager } = useData();
  const nav = isManager ? MANAGER_NAV : EMPLOYEE_NAV;
  const side = ({ isActive }) =>
    `flex items-center rounded-md px-3 py-2 text-sm ${isActive ? 'bg-white/10 font-medium text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`;
  const top = ({ isActive }) =>
    `whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-white/15 font-medium text-white' : 'text-slate-300'}`;

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 hidden w-60 flex-col bg-ink md:flex">
        <div className="px-5 pb-8 pt-6">
          <div className="text-lg font-semibold leading-tight text-white">Indent Tracker</div>
          <div className="mt-1 text-xs text-slate-400">Purchase indent receiving</div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={side}>{n.label}</NavLink>
          ))}
          <NavLink to="/alerts" className={side}>Alerts <Count n={unread} /></NavLink>
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-sm">
          <div className="text-white">{profile.name}</div>
          <div className="text-xs text-slate-400">
            {isManager ? 'Manager' : 'Employee'}{profile.department ? `, ${profile.department}` : ''}
          </div>
          <button onClick={logout} className="mt-3 text-slate-300 hover:text-white hover:underline">Sign out</button>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-30 bg-ink md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="font-semibold text-white">Indent Tracker</span>
            <button onClick={logout} className="text-sm text-slate-300">Sign out</button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={top}>{n.label}</NavLink>
            ))}
            <NavLink to="/alerts" className={top}>Alerts{unread ? ` (${unread})` : ''}</NavLink>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-8">
          {error && <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
          {children}
        </main>
      </div>
    </div>
  );
}
