import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, MoreVertical, Layers, Utensils, BedDouble, StickyNote, Wallet, GitMerge, Trash2, MapPin, Map, ImageOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { hotelsApi } from '../../api/services.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { useAuth } from '../../store/AuthContext.jsx';
import ServiceShell from '../../components/services/ServiceShell.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import StarRating from '../../components/ui/StarRating.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';
import HotelFilterDrawer, { EMPTY_HOTEL_FILTERS, countHotelFilters } from '../../components/services/HotelFilterDrawer.jsx';

const PAGE_SIZE = 15;

// Translate the filter-drawer state into API query params.
function filterParams(f) {
  const p = {};
  if (f.destinations?.length) p.destinations = f.destinations.map((d) => d._id).join(',');
  if (f.location?.trim()) p.location = f.location.trim();
  if (f.roomTypes?.length) p.roomTypes = f.roomTypes.map((r) => r._id).join(',');
  if (f.mealPlans?.length) p.mealPlans = f.mealPlans.map((m) => m._id).join(',');
  if (f.stars?.length) p.stars = f.stars.join(',');
  if (f.updatedFrom) p.updatedFrom = f.updatedFrom;
  if (f.updatedTo) p.updatedTo = f.updatedTo;
  if (f.disabledOnly) p.isActive = 'false';
  return p;
}

const TOOLS = [
  { label: 'Hotel Groups', to: '/services/hotels/groups', icon: Layers },
  { label: 'Meal Plans', to: '/services/hotels/meal-plans', icon: Utensils },
  { label: 'Room Types', to: '/services/hotels/room-types', icon: BedDouble },
  { label: 'Cities / Towns', to: '/settings/cities', icon: MapPin },
  { label: 'States / Regions', to: '/settings/states', icon: Map },
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
  const confirm = useConfirm();
  const { can } = useAuth();
  const canDelete = can('hotels.delete');
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_HOTEL_FILTERS);

  // Reset to the first page whenever the search term or filters change.
  useEffect(() => { setPage(1); }, [debounced, filters]);

  const { data, isLoading } = useQuery({
    queryKey: ['hotels', debounced, page, filters],
    queryFn: () => hotelsApi.list({ search: debounced, page, limit: PAGE_SIZE, ...filterParams(filters) }),
    keepPreviousData: true,
  });

  const rows = data?.data || [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const rangeStart = total === 0 ? 0 : (meta?.page - 1) * meta?.limit + 1;
  const rangeEnd = Math.min(meta?.page * meta?.limit, total);
  const filterCount = countHotelFilters(filters);

  const refresh = () => qc.invalidateQueries({ queryKey: ['hotels'] });
  const toggleRow = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = (ids, allSelected) => setSelected(allSelected ? [] : ids);

  const delMut = useMutation({
    mutationFn: (id) => hotelsApi.remove(id),
    onSuccess: () => { toast.success('Hotel deleted'); setSelected([]); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const bulkDelMut = useMutation({
    mutationFn: (ids) => hotelsApi.bulkRemove(ids),
    onSuccess: (r) => { toast.success(`Deleted ${r.deleted} hotel${r.deleted === 1 ? '' : 's'}`); setSelected([]); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const askDeleteOne = async (h) => {
    if (await confirm({ title: 'Delete hotel?', message: `“${h.name}” will be permanently removed. This cannot be undone.`, confirmLabel: 'Delete', danger: true })) delMut.mutate(h._id);
  };
  const askDeleteSelected = async () => {
    if (await confirm({ title: `Delete ${selected.length} hotel${selected.length === 1 ? '' : 's'}?`, message: 'The selected hotels will be permanently removed. This cannot be undone.', confirmLabel: 'Delete All', danger: true })) bulkDelMut.mutate(selected);
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (h) => (
        <div className="flex items-center gap-3">
          {h.imageUrl ? (
            <img
              src={h.imageUrl}
              alt=""
              className="h-11 w-16 flex-shrink-0 rounded-lg border border-slate-200 object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="flex h-11 w-16 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-300">
              <ImageOff size={16} />
            </div>
          )}
          <div>
            <Link to={`/services/hotels/${h._id}`} className="font-semibold text-brand-600 hover:underline">
              {h.name}
            </Link>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              {h.location?.city || '—'} <StarRating value={h.stars} size={11} />
            </div>
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
    ...(canDelete ? [{
      key: 'act',
      header: '',
      thClassName: 'w-12',
      render: (h) => (
        <button onClick={() => askDeleteOne(h)} className="text-slate-300 transition-colors hover:text-red-600" title="Delete hotel">
          <Trash2 size={16} />
        </button>
      ),
    }] : []),
  ];

  return (
    <ServiceShell
      title="Hotels"
      search={search}
      onSearch={setSearch}
      total={total}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      onRefresh={refresh}
      onFilterClick={() => setShowFilters(true)}
      filterCount={filterCount}
      actions={
        <>
          {canDelete && selected.length > 0 && (
            <button onClick={askDeleteSelected} disabled={bulkDelMut.isPending} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60">
              <Trash2 size={16} /> Delete ({selected.length})
            </button>
          )}
          <Link to="/services/hotels/new" className="btn-primary">
            <Plus size={16} /> Add New
          </Link>
          <HotelToolsMenu />
        </>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        emptyLabel="No hotels found."
        selectable={canDelete}
        selectedIds={selected}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
      />
      <Pagination page={meta?.page || 1} totalPages={meta?.totalPages || 1} onChange={setPage} />

      <HotelFilterDrawer
        open={showFilters}
        onClose={() => setShowFilters(false)}
        initial={filters}
        onApply={setFilters}
      />
    </ServiceShell>
  );
}
