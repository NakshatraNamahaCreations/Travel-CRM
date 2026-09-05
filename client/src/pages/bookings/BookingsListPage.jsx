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
import FilterDrawer, { countFilters } from '../../components/ui/FilterDrawer.jsx';

const EMPTY_FILTERS = { createdAfter: '', createdBefore: '', startAfter: '', startBefore: '' };
const FILTER_FIELDS = [
  { fromKey: 'createdAfter', toKey: 'createdBefore', label: 'Booked Between', type: 'dateRange' },
  { fromKey: 'startAfter', toKey: 'startBefore', label: 'Trip Start Between', type: 'dateRange' },
];
const filterParams = (f) => Object.fromEntries(Object.entries(f).filter(([, v]) => v));

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

// "Andaman and Nicobar Islands" -> "ANI" for the compact card heading.
const abbrev = (name) => String(name || '')
  .split(/\s+/)
  .filter((w) => w && !/^(and|&|of|the)$/i.test(w))
  .map((w) => w[0].toUpperCase())
  .join('');

// Sembark-style mobile card: guest • destination code, id/source line,
// amount • date • days • pax, then balance + status.
function MobileBookingCard({ b }) {
  const guestName = [b.guest?.salutation, b.guest?.name].filter(Boolean).join(' ') || 'Guest';
  const destCode = (b.destinations || []).map((d) => abbrev(d.name)).filter(Boolean).join('/');
  const adults = b.pax?.adults || 0;
  const kids = (b.pax?.children || []).length;
  return (
    <div className="card p-3.5">
      <Link to={`/bookings/${b._id}`} className="block text-[15.5px] font-bold text-gray-900">
        {guestName}{destCode ? <span className="font-bold"> • {destCode}</span> : null}
      </Link>
      <p className="mt-0.5 text-[12px] text-gray-500">
        # {b.bookingNumber}{b.query?.source?.name ? ` • ${b.query.source.name}` : ''}
      </p>
      <p className="mt-0.5 text-[12.5px] font-semibold text-gray-800">
        <span className="text-[9.5px] font-bold uppercase text-gray-400">INR </span>
        {Math.round(b.totalAmount || 0).toLocaleString('en-IN')}
        {b.startDate ? ` • ${format(new Date(b.startDate), 'd MMM, yyyy')}` : ''}
        {b.nights ? ` • ${b.nights + 1}D` : ''}
        {adults ? ` • ${adults}A${kids ? ` ${kids}C` : ''}` : ''}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2.5">
        <span className={cn('text-[12.5px] font-semibold', b.balanceDue > 0 ? 'text-red-600' : 'text-green-600')}>
          {b.balanceDue > 0 ? `Balance Due ${money(b.balanceDue, b.currency)}` : 'Fully Paid'}
        </span>
        <span className={cn('rounded px-2 py-0.5 text-xs font-medium', BADGE[b.status])}>
          {TABS.find((t) => t.value === b.status)?.label || b.status}
        </span>
      </div>
    </div>
  );
}

export default function BookingsListPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'all';
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const debounced = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['bookings', status, debounced, filters],
    queryFn: () => bookingsApi.list({ status, search: debounced, limit: 50, ...filterParams(filters) }),
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
      <div className="flex gap-1 no-scrollbar overflow-x-auto border-b border-gray-200 bg-white px-4 pt-3 sm:px-6">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => setParams({ status: t.value })}
            className={cn('shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium', status === t.value ? 'border-b-2 border-brand-600 font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-800')}>
            {t.label}{t.value === status && data?.meta?.total != null ? ` (${data.meta.total})` : ''}
          </button>
        ))}
      </div>
      <ServiceShell title="Bookings" search={search} onSearch={setSearch} total={data?.meta?.total}
        onFilterClick={() => setShowFilters(true)} filterCount={countFilters(filters)}>
        {/* Mobile — Sembark-style cards; desktop keeps the table */}
        <div className="md:hidden">
          {isLoading ? (
            <div className="py-16 text-center text-gray-400">Loading…</div>
          ) : (data?.data || []).length === 0 ? (
            <div className="py-16 text-center text-gray-400">No bookings yet. Accept a quote and convert it to a booking.</div>
          ) : (
            <div className="space-y-3">
              {(data?.data || []).map((b) => <MobileBookingCard key={b._id} b={b} />)}
            </div>
          )}
        </div>
        <div className="hidden md:block">
          <DataTable columns={columns} rows={data?.data || []} loading={isLoading} emptyLabel="No bookings yet. Accept a quote and convert it to a booking." />
        </div>
        <FilterDrawer open={showFilters} onClose={() => setShowFilters(false)} fields={FILTER_FIELDS} initial={filters} empty={EMPTY_FILTERS} onApply={setFilters} />
      </ServiceShell>
    </div>
  );
}
