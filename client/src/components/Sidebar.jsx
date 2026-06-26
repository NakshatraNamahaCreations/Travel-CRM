import { useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, LogOut, Palmtree, Plane, CalendarCheck, Wallet, Briefcase, User as UserIcon, Settings, ShieldCheck, Building2,
} from 'lucide-react';
import { useAuth } from '../store/AuthContext.jsx';
import { cn } from '../lib/cn.js';

const GROUPS = [
  {
    label: 'Trips', icon: Plane, items: [
      { label: 'Trips', to: '/trips' },
      { label: 'Sales Reports', to: '/sales-reports' },
      { label: 'Trip Plan Requests', to: '/trip-plan-requests' },
    ],
  },
  {
    label: 'Bookings', icon: CalendarCheck, items: [
      { label: 'Hotel Bookings', to: '/bookings/hotels' },
      { label: 'Hotel Check-In/Outs', to: '/bookings/hotel-checkins' },
      { label: 'Operational Bookings', to: '/bookings/operational' },
      { label: 'Quote Bookings Diff', to: '/bookings/quote-diff' },
    ],
  },
  {
    label: 'Accounting', icon: Wallet, roles: ['admin', 'manager', 'accounts'], items: [
      { label: 'Incoming Payments', to: '/accounting/payments' },
      { label: 'Outgoing Payments', to: '/accounting/ledger' },
      { label: 'Trip Check In/Out Report', to: '/accounting/trip-check-in-out' },
      { label: 'Accounts', to: '/accounting/accounts' },
      { label: 'Transactions', to: '/accounting/transactions' },
    ],
  },
  {
    label: 'Services', icon: Briefcase, roles: ['admin', 'manager', 'operations'], items: [
      { label: 'Hotels', to: '/services/hotels' },
      { label: 'Hotel Prices', to: '/services/hotel-prices' },
      { label: 'Transport', to: '/services/transport' },
      { label: 'Transport Prices', to: '/services/transport-prices' },
      { label: 'Travel Activities', to: '/services/activities' },
      { label: 'Travel Activity Prices', to: '/services/activity-prices' },
    ],
  },
];

export default function Sidebar() {
  const { user, hasRole, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const visible = GROUPS.filter((g) => !g.roles || hasRole(...g.roles));
  const matchGroup = (g) => g.items.some((i) => pathname.startsWith(i.to.split('?')[0]));
  const activeGroup = visible.find(matchGroup)?.label;
  const [open, setOpen] = useState(activeGroup ? { [activeGroup]: true } : {});
  const toggle = (label) => setOpen((o) => ({ ...o, [label]: !o[label] }));

  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-gradient-to-b from-[#11367a] via-[#0e2c63] to-[#0a224d] text-white shadow-[4px_0_24px_-12px_rgba(8,20,48,.7)]">
      {/* Brand */}
      <Link to="/" className="flex items-center gap-2.5 px-4 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand-600 shadow-glow"><Palmtree size={18} /></span>
        <span className="leading-tight">
          <span className="block text-[13px] font-bold tracking-tight text-white">Andaman TravelCare</span>
          <span className="block text-[10px] font-medium uppercase tracking-[.12em] text-brand-100/70">Trip CRM</span>
        </span>
      </Link>

      <div className="mx-4 mb-1 h-px bg-white/10" />
      <p className="px-5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[.14em] text-brand-100/50">Menu</p>

      {/* Nav groups */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-1">
        {visible.map((g) => {
          const isOpen = !!open[g.label];
          const isActiveGroup = matchGroup(g);
          return (
            <div key={g.label}>
              <button
                onClick={() => toggle(g.label)}
                className={cn(
                  'group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors',
                  isActiveGroup && !isOpen ? 'bg-white/10 text-white' : 'text-brand-50 hover:bg-white/10'
                )}
              >
                <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition-colors', isActiveGroup ? 'bg-white/15 text-white' : 'bg-white/5 text-brand-100 group-hover:bg-white/10')}>
                  <g.icon size={15} />
                </span>
                <span className="flex-1 text-left">{g.label}</span>
                {isOpen ? <ChevronDown size={14} className="text-brand-100/70" /> : <ChevronRight size={14} className="text-brand-100/50" />}
              </button>
              {isOpen && (
                <div className="mb-1 mt-0.5 space-y-0.5 pl-[42px] pr-1">
                  {g.items.map((it) => (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      end={it.to === '/trips'}
                      className={({ isActive }) => cn(
                        'relative block rounded-lg px-3 py-1.5 text-[12.5px] transition-colors',
                        isActive
                          ? 'bg-white/15 font-semibold text-white before:absolute before:left-0 before:top-1/2 before:h-4 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-white'
                          : 'text-brand-100/75 hover:bg-white/8 hover:text-white'
                      )}
                    >
                      {it.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Profile */}
      <div className="p-3">
        <Menu user={user} hasRole={hasRole} onLogout={handleLogout} />
      </div>
    </aside>
  );
}

function Menu({ user, hasRole, onLogout }) {
  const [open, setOpen] = useState(false);
  const items = [
    { label: 'My Profile', to: '/settings/profile', icon: Settings },
    ...(hasRole('admin', 'manager') ? [{ label: 'Admin Panel', to: '/admin', icon: ShieldCheck }] : []),
    { label: 'Organization', to: '/settings/organization', icon: Building2 },
  ];
  return (
    <div className="relative">
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-xl border border-slate-100 bg-white py-1 text-slate-700 shadow-2xl">
          {items.map((it) => (
            <Link key={it.to} to={it.to} onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50">
              <it.icon size={15} className="text-slate-400" /> {it.label}
            </Link>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <button onClick={onLogout} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"><LogOut size={15} /> Logout</button>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 transition-colors hover:bg-white/10">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-brand-600"><UserIcon size={16} /></span>
        <span className="min-w-0 flex-1 text-left leading-tight">
          <span className="block truncate text-[13px] font-semibold text-white">{user?.name}</span>
          <span className="block text-[10px] uppercase tracking-[.1em] text-brand-100/70">{user?.role}</span>
        </span>
        <ChevronDown size={14} className={cn('text-brand-100/70 transition-transform', open && 'rotate-180')} />
      </button>
    </div>
  );
}
