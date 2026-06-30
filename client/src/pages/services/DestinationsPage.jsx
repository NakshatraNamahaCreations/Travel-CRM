import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { destinationsApi } from '../../api/masterData.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import ServiceShell from '../../components/services/ServiceShell.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';
import { cn } from '../../lib/cn.js';

const PAGE_SIZE = 20;

function DestinationForm({ existing, onSaved }) {
  const isEdit = !!existing;
  const [f, setF] = useState({
    name: existing?.name || '', country: existing?.country || 'India', region: existing?.region || '',
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => {
      const payload = { name: f.name.trim(), country: f.country.trim(), region: f.region.trim() };
      return isEdit ? destinationsApi.update(existing._id, payload) : destinationsApi.create(payload);
    },
    onSuccess: () => { toast.success(isEdit ? 'Destination updated' : 'Destination added'); onSaved(); },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return toast.error('Name required');
    mut.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><label className="label">Name</label><input className="input" value={f.name} onChange={set('name')} placeholder="e.g. Havelock" autoFocus /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Region</label><input className="input" value={f.region} onChange={set('region')} placeholder="e.g. Andaman" /></div>
        <div><label className="label">Country</label><input className="input" value={f.country} onChange={set('country')} /></div>
      </div>
      <div className="flex justify-end pt-2"><button className="btn-primary" disabled={mut.isPending}>{mut.isPending ? 'Saving…' : isEdit ? 'Update' : 'Add Destination'}</button></div>
    </form>
  );
}

export default function DestinationsPage() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // destination | 'new' | null
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const debounced = useDebounced(search);
  const qc = useQueryClient();
  const confirm = useConfirm();

  useEffect(() => { setPage(1); }, [debounced]);

  const { data, isLoading } = useQuery({
    queryKey: ['destinations-admin', debounced, page],
    queryFn: () => destinationsApi.list({ search: debounced, page, limit: PAGE_SIZE }),
    keepPreviousData: true,
  });

  const rows = data?.data || [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const rangeStart = total === 0 ? 0 : (meta?.page - 1) * meta?.limit + 1;
  const rangeEnd = Math.min(meta?.page * meta?.limit, total);

  const refresh = () => qc.invalidateQueries({ queryKey: ['destinations-admin'] });
  const toggleRow = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = (ids, allSelected) => setSelected(allSelected ? [] : ids);

  const statusMut = useMutation({
    mutationFn: ({ id, isActive }) => destinationsApi.update(id, { isActive }),
    onSuccess: () => { toast.success('Updated'); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id) => destinationsApi.remove(id),
    onSuccess: () => { toast.success('Destination deleted'); setSelected([]); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const bulkDelMut = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => destinationsApi.remove(id))),
    onSuccess: (_r, ids) => { toast.success(`Deleted ${ids.length} destination${ids.length === 1 ? '' : 's'}`); setSelected([]); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const askDeleteOne = async (d) => {
    if (await confirm({ title: 'Delete destination?', message: `“${d.name}” will be permanently removed.`, confirmLabel: 'Delete', danger: true })) delMut.mutate(d._id);
  };
  const askDeleteSelected = async () => {
    if (await confirm({ title: `Delete ${selected.length} destination${selected.length === 1 ? '' : 's'}?`, message: 'The selected destinations will be permanently removed.', confirmLabel: 'Delete All', danger: true })) bulkDelMut.mutate(selected);
  };

  const columns = [
    { key: 'name', header: 'Name', render: (d) => <span className="font-medium text-gray-900">{d.name}</span> },
    { key: 'region', header: 'Region', render: (d) => <span className="text-gray-600">{d.region || '—'}</span> },
    { key: 'country', header: 'Country', render: (d) => <span className="text-gray-600">{d.country || '—'}</span> },
    { key: 'status', header: 'Status', render: (d) => (
      <span className={cn('rounded px-2 py-0.5 text-xs', d.isActive === false ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700')}>
        {d.isActive === false ? 'Disabled' : 'Active'}
      </span>
    ) },
    { key: 'act', header: '', thClassName: 'w-24', render: (d) => (
      <div className="flex gap-2.5 text-slate-400">
        <button onClick={() => setEditing(d)} className="hover:text-brand-600" title="Edit"><Pencil size={15} /></button>
        <button onClick={() => statusMut.mutate({ id: d._id, isActive: d.isActive === false })} className="hover:text-gray-700" title={d.isActive === false ? 'Enable' : 'Disable'}>
          {d.isActive === false ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        <button onClick={() => askDeleteOne(d)} className="hover:text-red-600" title="Delete"><Trash2 size={15} /></button>
      </div>
    ) },
  ];

  return (
    <ServiceShell
      title="Destinations"
      search={search}
      onSearch={setSearch}
      total={total}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      onRefresh={refresh}
      actions={
        <>
          {selected.length > 0 && (
            <button onClick={askDeleteSelected} disabled={bulkDelMut.isPending} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60">
              <Trash2 size={16} /> Delete ({selected.length})
            </button>
          )}
          <button onClick={() => setEditing('new')} className="btn-primary"><Plus size={16} /> Add Destination</button>
        </>
      }
    >
      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        emptyLabel="No destinations found."
        selectable
        selectedIds={selected}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
      />
      <Pagination page={meta?.page || 1} totalPages={meta?.totalPages || 1} onChange={setPage} />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add Destination' : 'Edit Destination'}>
        {editing && <DestinationForm existing={editing === 'new' ? null : editing} onSaved={() => { setEditing(null); refresh(); }} />}
      </Modal>
    </ServiceShell>
  );
}
