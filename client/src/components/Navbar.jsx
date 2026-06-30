import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  Home,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Settings,
  Building2,
  LayoutDashboard,
  ListChecks,
  Sparkles,
  Palmtree,
} from 'lucide-react';
import { useAuth } from '../store/AuthContext.jsx';
import { cn } from '../lib/cn.js';

const TRIPS_MENU = [
  { label: 'Trips', to: '/trips' },
  { label: 'Sales Reports', to: '/sales-reports' },
  { label: 'Trip Plan Requests', to: '/trip-plan-requests' },
];

const BOOKINGS_MENU = [
  { label: 'Hotel Bookings', to: '/bookings/hotels' },
  { label: 'Hotel Check-In/Outs', to: '/bookings/hotel-checkins' },
  { label: 'Operational Bookings', to: '/bookings/operational' },
  { label: 'Quote Bookings Diff', to: '/bookings/quote-diff' },
];

const ACCOUNTING_MENU = [
  { label: 'Incoming Payments', to: '/accounting/payments' },
  { label: 'Outgoing Payments', to: '/accounting/ledger' },
  { label: 'Trip Check In/Out Report', to: '/accounting/trip-check-in-out' },
  { divider: true },
  { label: 'Accounts', to: '/accounting/accounts' },
  { label: 'Transactions', to: '/accounting/transactions' },
];

const SERVICES_MENU = [
  { label: 'Hotels', to: '/services/hotels' },
  { label: 'Hotel Prices', to: '/services/hotel-prices' },
  { divider: true },
  { label: 'Transport', to: '/services/transport' },
  { label: 'Transport Prices', to: '/services/transport-prices' },
  { divider: true },
  { label: 'Travel Activities', to: '/services/activities' },
  { label: 'Travel Activity Prices', to: '/services/activity-prices' },
];

function useOutsideClose(ref, onClose) {
  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ref, onClose]);
}

function Dropdown({ label, items, align = 'left', trigger }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClose(ref, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      {trigger ? (
        <button onClick={() => setOpen((o) => !o)}>{trigger}</button>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-brand-50 transition-colors hover:text-white"
        >
          {label}
          <ChevronDown size={14} className={cn('transition', open && 'rotate-180')} />
        </button>
      )}
      {open && (
        <div
          className={cn(
            'absolute top-full z-50 mt-1.5 w-56 origin-top animate-scale-in overflow-hidden rounded-xl border border-slate-100 bg-white py-1.5 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0'
          )}
        >
          {items.map((item, i) =>
            item.divider ? (
              <div key={`d${i}`} className="my-1 border-t border-slate-100" />
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'block px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50',
                    isActive && 'bg-brand-50 font-medium text-brand-700'
                  )
                }
              >
                {item.label}
              </NavLink>
            )
          )}
        </div>
      )}
    </div>
  );
}

function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useOutsideClose(ref, () => setOpen(false));

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const items = [
    { label: 'My Profile', to: '/settings/profile', icon: Settings },
    { label: 'Organization', to: '/settings/organization', icon: Building2 },
    { divider: true },
    { label: 'Dashboard', to: '/', icon: LayoutDashboard },
    { label: 'All Tasks', to: '/tasks', icon: ListChecks },
    { label: 'Notifications', to: '/notifications', icon: Bell },
    { label: "What's New", to: '/whats-new', icon: Sparkles },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-gray-200 hover:bg-gray-600"
        title={user?.name}
      >
        <UserIcon size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-60 origin-top-right animate-scale-in overflow-hidden rounded-xl border border-slate-100 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
            <span className="pill-brand mt-1.5 uppercase">{user?.role}</span>
          </div>
          {items.map((item, i) =>
            item.divider ? (
              <div key={`d${i}`} className="my-1 border-t border-slate-100" />
            ) : (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                <item.icon size={15} className="text-slate-400" /> {item.label}
              </Link>
            )
          )}
          <div className="my-1 border-t border-slate-100" />
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      )}
    </div>
  );
}

function GlobalSearch() {
  const [term, setTerm] = useState('');
  const navigate = useNavigate();
  const submit = (e) => {
    e.preventDefault();
    if (!term.trim()) return;
    navigate(`/trips?status=all&q=${encodeURIComponent(term.trim())}`);
  };
  return (
    <form onSubmit={submit} className="mx-auto hidden w-full max-w-xl items-center md:flex">
      <div className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/20 px-3.5 py-2.5 backdrop-blur transition focus-within:bg-white/30 focus-within:ring-2 focus-within:ring-white/50">
        <Search size={16} className="text-brand-100" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search trips by id, guest, phone…"
          className="w-full bg-transparent text-sm text-white placeholder-brand-100/90 outline-none"
        />
      </div>
    </form>
  );
}

export default function Navbar() {
  const { hasRole } = useAuth();
  const showAccounting = hasRole('admin', 'manager', 'accounts');
  const showServices = hasRole('admin', 'manager', 'operations');

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ocean text-white shadow-[0_4px_20px_-8px_rgba(8,36,32,.6)]">
      <div className="flex h-[58px] items-center gap-5 px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-600 shadow-glow">
            <Palmtree size={20} />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[15px] font-bold tracking-tight text-white">Andaman TravelCare</span>
            <span className="block text-xs font-medium uppercase tracking-wide text-brand-100/80">Trip CRM</span>
          </span>
        </Link>

        <nav className="flex items-center">
          <Dropdown label="Trips" items={TRIPS_MENU} />
          <Dropdown label="Bookings" items={BOOKINGS_MENU} />
          {showAccounting && <Dropdown label="Accounting" items={ACCOUNTING_MENU} />}
        </nav>

        <GlobalSearch />

        <div className="ml-auto flex items-center gap-3">
          {showServices && (
            <Dropdown
              label="Services"
              items={SERVICES_MENU}
              align="right"
              trigger={
                <span className="flex items-center gap-1 text-sm text-gray-200 hover:text-white">
                  Services <ChevronDown size={14} />
                </span>
              }
            />
          )}
          <button className="text-brand-100 transition hover:text-white" title="Notifications">
            <Bell size={18} />
          </button>
          <Link to="/" className="text-brand-100 transition hover:text-white" title="Home">
            <Home size={18} />
          </Link>
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
