import { useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronDown, LogOut, Palmtree, Settings, Search, Bell, X, Menu, Home,
  User as UserIcon, ClipboardList, LayoutDashboard, Plane, CalendarCheck, Wallet, Briefcase,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../store/AuthContext.jsx';
import { notificationsApi } from '../api/notifications.js';
import { cn } from '../lib/cn.js';

const GROUPS = [
  {
    label: 'Trips', icon: Plane, side: 'left', items: [
      { label: 'Trips', to: '/trips' },
      { label: 'Sales Reports', to: '/sales-reports' },
      { label: 'Trip Plan Requests', to: '/trip-plan-requests' },
    ],
  },
  {
    label: 'Bookings', icon: CalendarCheck, side: 'left', items: [
      { label: 'All Bookings', to: '/bookings' },
      { label: 'Hotel Bookings', to: '/bookings/hotels' },
      { label: 'Hotel Check-In/Outs', to: '/bookings/hotel-checkins' },
      { label: 'Operational Bookings', to: '/bookings/operational' },
      { label: 'Quote Bookings Diff', to: '/bookings/quote-diff' },
    ],
  },
  {
    label: 'Accounting', icon: Wallet, side: 'left', roles: ['admin', 'manager', 'accounts'], items: [
      { label: 'Incoming Payments', to: '/accounting/payments' },
      { label: 'Outgoing Payments', to: '/accounting/ledger' },
      { label: 'Invoices', to: '/accounting/invoices' },
      { label: 'Trip Check In/Out Report', to: '/accounting/trip-check-in-out' },
      { label: 'Accounts', to: '/accounting/accounts' },
      { label: 'Transactions', to: '/accounting/transactions' },
    ],
  },
  {
    label: 'Services', icon: Briefcase, side: 'right', roles: ['admin', 'manager', 'operations'], items: [
      { label: 'Hotels', to: '/services/hotels' },
      { label: 'Hotel Prices', to: '/services/hotel-prices' },
      { label: 'Transport', to: '/services/transport' },
      { label: 'Transport Prices', to: '/services/transport-prices' },
      { label: 'Travel Activities', to: '/services/activities' },
      { label: 'Travel Activity Prices', to: '/services/activity-prices' },
    ],
  },
  {
    label: 'Settings', icon: Settings, side: 'right', roles: ['admin', 'manager'], items: [
      { label: 'Users & Roles', to: '/settings/users' },
      { label: 'Organization & Teams', to: '/settings/organization' },
      { label: 'Destinations', to: '/settings/destinations' },
      { label: 'Cities / Towns', to: '/settings/cities' },
      { label: 'States / Regions', to: '/settings/states' },
      { label: 'Inclusions & Exclusions', to: '/settings/inclusions-exclusions' },
    ],
  },
];

export default function TopNav() {
  const { user, hasRole, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [openMenu, setOpenMenu] = useState(null); // group label | 'profile' | null
  const [mobileOpen, setMobileOpen] = useState(false);
  const [term, setTerm] = useState('');

  const visible = GROUPS.filter((g) => !g.roles || hasRole(...g.roles));
  const leftGroups = visible.filter((g) => g.side === 'left');
  const rightGroups = visible.filter((g) => g.side === 'right');
  const matchGroup = (g) => g.items.some((i) => pathname.startsWith(i.to.split('?')[0]));
  const closeAll = () => { setOpenMenu(null); setMobileOpen(false); };
  const handleLogout = async () => { closeAll(); await logout(); navigate('/login'); };

  const { data: countData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 30000,
    staleTime: 20000,
  });
  const unreadCount = countData?.count ?? 0;

  const submit = (e) => {
    e.preventDefault();
    if (!term.trim()) return;
    closeAll();
    navigate(`/trips?status=all&q=${encodeURIComponent(term.trim())}`);
  };

  const initials = (user?.name || 'U').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  // Plain-text nav link (Sembark style — no icons, no chevrons on the bar)
  const navBtn = (active) => cn(
    'rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors',
    active ? 'text-white' : 'text-slate-300 hover:text-white'
  );

  const dropdown = (g, align = 'left') => (
    <div className={cn('absolute top-full z-50 mt-1 w-60 overflow-hidden rounded-lg border border-slate-100 bg-white py-1.5 text-slate-700 shadow-2xl', align === 'right' ? 'right-0' : 'left-0')}>
      {g.items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.to === '/trips'}
          onClick={closeAll}
          className={({ isActive }) => cn(
            'block px-4 py-2 text-[12.5px] transition-colors',
            isActive ? 'bg-blue-50 font-semibold text-brand-700' : 'hover:bg-slate-50'
          )}
        >
          {it.label}
        </NavLink>
      ))}
    </div>
  );

  const groupButton = (g, align) => {
    const isOpen = openMenu === g.label;
    return (
      <div key={g.label} className="relative">
        <button onClick={() => setOpenMenu(isOpen ? null : g.label)} className={navBtn(matchGroup(g) || isOpen)}>
          {g.label}
        </button>
        {isOpen && dropdown(g, align)}
      </div>
    );
  };

  return (
    <>
      <style>{`
        .notif-dot { box-shadow: 0 0 0 2px #0a4d88; }
      `}</style>

      <header className="sticky top-0 z-40 text-white" style={{ background: 'linear-gradient(90deg, #06345c 0%, #0a4d88 55%, #0d5fa6 100%)' }}>
        <div className="flex h-[54px] items-center gap-1 px-3 sm:px-5">
          {/* Brand — logo only, like the reference */}
          <Link to="/" onClick={closeAll} title="Andaman TravelCare" className="mr-4 flex shrink-0 items-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 transition hover:bg-white/15">
              <Palmtree size={16} className="text-white" />
            </span>
          </Link>

          {/* Left nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {leftGroups.map((g) => groupButton(g, 'left'))}
            <NavLink to="/tasks" onClick={closeAll} className={({ isActive }) => navBtn(isActive)}>
              Tasks
            </NavLink>
          </nav>

          {/* Search — centered */}
          <form onSubmit={submit} className="mx-auto hidden w-full max-w-xl items-center px-4 md:flex">
            <div className="flex w-full items-center gap-2.5 rounded-lg bg-white/10 px-3.5 py-[8px] ring-1 ring-white/10 transition focus-within:bg-white/15 focus-within:ring-white/25">
              <Search size={14} className="shrink-0 text-slate-400" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search for trips…"
                className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-slate-400"
              />
              {term && (
                <button type="button" onClick={() => setTerm('')} className="shrink-0 text-slate-400 hover:text-white">
                  <X size={12} />
                </button>
              )}
            </div>
          </form>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <nav className="hidden items-center gap-1 lg:flex">
              {rightGroups.map((g) => groupButton(g, 'right'))}
            </nav>

            {/* Notifications */}
            <Link
              to="/notifications"
              onClick={closeAll}
              className="relative ml-1 flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"
              title="Notifications"
            >
              <Bell size={16} />
              {unreadCount > 0 && <span className="notif-dot absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />}
            </Link>

            {/* Home / dashboard */}
            <NavLink
              to="/"
              end
              onClick={closeAll}
              title="Dashboard"
              className={({ isActive }) => cn(
                'hidden h-8 w-8 items-center justify-center rounded-md transition sm:flex',
                isActive ? 'text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              )}
            >
              <Home size={16} />
            </NavLink>

            {/* Profile — icon only */}
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === 'profile' ? null : 'profile')}
                title={user?.name}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <UserIcon size={16} />
              </button>

              {openMenu === 'profile' && (
                <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-slate-100 bg-white py-1 text-slate-700 shadow-2xl">
                  <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 pb-2.5 pt-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white">
                      {initials}
                    </span>
                    <span className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold text-slate-800">{user?.name}</p>
                      <p className="text-[10.5px] capitalize text-slate-400">{user?.role}</p>
                    </span>
                  </div>
                  <Link to="/settings/profile" onClick={closeAll} className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-slate-600 hover:bg-slate-50">
                    <Settings size={13} className="text-slate-400" /> My Profile
                  </Link>
                  <div className="mx-2 my-1 border-t border-slate-100" />
                  <button onClick={handleLogout} className="flex w-full items-center gap-2 px-3 py-2 text-[12.5px] text-red-600 hover:bg-red-50">
                    <LogOut size={13} /> Sign Out
                  </button>
                </div>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => { setMobileOpen((o) => !o); setOpenMenu(null); }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Open menu"
            >
              {mobileOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <nav className="max-h-[70vh] overflow-y-auto border-t border-white/10 px-3 pb-3 pt-2 lg:hidden">
            <form onSubmit={submit} className="mb-2 md:hidden">
              <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-[7px] ring-1 ring-white/10">
                <Search size={13} className="shrink-0 text-slate-400" />
                <input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Search for trips…"
                  className="w-full bg-transparent text-[13px] text-white outline-none placeholder:text-slate-400"
                />
              </div>
            </form>
            <NavLink to="/" end onClick={closeAll} className={({ isActive }) => cn('flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium', isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white')}>
              <LayoutDashboard size={14} /> Dashboard
            </NavLink>
            <NavLink to="/tasks" onClick={closeAll} className={({ isActive }) => cn('flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium', isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white')}>
              <ClipboardList size={14} /> Tasks
            </NavLink>
            {visible.map((g) => (
              <div key={g.label} className="mt-1">
                <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">
                  <g.icon size={11} /> {g.label}
                </p>
                {g.items.map((it) => (
                  <NavLink
                    key={it.to}
                    to={it.to}
                    end={it.to === '/trips'}
                    onClick={closeAll}
                    className={({ isActive }) => cn(
                      'block rounded-md px-4 py-[7px] text-[12.5px] transition-colors',
                      isActive ? 'bg-white/10 font-semibold text-white' : 'text-slate-300 hover:text-white'
                    )}
                  >
                    {it.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        )}
      </header>

      {/* Click-away backdrop for dropdowns */}
      {openMenu && <div className="fixed inset-0 z-30" onClick={() => setOpenMenu(null)} aria-hidden="true" />}
    </>
  );
}
