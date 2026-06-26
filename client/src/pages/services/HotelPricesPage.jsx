import { useState, useRef, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreVertical, Calculator, UploadCloud } from 'lucide-react';
import { format } from 'date-fns';
import { hotelPricesApi } from '../../api/services.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import ServiceShell from '../../components/services/ServiceShell.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import RowDisableMenu from '../../components/services/RowDisableMenu.jsx';

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
          <Link to="/services/hotel-prices/calculator" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <Calculator size={15} className="text-slate-400" /> Calculate Price
          </Link>
        </div>
      )}
    </div>
  );
}

export default function HotelPricesPage() {
  const [params] = useSearchParams();
  const hotelFilter = params.get('hotel') || undefined;
  const [search, setSearch] = useState('');
  const [disabledOnly, setDisabledOnly] = useState(false);
  const debounced = useDebounced(search);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['hotel-prices', debounced, hotelFilter, disabledOnly],
    queryFn: () => hotelPricesApi.list({ search: debounced, hotel: hotelFilter, isActive: !disabledOnly, limit: 50 }),
  });

  const fmt = (n) => new Intl.NumberFormat('en-IN').format(n);
  const dt = (d) => (d ? format(new Date(d), 'd MMM, yyyy') : '—');

  const columns = [
    { key: 'startDate', header: 'Start Date', render: (r) => dt(r.startDate) },
    { key: 'endDate', header: 'End Date', render: (r) => dt(r.endDate) },
    { key: 'hotel', header: 'Hotel', render: (r) => (
      <div><div className="font-semibold text-gray-900">{r.hotel?.name}</div><div className="text-xs text-gray-400">{r.hotel?.location?.city} • {r.hotel?.stars} Star</div></div>
    ) },
    { key: 'mealPlan', header: 'Meal Plan' },
    { key: 'roomType', header: 'Room Type' },
    { key: 'basePrice', header: 'Base Price', render: (r) => <span className="font-semibold">{fmt(r.basePrice)}<span className="ml-1 text-xs text-gray-400">{r.currency}</span></span> },
    { key: 'persons', header: 'Persons' },
    { key: 'aweb', header: 'A.W.E.B', render: (r) => fmt(r.aweb) },
    { key: 'cweb', header: 'C.W.E.B', render: (r) => fmt(r.cweb) },
    { key: 'cwoeb', header: 'C.Wo.E.B', render: (r) => fmt(r.cwoeb) },
    { key: 'actions', header: '', thClassName: 'w-10', render: (r) => <RowDisableMenu row={r} api={hotelPricesApi} onChanged={refresh} /> },
  ];

  const refresh = () => qc.invalidateQueries({ queryKey: ['hotel-prices'] });

  return (
    <ServiceShell
      title="Hotel Prices"
      search={search}
      onSearch={setSearch}
      total={data?.meta?.total}
      onRefresh={refresh}
      actions={
        <>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
            <input type="checkbox" checked={disabledOnly} onChange={(e) => setDisabledOnly(e.target.checked)} /> Disabled Only
          </label>
          <Link to="/services/hotel-prices/upload" className="btn-primary"><UploadCloud size={16} /> Upload Prices</Link>
          <PricesKebab />
        </>
      }
    >
      <DataTable columns={columns} rows={data?.data || []} loading={isLoading} emptyLabel="No prices yet." />
    </ServiceShell>
  );
}
