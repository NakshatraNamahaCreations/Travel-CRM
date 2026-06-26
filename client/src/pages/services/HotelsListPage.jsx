import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, MoreVertical, Layers, Utensils, BedDouble, StickyNote, Wallet, GitMerge } from 'lucide-react';
import { hotelsApi } from '../../api/services.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import ServiceShell from '../../components/services/ServiceShell.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import StarRating from '../../components/ui/StarRating.jsx';

const TOOLS = [
  { label: 'Hotel Groups', to: '/services/hotels/groups', icon: Layers },
  { label: 'Meal Plans', to: '/services/hotels/meal-plans', icon: Utensils },
  { label: 'Room Types', to: '/services/hotels/room-types', icon: BedDouble },
  { label: 'General Hotels Notes', to: '/services/hotels/notes', icon: StickyNote },
  { label: 'Payment Preferences', to: '/services/hotels/payment-preferences', icon: Wallet },
  { divider: true },
  { label: 'Merge Hotels', to: '/services/hotels/merge', icon: GitMerge },
];

function HotelToolsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn-secondary px-2" title="More"><MoreVertical size={16} /></button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {TOOLS.map((t, i) => t.divider ? (
            <div key={`d${i}`} className="my-1 border-t border-slate-100" />
          ) : (
            <Link key={t.to} to={t.to} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <t.icon size={15} className="text-slate-400" /> {t.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HotelsListPage() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['hotels', debounced],
    queryFn: () => hotelsApi.list({ search: debounced, limit: 50 }),
  });

  const rows = data?.data || [];

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (h) => (
        <div>
          <Link to={`/services/hotels/${h._id}`} className="font-semibold text-brand-600 hover:underline">
            {h.name}
          </Link>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            {h.location?.city || '—'} <StarRating value={h.stars} size={11} />
          </div>
        </div>
      ),
    },
    {
      key: 'mealPlans',
      header: 'Meal Plans',
      render: (h) => <span className="text-gray-600">{(h.mealPlans || []).join(' • ') || '—'}</span>,
    },
    {
      key: 'roomTypes',
      header: 'Room Type',
      render: (h) => (
        <div className="text-gray-600">
          {(h.roomTypes || []).slice(0, 2).map((r) => (
            <div key={r.name}>{r.name}</div>
          ))}
          {h.roomTypes?.length > 2 && (
            <span className="text-xs text-brand-600">+{h.roomTypes.length - 2} more</span>
          )}
        </div>
      ),
    },
    {
      key: 'checkInOut',
      header: 'Check-In/Out',
      render: (h) => (
        <span className="text-gray-600">{h.checkIn} hrs - {h.checkOut} hrs</span>
      ),
    },
    {
      key: 'childEb',
      header: 'Child EB Age',
      render: (h) => <span className="text-gray-600">{h.childEbAge?.from}-{h.childEbAge?.to}yo</span>,
    },
    {
      key: 'payment',
      header: 'Payment Preference',
      render: (h) => <span className="text-gray-400">{h.paymentPreference || 'N/A'}</span>,
    },
  ];

  return (
    <ServiceShell
      title="Hotels"
      search={search}
      onSearch={setSearch}
      total={data?.meta?.total}
      onRefresh={() => qc.invalidateQueries({ queryKey: ['hotels'] })}
      actions={
        <>
          <Link to="/services/hotels/new" className="btn-primary">
            <Plus size={16} /> Add New
          </Link>
          <HotelToolsMenu />
        </>
      }
    >
      <DataTable columns={columns} rows={rows} loading={isLoading} emptyLabel="No hotels yet." />
    </ServiceShell>
  );
}
