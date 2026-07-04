import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { format } from 'date-fns';
import { bookingsApi } from '../../api/bookings.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import ServiceShell from '../../components/services/ServiceShell.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { money } from '../../lib/pricing.js';
import { cn } from '../../lib/cn.js';
import FilterDrawer, { countFilters } from '../../components/ui/FilterDrawer.jsx';

const EMPTY_FILTERS = { payment: '', createdAfter: '', createdBefore: '' };
const FILTER_FIELDS = [
  { key: 'payment', label: 'Payment Status', type: 'select', options: [
    { value: 'paid', label: 'Paid' },
    { value: 'partial', label: 'Partially Paid' },
  ] },
  { fromKey: 'createdAfter', toKey: 'createdBefore', label: 'Invoice Date Between', type: 'dateRange' },
];

// Proforma invoices are derived from bookings (one invoice per booking).
export default function InvoicesPage() {
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const debounced = useDebounced(search);
  const { data, isLoading } = useQuery({
    queryKey: ['invoices', debounced, filters.createdAfter, filters.createdBefore],
    queryFn: () => bookingsApi.list({
      search: debounced, status: 'all', limit: 50,
      ...(filters.createdAfter ? { createdAfter: filters.createdAfter } : {}),
      ...(filters.createdBefore ? { createdBefore: filters.createdBefore } : {}),
    }),
  });

  // Paid/partial is derived per row, so that filter is applied client-side.
  const rows = (data?.data || []).filter((b) => {
    if (filters.payment === 'paid') return !(b.balanceDue > 0);
    if (filters.payment === 'partial') return b.balanceDue > 0;
    return true;
  });

  const invNo = (b) => `INV-${b.bookingNumber}`;
  const columns = [
    { key: 'inv', header: 'Invoice', render: (b) => <Link to={`/accounting/invoices/${b._id}`} className="flex items-center gap-1 font-semibold text-brand-600 hover:underline"><FileText size={14} /> {invNo(b)}</Link> },
    { key: 'guest', header: 'Billed To', render: (b) => <span className="font-medium text-gray-900">{[b.guest?.salutation, b.guest?.name].filter(Boolean).join(' ')}</span> },
    { key: 'date', header: 'Date', render: (b) => format(new Date(b.createdAt), 'd MMM yyyy') },
    { key: 'total', header: 'Total', render: (b) => money(b.totalAmount, b.currency) },
    { key: 'paid', header: 'Paid', render: (b) => <span className="text-green-700">{money(b.paidAmount, b.currency)}</span> },
    { key: 'balance', header: 'Balance', render: (b) => <span className={cn(b.balanceDue > 0 ? 'text-red-600' : 'text-green-600')}>{money(b.balanceDue, b.currency)}</span> },
    { key: 'status', header: 'Status', render: (b) => <span className={cn('rounded px-2 py-0.5 text-xs font-medium', b.balanceDue > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700')}>{b.balanceDue > 0 ? 'Partially Paid' : 'Paid'}</span> },
  ];

  return (
    <ServiceShell title="Invoices (Proforma)" search={search} onSearch={setSearch} total={filters.payment ? rows.length : data?.meta?.total}
      onFilterClick={() => setShowFilters(true)} filterCount={countFilters(filters)}>
      <DataTable columns={columns} rows={rows} loading={isLoading} emptyLabel="No invoices yet — create a booking first." />
      <FilterDrawer open={showFilters} onClose={() => setShowFilters(false)} fields={FILTER_FIELDS} initial={filters} empty={EMPTY_FILTERS} onApply={setFilters} />
    </ServiceShell>
  );
}
