import { NavLink, Outlet } from 'react-router-dom';
import { Building2, CreditCard, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../store/AuthContext.jsx';

const linkCls = ({ isActive }) =>
  `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
  }`;

// Minimal chrome for the platform-owner panel — deliberately separate from the
// tenant AppLayout/TopNav so owner and tenant UIs can't blend together.
export default function OwnerLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="bg-slate-900">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
          <div className="flex items-center gap-2 text-white">
            <ShieldCheck size={20} className="text-brand-400" />
            <span className="text-sm font-bold">Travel CRM — Owner</span>
          </div>
          <nav className="flex items-center gap-1">
            <NavLink to="/owner/companies" className={linkCls}>
              <Building2 size={15} /> Companies
            </NavLink>
            <NavLink to="/owner/plans" className={linkCls}>
              <CreditCard size={15} /> Plans
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-white/60 sm:block">{user?.email}</span>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
