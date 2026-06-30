import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, Home, Menu, X } from 'lucide-react';
import { useAuth } from '../store/AuthContext.jsx';

/* Map path prefixes → page title shown in header */
const PAGE_TITLES = {
  '/trips': 'Trips',
  '/sales-reports': 'Sales Reports',
  '/trip-plan-requests': 'Trip Plan Requests',
  '/bookings/hotels': 'Hotel Bookings',
  '/bookings/hotel-checkins': 'Hotel Check-In / Outs',
  '/bookings/operational': 'Operational Bookings',
  '/bookings/quote-diff': 'Quote Bookings Diff',
  '/accounting/payments': 'Incoming Payments',
  '/accounting/ledger': 'Outgoing Payments',
  '/accounting/trip-check-in-out': 'Trip Check In/Out Report',
  '/accounting/accounts': 'Accounts',
  '/accounting/transactions': 'Transactions',
  '/services/hotels': 'Hotels',
  '/services/hotel-prices': 'Hotel Prices',
  '/services/transport': 'Transport',
  '/services/transport-prices': 'Transport Prices',
  '/services/activities': 'Travel Activities',
  '/services/activity-prices': 'Activity Prices',
  '/settings/users': 'Users & Roles',
  '/settings/destinations': 'Destinations',
  '/settings/cities': 'Cities / Towns',
  '/settings/states': 'States / Regions',
  '/': 'Dashboard',
};

function usePageTitle() {
  const { pathname } = useLocation();
  const match = Object.entries(PAGE_TITLES)
    .filter(([p]) => pathname === p || (p !== '/' && pathname.startsWith(p)))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return match ? match[1] : 'CRM';
}

const now = new Date();
const DAY   = now.toLocaleDateString('en-IN', { weekday: 'long' });
const DATE  = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function TopBar({ onMenuClick }) {
  const [term, setTerm]       = useState('');
  const [focused, setFocused] = useState(false);
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const pageTitle = usePageTitle();

  const initials = (user?.name || 'U').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const submit = (e) => {
    e.preventDefault();
    if (!term.trim()) return;
    navigate(`/trips?status=all&q=${encodeURIComponent(term.trim())}`);
  };

  return (
    <>
      <style>{`
        .topbar-search:focus-within .search-icon { color: #3b82f6; }
        @keyframes badgePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          50%       { box-shadow: 0 0 0 4px rgba(239,68,68,0); }
        }
        .notif-badge { animation: badgePulse 2s ease-in-out infinite; }
      `}</style>

      <header className="sticky top-0 z-30 flex h-[56px] items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md sm:px-5"
              style={{ boxShadow: '0 1px 0 0 rgba(0,0,0,0.06), 0 2px 12px rgba(0,0,0,0.04)' }}>

        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={17} />
        </button>

        {/* Page title — desktop only */}
        <div className="hidden lg:flex lg:flex-col lg:justify-center lg:min-w-[140px]">
          <span className="text-[15px] font-bold text-slate-800 leading-tight">{pageTitle}</span>
          <span className="text-[10.5px] text-slate-400 leading-tight">{DAY}, {DATE}</span>
        </div>

        {/* Divider */}
        <div className="hidden h-7 w-px bg-slate-200 lg:block" />

        {/* Search */}
        <form onSubmit={submit} className="flex flex-1 items-center">
          <div className={`topbar-search flex w-full max-w-md items-center gap-2 rounded-xl border px-3.5 py-[7px] transition-all duration-200 ${focused ? 'border-blue-400 bg-white ring-3 ring-blue-100 shadow-sm' : 'border-slate-200 bg-slate-50/80 hover:border-slate-300'}`}>
            <Search size={14} className="search-icon shrink-0 text-slate-400 transition-colors duration-200" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Search trips by id, guest, phone…"
              className="w-full bg-transparent text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
            />
            {term && (
              <button type="button" onClick={() => setTerm('')} className="shrink-0 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>
        </form>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-1.5">

          {/* Home */}
          <Link
            to="/"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title="Dashboard"
          >
            <Home size={16} />
          </Link>

          {/* Notifications */}
          <button
            className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title="Notifications"
          >
            <Bell size={16} />
            <span className="notif-badge absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          {/* Divider */}
          <div className="mx-1 h-6 w-px bg-slate-200" />

          {/* User avatar + name */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-1.5 pr-3 transition hover:border-slate-300 hover:bg-white cursor-default select-none">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[10px] font-bold text-white shadow-sm">
              {initials}
            </span>
            <span className="hidden text-[12.5px] font-semibold text-slate-700 sm:block">{user?.name}</span>
          </div>
        </div>

      </header>
    </>
  );
}
