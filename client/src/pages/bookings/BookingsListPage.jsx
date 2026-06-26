import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Phone } from 'lucide-react';
import { format } from 'date-fns';
import { bookingsApi } from '../../api/bookings.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import ServiceShell from '../../components/services/ServiceShell.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { money } from '../../lib/pricing.js';
import { cn } from '../../lib/cn.js';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'on_trip', label: 'On Trip' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];
const BADGE = {
  confirmed: 'bg-blue-50 text-blue-700', on_trip: 'bg-purple-50 text-purple-700',
  completed: 'bg-green-50 text-green-700', cancelled: 'bg-red-50 text-red-700',
};

export default function BookingsListPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'all';
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', status, debounced],
    queryFn: () => bookingsApi.list({ status, search: debounced, limit: 50 }),
  });

  const columns = [
    { key: 'id', header: 'Booking', render: (b) => <Link to={`/bookings/${b._id}`} className="font-semibold text-brand-600 hover:underline">#{b.bookingNumber}</Link> },
    { key: 'guest', header: 'Guest', render: (b) => (
      <div>
        <div className="font-medium text-gray-900">{[b.guest?.salutation, b.guest?.name].filter(Boolean).join(' ') || '—'}</div>
        {b.guest?.phones?.[0] && <div className="flex items-center gap-1 text-xs text-gray-400"><Phone size={10} /> +{b.guest.phones[0].countryCode} {b.guest.phones[0].number}</div>}
      </div>
    ) },
    { key: 'trip', header: 'Trip', render: (b) => (
      <span className="text-gray-600">{(b.destinations || []).map((d) => d.name).join(', ')} <span className="text-gray-400">• {b.nights}N{b.startDate ? ` • ${format(new Date(b.startDate), 'd MMM')}` : ''}</span></span>
    ) },
    { key: 'amount', header: 'Amount', render: (b) => <span className="font-medium">{money(b.totalAmount, b.currency)}</span> },
    { key: 'balance', header: 'Balance Due', render: (b) => <span className={cn(b.balanceDue > 0 ? 'text-red-600' : 'text-green-600')}>{money(b.balanceDue, b.currency)}</span> },
    { key: 'status', header: 'Status', render: (b) => <span className={cn('rounded px-2 py-0.5 text-xs font-medium', BADGE[b.status])}>{TABS.find((t) => t.value === b.status)?.label}</span> },
  ];

  return (
    <div>
      <div className="flex gap-1 border-b border-gray-200 bg-white px-6 pt-3">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => setParams({ status: t.value })}
            className={cn('px-4 py-2 text-sm font-medium', status === t.value ? 'border-b-2 border-brand-600 text-brand-700' : 'text-gray-500 hover:text-gray-800')}>
            {t.label}{t.value === status && data?.meta?.total != null ? ` (${data.meta.total})` : ''}
          </button>
        ))}
      </div>
      <ServiceShell title="Bookings" search={search} onSearch={setSearch} total={data?.meta?.total}>
        <DataTable columns={columns} rows={data?.data || []} loading={isLoading} emptyLabel="No bookings yet. Accept a quote and convert it to a booking." />
      </ServiceShell>
    </div>
  );
}
