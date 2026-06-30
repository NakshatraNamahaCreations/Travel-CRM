import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Bus, MoreVertical, Receipt, Car, Download, Ban, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { transportApi } from '../../api/services.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { useAuth } from '../../store/AuthContext.jsx';
import ServiceShell from '../../components/services/ServiceShell.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';
import TransportFilterDrawer, { EMPTY_TRANSPORT_FILTERS, countTransportFilters } from '../../components/services/TransportFilterDrawer.jsx';

const PAGE_SIZE = 20;

// Translate the filter-drawer state into API query params.
function filterParams(f) {
  const p = {};
  if (f.destinations?.length) p.destinations = f.destinations.map((d) => d._id).join(',');
  if (f.from?.trim()) p.from = f.from.trim();
  if (f.to?.trim()) p.to = f.to.trim();
  if (f.updatedFrom) p.updatedFrom = f.updatedFrom;
  if (f.updatedTo) p.updatedTo = f.updatedTo;
  if (f.disabledOnly) p.isActive = 'false';
  return p;
}

function ToolsMenu({ onDownload, onBulkDisable }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const Item = ({ icon: Icon, children, onClick, to, danger }) => {
    const cls = `flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm ${danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'}`;
    return to
      ? <Link to={to} onClick={() => setOpen(false)} className={cls}><Icon size={15} className={danger ? '' : 'text-slate-400'} /> {children}</Link>
      : <button onClick={() => { setOpen(false); onClick(); }} className={cls}><Icon size={15} className={danger ? '' : 'text-slate-400'} /> {children}</button>;
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn-secondary px-2" title="More"><MoreVertical size={16} /></button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <Item icon={Receipt} to="/services/transport-prices">View Prices</Item>
          <Item icon={Car} to="/services/transport/cab-types">Cab Types</Item>
          <div className="my-1 border-t border-slate-100" />
          <Item icon={Download} onClick={onDownload}>Download as CSV/Excel</Item>
          <Item icon={Ban} onClick={onBulkDisable} danger>Bulk Disable Transport Services</Item>
        </div>
      )}
    </div>
  );
}

export default function TransportListPage() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { can } = useAuth();
  const canDelete = can('transport.delete');
  const [selected, setSelected] = useState([]);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_TRANSPORT_FILTERS);
  const filterCount = countTransportFilters(filters);

  useEffect(() => { setPage(1); }, [debounced, filters]);

  const { data, isLoading } = useQuery({
    queryKey: ['transport', debounced, page, filters],
    queryFn: () => transportApi.list({ search: debounced, page, limit: PAGE_SIZE, ...filterParams(filters) }),
    keepPreviousData: true,
  });
  const rows = data?.data || [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const rangeStart = total === 0 ? 0 : (meta?.page - 1) * meta?.limit + 1;
  const rangeEnd = Math.min(meta?.page * meta?.limit, total);

  const refresh = () => qc.invalidateQueries({ queryKey: ['transport'] });
  const toggleRow = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = (ids, allSelected) => setSelected(allSelected ? [] : ids);

  const bulkMut = useMutation({
    mutationFn: () => transportApi.bulkDisable(),
    onSuccess: (r) => { toast.success(`Disabled ${r.disabled} service${r.disabled === 1 ? '' : 's'}`); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const askBulkDisable = async () => {
    if (await confirm({ title: 'Bulk disable transport services?', message: 'Every active transport service will be marked inactive (hidden from lists). You can re-enable them later.', confirmLabel: 'Disable All', danger: false })) bulkMut.mutate();
  };

  const delMut = useMutation({
    mutationFn: (id) => transportApi.remove(id),
    onSuccess: () => { toast.success('Transport service deleted'); setSelected([]); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const bulkDelMut = useMutation({
    mutationFn: (ids) => transportApi.bulkRemove(ids),
    onSuccess: (r) => { toast.success(`Deleted ${r.deleted} service${r.deleted === 1 ? '' : 's'}`); setSelected([]); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const askDeleteOne = async (t) => {
    if (await confirm({ title: 'Delete transport service?', message: `“${t.from || t.name}${t.to ? ' → ' + t.to : ''}” will be permanently removed. This cannot be undone.`, confirmLabel: 'Delete', danger: true })) delMut.mutate(t._id);
  };
  const askDeleteSelected = async () => {
    if (await confirm({ title: `Delete ${selected.length} service${selected.length === 1 ? '' : 's'}?`, message: 'The selected transport services will be permanently removed. This cannot be undone.', confirmLabel: 'Delete All', danger: true })) bulkDelMut.mutate(selected);
  };

  const downloadCsv = () => {
    const data2 = rows.map((t) => [t.from || t.name, t.to || '', (t.items || []).map((i) => i.name).join('; '), format(new Date(t.updatedAt), 'yyyy-MM-dd')]);
    const csv = [['From', 'To', 'Services', 'Last Updated'], ...data2].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transport-services.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const [expanded, setExpanded] = useState(new Set());
  const toggleExpand = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const columns = [
    {
      key: 'from',
      header: 'From',
      render: (t) => (
        <div className="flex items-center gap-2">
          <Bus size={16} className="text-brand-500" />
          <Link to={`/services/transport/${t._id}`} className="font-semibold text-brand-600 hover:underline">{t.from || t.name}</Link>
        </div>
      ),
    },
    { key: 'to', header: 'To', render: (t) => <span className="text-gray-600">{t.to || ''}</span> },
    {
      key: 'items',
      header: 'Services',
      render: (t) => {
        const isExpanded = expanded.has(t._id);
        const visible = isExpanded ? (t.items || []) : (t.items || []).slice(0, 2);
        const extra = (t.items?.length || 0) - 2;
        return (
          <div className="space-y-1">
            {visible.map((it) => (
              <div key={it._id || it.name} className="text-gray-700">{it.name}</div>
            ))}
            {!t.items?.length && <span className="text-gray-400">—</span>}
            {extra > 0 && !isExpanded && (
              <button onClick={() => toggleExpand(t._id)} className="text-xs text-brand-600 hover:underline">
                View More ({extra})
              </button>
            )}
            {isExpanded && extra > 0 && (
              <button onClick={() => toggleExpand(t._id)} className="text-xs text-brand-600 hover:underline">
                View Less
              </button>
            )}
          </div>
        );
      },
    },
    { key: 'updated', header: 'Last Updated', render: (t) => <span className="text-gray-500">{format(new Date(t.updatedAt), 'd MMM, yyyy')}</span> },
    ...(canDelete ? [{
      key: 'act',
      header: '',
      thClassName: 'w-12',
      render: (t) => (
        <button onClick={() => askDeleteOne(t)} className="text-slate-300 transition-colors hover:text-red-600" title="Delete service">
          <Trash2 size={16} />
        </button>
      ),
    }] : []),
  ];

  return (
    <ServiceShell
      title="Transport Services"
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
          <Link to="/services/transport/new" className="btn-primary"><Plus size={16} /> New Service</Link>
          <ToolsMenu onDownload={downloadCsv} onBulkDisable={askBulkDisable} />
        </>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        emptyLabel="No transport services yet."
        selectable={canDelete}
        selectedIds={selected}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
      />
      <Pagination page={meta?.page || 1} totalPages={meta?.totalPages || 1} onChange={setPage} />

      <TransportFilterDrawer
        open={showFilters}
        onClose={() => setShowFilters(false)}
        initial={filters}
        onApply={setFilters}
      />
    </ServiceShell>
  );
}
