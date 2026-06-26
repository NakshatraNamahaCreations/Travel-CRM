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

// Proforma invoices are derived from bookings (one invoice per booking).
export default function InvoicesPage() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const { data, isLoading } = useQuery({
    queryKey: ['invoices', debounced],
    queryFn: () => bookingsApi.list({ search: debounced, status: 'all', limit: 50 }),
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
    <ServiceShell title="Invoices (Proforma)" search={search} onSearch={setSearch} total={data?.meta?.total}>
      <DataTable columns={columns} rows={data?.data || []} loading={isLoading} emptyLabel="No invoices yet — create a booking first." />
    </ServiceShell>
  );
}
