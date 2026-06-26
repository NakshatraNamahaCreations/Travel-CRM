import { Link } from 'react-router-dom';
import { Users, Building2, UploadCloud, Hotel, Bus, Ticket, BarChart3, ArrowRight } from 'lucide-react';
import { useAuth } from '../../store/AuthContext.jsx';

const CARDS = [
  { to: '/services/import', label: 'Import / Upload Excel', desc: 'Upload hotel, transport & activity rate sheets', icon: UploadCloud, tint: 'bg-brand-50 text-brand-600', highlight: true },
  { to: '/settings/users', label: 'Users & Roles', desc: 'Add staff, set roles, enable/disable accounts', icon: Users, tint: 'bg-blue-50 text-blue-600' },
  { to: '/settings/organization', label: 'Sales Teams', desc: 'Manage sales teams in your organization', icon: Building2, tint: 'bg-purple-50 text-purple-600' },
  { to: '/services/hotels', label: 'Hotels', desc: 'Hotel master & rate cards', icon: Hotel, tint: 'bg-emerald-50 text-emerald-600' },
  { to: '/services/transport', label: 'Transport', desc: 'Routes & vehicle pricing', icon: Bus, tint: 'bg-amber-50 text-amber-600' },
  { to: '/services/activities', label: 'Activities', desc: 'Ferries & activity tickets', icon: Ticket, tint: 'bg-cyan-50 text-cyan-600' },
  { to: '/sales-reports', label: 'Sales Reports', desc: 'Revenue, conversion & MIS', icon: BarChart3, tint: 'bg-rose-50 text-rose-600' },
];

export default function AdminPage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="relative mb-7 overflow-hidden rounded-2xl bg-ocean p-6 text-white shadow-soft">
        <h1 className="text-2xl font-extrabold tracking-tight">Admin Panel</h1>
        <p className="mt-1 text-sm text-brand-100/90">Manage inventory uploads, users, teams and master data · {user?.role}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map(({ to, label, desc, icon: Icon, tint, highlight }) => (
          <Link key={to} to={to}
            className={`card group p-5 transition hover:-translate-y-0.5 hover:shadow-md ${highlight ? 'ring-2 ring-brand-200' : ''}`}>
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}><Icon size={20} /></div>
            <h3 className="mt-3 flex items-center gap-1 font-semibold text-gray-900">{label} <ArrowRight size={14} className="opacity-0 transition group-hover:opacity-100" /></h3>
            <p className="text-sm text-slate-500">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
