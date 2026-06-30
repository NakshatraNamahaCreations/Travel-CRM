import { useState, useRef, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreVertical, Calculator, UploadCloud } from 'lucide-react';
import { format } from 'date-fns';
import { transportPricesApi } from '../../api/services.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import ServiceShell from '../../components/services/ServiceShell.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import RowDisableMenu from '../../components/services/RowDisableMenu.jsx';

const PAGE_SIZE = 20;

function PricesKebab() {
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
        <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <Link to="/services/transport-prices/calculator" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <Calculator size={15} className="text-slate-400" /> Calculate Price
          </Link>
        </div>
      )}
    </div>
  );
}

export default function TransportPricesPage() {
  const [params] = useSearchParams();
  const service = params.get('service') || undefined;
  const [search, setSearch] = useState('');
  const [disabledOnly, setDisabledOnly] = useState(false);
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);
  const qc = useQueryClient();

  useEffect(() => { setPage(1); }, [debounced, service, disabledOnly]);

  const { data, isLoading } = useQuery({
    queryKey: ['transport-prices', debounced, service, disabledOnly, page],
    queryFn: () => transportPricesApi.list({ search: debounced, service, isActive: !disabledOnly, page, limit: PAGE_SIZE }),
    keepPreviousData: true,
  });

  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const rangeStart = total === 0 ? 0 : (meta?.page - 1) * meta?.limit + 1;
  const rangeEnd = Math.min(meta?.page * meta?.limit, total);
  const fmt = (n) => new Intl.NumberFormat('en-IN').format(n);
  const dt = (d) => (d ? format(new Date(d), 'd MMM, yyyy') : '—');
  const columns = [
    { key: 'startDate', header: 'Start Date', render: (r) => dt(r.startDate) },
    { key: 'endDate', header: 'End Date', render: (r) => dt(r.endDate) },
    { key: 'service', header: 'Service', render: (r) => <span className="font-medium text-gray-900">{r.service?.name}</span> },
    { key: 'itemName', header: 'Item', render: (r) => r.itemName || '—' },
    { key: 'config', header: 'Config', render: (r) => r.config || '—' },
    { key: 'price', header: 'Price', render: (r) => <span className="font-semibold">{fmt(r.price)}<span className="ml-1 text-xs text-gray-400">{r.currency}</span></span> },
    { key: 'actions', header: '', thClassName: 'w-10', render: (r) => <RowDisableMenu row={r} api={transportPricesApi} onChanged={refresh} /> },
  ];
  const refresh = () => qc.invalidateQueries({ queryKey: ['transport-prices'] });

  return (
    <ServiceShell title="Transport Service Prices" search={search} onSearch={setSearch} total={total} rangeStart={rangeStart} rangeEnd={rangeEnd} onRefresh={refresh}
      actions={
        <>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
            <input type="checkbox" checked={disabledOnly} onChange={(e) => setDisabledOnly(e.target.checked)} /> Disabled Only
          </label>
          <Link to="/services/transport-prices/upload" className="btn-primary"><UploadCloud size={16} /> Upload Prices</Link>
          <PricesKebab />
        </>
      }>
      <DataTable columns={columns} rows={data?.data || []} loading={isLoading} emptyLabel="No transport prices yet." />
      <Pagination page={meta?.page || 1} totalPages={meta?.totalPages || 1} onChange={setPage} />
    </ServiceShell>
  );
}
