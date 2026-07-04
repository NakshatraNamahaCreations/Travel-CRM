import { useState, useRef, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreVertical, Calculator, UploadCloud } from 'lucide-react';
import { format } from 'date-fns';
import { activityPricesApi, activitiesApi } from '../../api/services.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import ServiceShell from '../../components/services/ServiceShell.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import FilterDrawer, { countFilters } from '../../components/ui/FilterDrawer.jsx';

const EMPTY_FILTERS = { activitySel: null, config: '', activeOn: '' };
const FILTER_FIELDS = [
  { key: 'activitySel', label: 'Activity', type: 'async', loadOptions: (s) => activitiesApi.list({ search: s }).then((r) => r.data) },
  { key: 'config', label: 'Config (Adult / Child…)', type: 'text', placeholder: 'e.g. Adult' },
  { key: 'activeOn', label: 'Price Active On Date', type: 'date' },
];
const filterParams = (f) => ({
  ...(f.activitySel ? { activity: f.activitySel._id } : {}),
  ...(f.config?.trim() ? { config: f.config.trim() } : {}),
  ...(f.activeOn ? { activeOn: f.activeOn } : {}),
});

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
          <Link to="/services/activity-prices/calculator" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <Calculator size={15} className="text-slate-400" /> Calculate Price
          </Link>
        </div>
      )}
    </div>
  );
}

export default function ActivityPricesPage() {
  const [params] = useSearchParams();
  const activity = params.get('activity') || undefined;
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const debounced = useDebounced(search);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['activity-prices', debounced, activity, filters],
    queryFn: () => activityPricesApi.list({ search: debounced, activity, limit: 50, ...filterParams(filters) }),
  });

  const fmt = (n) => new Intl.NumberFormat('en-IN').format(n);
  const dt = (d) => (d ? format(new Date(d), 'd MMM, yyyy') : '—');
  const columns = [
    { key: 'startDate', header: 'Start Date', render: (r) => dt(r.startDate) },
    { key: 'endDate', header: 'End Date', render: (r) => dt(r.endDate) },
    { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-gray-900">{r.activity?.name}</span> },
    { key: 'service', header: 'Service' },
    { key: 'config', header: 'Config' },
    { key: 'price', header: 'Price', render: (r) => <span className="font-semibold">{fmt(r.price)}<span className="ml-1 text-xs text-gray-400">{r.currency}</span></span> },
    { key: 'addedOn', header: 'Added On', render: (r) => dt(r.createdAt) },
  ];
  const refresh = () => qc.invalidateQueries({ queryKey: ['activity-prices'] });

  return (
    <ServiceShell title="Travel Activity Prices" search={search} onSearch={setSearch} total={data?.meta?.total} onRefresh={refresh}
      onFilterClick={() => setShowFilters(true)} filterCount={countFilters(filters)}
      actions={
        <>
          <Link to="/services/activity-prices/upload" className="btn-primary"><UploadCloud size={16} /> Upload Prices</Link>
          <PricesKebab />
        </>
      }>
      <DataTable columns={columns} rows={data?.data || []} loading={isLoading} emptyLabel="No activity prices yet." />
      <FilterDrawer open={showFilters} onClose={() => setShowFilters(false)} fields={FILTER_FIELDS} initial={filters} empty={EMPTY_FILTERS} onApply={setFilters} />
    </ServiceShell>
  );
}
