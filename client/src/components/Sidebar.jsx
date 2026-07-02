import { useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronDown, LogOut, Palmtree, Plane, CalendarCheck, Wallet, Briefcase,
  User as UserIcon, Settings, LayoutDashboard, ClipboardList,
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
      { label: 'All Bookings', to: '/bookings' },
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
      { label: 'Invoices', to: '/accounting/invoices' },
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
  {
    label: 'Settings', icon: Settings, roles: ['admin', 'manager'], items: [
      { label: 'Users & Roles', to: '/settings/users' },
      { label: 'Organization & Teams', to: '/settings/organization' },
      { label: 'Destinations', to: '/settings/destinations' },
      { label: 'Cities / Towns', to: '/settings/cities' },
      { label: 'States / Regions', to: '/settings/states' },
    ],
  },
];

export default function Sidebar({ open: drawerOpen = false, onClose = () => {} }) {
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
    <>
      <style>{`
        @keyframes sidebarGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.08); }
        }
        .orb { animation: sidebarGlow var(--dur,8s) ease-in-out var(--delay,0s) infinite; }
        .nav-item-active {
          background: linear-gradient(135deg, rgba(99,160,255,0.18) 0%, rgba(59,130,246,0.10) 100%);
          box-shadow: inset 0 0 0 1px rgba(147,197,253,0.15);
        }
        .nav-icon-active {
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          box-shadow: 0 4px 12px rgba(59,130,246,0.45);
        }
        .brand-glow {
          box-shadow: 0 0 0 1px rgba(255,255,255,0.2), 0 4px 16px rgba(59,130,246,0.5);
        }
        .profile-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .profile-card:hover {
          background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%);
        }
        .sidebar-divider {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
        }
      `}</style>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-[220px] shrink-0 flex-col overflow-hidden text-white shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:translate-x-0',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{ background: 'linear-gradient(180deg, #0d1f4e 0%, #0a1a42 40%, #071430 100%)' }}
      >
        {/* Background orbs */}
        <div className="orb pointer-events-none absolute -left-8 -top-8 h-40 w-40 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, #3b6fd4 0%, transparent 70%)', '--dur': '9s', '--delay': '0s' }} />
        <div className="orb pointer-events-none absolute -right-6 top-1/3 h-32 w-32 rounded-full blur-2xl" style={{ background: 'radial-gradient(circle, #1e40af 0%, transparent 70%)', '--dur': '12s', '--delay': '2s' }} />
        <div className="orb pointer-events-none absolute bottom-16 left-4 h-24 w-24 rounded-full blur-2xl" style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)', '--dur': '7s', '--delay': '4s' }} />

        {/* Brand */}
        <Link to="/" onClick={onClose} className="relative flex items-center gap-3 px-4 py-4">
          <span className="brand-glow flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-600">
            <Palmtree size={18} className="text-white" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-bold tracking-tight text-white">Andaman TravelCare</span>
            <span className="block text-[9.5px] font-semibold uppercase tracking-[.15em] text-blue-300/60">Trip CRM</span>
          </span>
        </Link>

        <div className="sidebar-divider mx-3 mb-2 h-px" />

        <p className="px-4 pb-1.5 pt-1 text-[9.5px] font-bold uppercase tracking-[.18em] text-blue-300/40">Navigation</p>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-2">
          {/* Dashboard */}
          <NavLink
            to="/"
            end
            onClick={onClose}
            className={({ isActive }) => cn(
              'group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] font-semibold transition-all duration-150',
              isActive ? 'nav-item-active text-white' : 'text-blue-100/70 hover:bg-white/6 hover:text-white'
            )}
          >
            {({ isActive }) => (
              <>
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-150', isActive ? 'nav-icon-active' : 'bg-white/6 group-hover:bg-white/10')}>
                  <LayoutDashboard size={14} />
                </span>
                <span className="flex-1 text-left">Dashboard</span>
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
              </>
            )}
          </NavLink>

          {/* Tasks */}
          <NavLink
            to="/tasks"
            onClick={onClose}
            className={({ isActive }) => cn(
              'group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] font-semibold transition-all duration-150',
              isActive ? 'nav-item-active text-white' : 'text-blue-100/70 hover:bg-white/6 hover:text-white'
            )}
          >
            {({ isActive }) => (
              <>
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-150', isActive ? 'nav-icon-active' : 'bg-white/6 group-hover:bg-white/10')}>
                  <ClipboardList size={14} />
                </span>
                <span className="flex-1 text-left">Tasks</span>
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
              </>
            )}
          </NavLink>

          {/* Groups */}
          {visible.map((g) => {
            const isOpen = !!open[g.label];
            const isActiveGroup = matchGroup(g);
            return (
              <div key={g.label}>
                <button
                  onClick={() => toggle(g.label)}
                  className={cn(
                    'group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] font-semibold transition-all duration-150',
                    isActiveGroup && !isOpen
                      ? 'nav-item-active text-white'
                      : isOpen
                      ? 'text-white'
                      : 'text-blue-100/70 hover:bg-white/6 hover:text-white'
                  )}
                >
                  <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-150', isActiveGroup || isOpen ? 'nav-icon-active' : 'bg-white/6 group-hover:bg-white/10')}>
                    <g.icon size={14} />
                  </span>
                  <span className="flex-1 text-left">{g.label}</span>
                  <span className={cn('transition-transform duration-200', isOpen ? 'rotate-180' : '')}>
                    <ChevronDown size={13} className="text-blue-300/50" />
                  </span>
                </button>

                {isOpen && (
                  <div className="mb-1 mt-0.5 space-y-0.5 pl-[38px] pr-1.5">
                    {g.items.map((it) => (
                      <NavLink
                        key={it.to}
                        to={it.to}
                        end={it.to === '/trips'}
                        onClick={onClose}
                        className={({ isActive }) => cn(
                          'relative block rounded-lg px-3 py-[6px] text-[12px] transition-all duration-150',
                          isActive
                            ? 'bg-gradient-to-r from-blue-500/20 to-blue-400/10 font-semibold text-white before:absolute before:left-0 before:top-1/2 before:h-4 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-blue-400'
                            : 'text-blue-100/55 hover:bg-white/6 hover:text-blue-100'
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

        <div className="sidebar-divider mx-3 mb-2 h-px" />

        {/* Profile */}
        <div className="px-2.5 pb-3">
          <ProfileMenu user={user} onLogout={handleLogout} />
        </div>
      </aside>
    </>
  );
}

function ProfileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const initials = (user?.name || 'U').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="relative">
      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-xl border border-slate-100/80 bg-white py-1 text-slate-700 shadow-2xl">
          <div className="border-b border-slate-100 px-3 pb-2 pt-2">
            <p className="text-[12px] font-semibold text-slate-800">{user?.name}</p>
            <p className="text-[10.5px] capitalize text-slate-400">{user?.role}</p>
          </div>
          <Link
            to="/settings/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-slate-600 hover:bg-slate-50"
          >
            <Settings size={13} className="text-slate-400" /> My Profile
          </Link>
          <div className="my-1 mx-2 border-t border-slate-100" />
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-[12.5px] text-red-600 hover:bg-red-50"
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="profile-card flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all duration-150"
      >
        {/* Avatar with gradient */}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 text-[12px] font-bold text-white shadow-md">
          {initials}
        </span>
        <span className="min-w-0 flex-1 text-left leading-tight">
          <span className="block truncate text-[12.5px] font-semibold text-white">{user?.name}</span>
          <span className="block text-[9.5px] capitalize tracking-wide text-blue-300/60">{user?.role}</span>
        </span>
        <ChevronDown size={13} className={cn('shrink-0 text-blue-300/50 transition-transform duration-200', open && 'rotate-180')} />
      </button>
    </div>
  );
}
