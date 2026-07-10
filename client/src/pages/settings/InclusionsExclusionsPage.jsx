import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { inclusionExclusionApi } from '../../api/masterData.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import ServiceShell from '../../components/services/ServiceShell.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';
import { cn } from '../../lib/cn.js';

const PAGE_SIZE = 20;

const TABS = [
  { value: '', label: 'All' },
  { value: 'inclusion', label: 'Inclusions' },
  { value: 'exclusion', label: 'Exclusions' },
];

function ItemForm({ existing, defaultType, onSaved }) {
  const isEdit = !!existing;
  const [f, setF] = useState({
    text: existing?.text || '',
    type: existing?.type || defaultType || 'inclusion',
    order: existing?.order ?? 0,
  });

  const mut = useMutation({
    mutationFn: () => {
      const payload = { text: f.text.trim(), type: f.type, order: Number(f.order) || 0 };
      return isEdit ? inclusionExclusionApi.update(existing._id, payload) : inclusionExclusionApi.create(payload);
    },
    onSuccess: () => { toast.success(isEdit ? 'Item updated' : 'Item added'); onSaved(); },
    onError: (e) => toast.error(e?.response?.data?.message || e.message),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!f.text.trim()) return toast.error('Text required');
    mut.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">Text</label>
        <textarea className="input min-h-[70px]" value={f.text} onChange={(e) => setF((s) => ({ ...s, text: e.target.value }))}
          placeholder="e.g. Complete boat charges, cruise charges, permits and entry tickets." autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Type</label>
          <select className="input" value={f.type} onChange={(e) => setF((s) => ({ ...s, type: e.target.value }))}>
            <option value="inclusion">Inclusion</option>
            <option value="exclusion">Exclusion</option>
          </select>
        </div>
        <div>
          <label className="label">Order</label>
          <input type="number" className="input" value={f.order} onChange={(e) => setF((s) => ({ ...s, order: e.target.value }))} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button className="btn-primary" disabled={mut.isPending}>{mut.isPending ? 'Saving…' : isEdit ? 'Update' : 'Add Item'}</button>
      </div>
    </form>
  );
}

export default function InclusionsExclusionsPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [editing, setEditing] = useState(null); // item | 'new' | null
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);
  const qc = useQueryClient();
  const confirm = useConfirm();

  useEffect(() => { setPage(1); }, [debounced, type]);

  const { data, isLoading } = useQuery({
    queryKey: ['inclusion-exclusions', debounced, page, type],
    queryFn: () => inclusionExclusionApi.list({ search: debounced, page, limit: PAGE_SIZE, ...(type ? { type } : {}) }),
    keepPreviousData: true,
  });

  const rows = data?.data || [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const rangeStart = total === 0 ? 0 : (meta?.page - 1) * meta?.limit + 1;
  const rangeEnd = Math.min(meta?.page * meta?.limit, total);

  const refresh = () => qc.invalidateQueries({ queryKey: ['inclusion-exclusions'] });

  const statusMut = useMutation({
    mutationFn: ({ id, isActive }) => inclusionExclusionApi.update(id, { isActive }),
    onSuccess: () => { toast.success('Updated'); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id) => inclusionExclusionApi.remove(id),
    onSuccess: () => { toast.success('Item deleted'); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const askDeleteOne = async (d) => {
    if (await confirm({ title: 'Delete item?', message: 'This line will no longer appear as a default on new quotations.', confirmLabel: 'Delete', danger: true })) delMut.mutate(d._id);
  };

  const columns = [
    { key: 'text', header: 'Text', render: (d) => <span className="font-medium text-gray-900">{d.text}</span> },
    { key: 'type', header: 'Type', thClassName: 'w-32', render: (d) => (
      <span className={cn('rounded px-2 py-0.5 text-xs font-medium capitalize', d.type === 'inclusion' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600')}>
        {d.type}
      </span>
    ) },
    { key: 'order', header: 'Order', thClassName: 'w-20', render: (d) => <span className="text-gray-500">{d.order ?? 0}</span> },
    { key: 'status', header: 'Status', thClassName: 'w-24', render: (d) => (
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
    <div>
      <div className="flex gap-1 border-b border-gray-200 bg-white px-6 pt-3">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => setType(t.value)}
            className={cn('px-4 py-2 text-sm font-medium', type === t.value ? 'border-b-2 border-brand-600 text-brand-700' : 'text-gray-500 hover:text-gray-800')}>
            {t.label}
          </button>
        ))}
      </div>
      <ServiceShell
        title="Inclusions & Exclusions"
        search={search}
        onSearch={setSearch}
        total={total}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onRefresh={refresh}
        actions={<button onClick={() => setEditing('new')} className="btn-primary"><Plus size={16} /> Add Item</button>}
      >
        <DataTable columns={columns} rows={rows} loading={isLoading} emptyLabel="No items yet — add your default inclusion/exclusion lines." />
        <Pagination page={meta?.page || 1} totalPages={meta?.totalPages || 1} onChange={setPage} />

        <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add Item' : 'Edit Item'}>
          {editing && <ItemForm existing={editing === 'new' ? null : editing} defaultType={type || 'inclusion'} onSaved={() => { setEditing(null); refresh(); }} />}
        </Modal>
      </ServiceShell>
    </div>
  );
}
