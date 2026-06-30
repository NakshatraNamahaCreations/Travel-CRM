import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Pencil, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { statesApi } from '../../api/locations.js';
import Modal from '../../components/ui/Modal.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';
import { useDebounced } from '../../hooks/useDebounced.js';

function StateForm({ existing, onSaved, onClose }) {
  const [name, setName] = useState(existing?.name || '');
  const [country, setCountry] = useState(existing?.country || 'India');
  const [description, setDescription] = useState(existing?.description || '');
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => existing
      ? statesApi.update(existing._id, { name: name.trim(), country: country.trim(), description: description.trim() })
      : statesApi.create({ name: name.trim(), country: country.trim(), description: description.trim() }),
    onSuccess: () => {
      toast.success(existing ? 'State updated' : 'State added');
      qc.invalidateQueries({ queryKey: ['states'] });
      onSaved();
    },
    onError: (e) => toast.error(e.message || 'Failed to save state'),
  });
  return (
    <div className="space-y-3">
      <div>
        <label className="label">State / Region Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Andaman and Nicobar Islands" autoFocus />
      </div>
      <div>
        <label className="label">Country</label>
        <input className="input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. India" />
      </div>
      <div>
        <label className="label">Description <span className="label-optional">(optional)</span></label>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short note" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
        <button onClick={() => name.trim() && mut.mutate()} disabled={!name.trim() || mut.isPending} className="btn-primary text-sm">
          {mut.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default function StatesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const debounced = useDebounced(search);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['states', debounced],
    queryFn: () => statesApi.list({ search: debounced, limit: 100 }),
  });
  const items = data?.data || data?.items || [];

  const delMut = useMutation({
    mutationFn: (id) => statesApi.remove(id),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['states'] }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="px-6 py-5">
      <button onClick={() => navigate(-1)} className="mb-1 flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700">
        <ArrowLeft size={16} /> Back
      </button>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">States / Regions</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm"><Plus size={15} /> Add State</button>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
        <Search size={15} className="text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search states…" className="w-full text-sm outline-none" />
      </div>

      <p className="mb-2 text-sm text-slate-500">Showing {items.length} item{items.length !== 1 ? 's' : ''}</p>

      <div className="card card-flush overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr><td colSpan={4} className="py-12 text-center text-slate-400">Loading…</td></tr>
            ) : isError ? (
              <tr><td colSpan={4} className="py-12 text-center text-red-400">{error?.message || 'Failed to load states'}</td></tr>
            ) : !items.length ? (
              <tr><td colSpan={4} className="py-12 text-center text-slate-400">No states added yet.</td></tr>
            ) : items.map((s) => (
              <tr key={s._id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                <td className="px-4 py-3 text-slate-600">{s.country || '—'}</td>
                <td className="px-4 py-3 text-slate-500">{s.description || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => setEditItem(s)} className="text-slate-400 hover:text-slate-700"><Pencil size={14} /></button>
                    <button onClick={async () => { if (await confirm({ title: 'Delete state?', message: `"${s.name}" will be removed.` })) delMut.mutate(s._id); }} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && <Modal open onClose={() => setShowAdd(false)} title="Add State"><StateForm onSaved={() => setShowAdd(false)} onClose={() => setShowAdd(false)} /></Modal>}
      {editItem && <Modal open onClose={() => setEditItem(null)} title="Edit State"><StateForm existing={editItem} onSaved={() => setEditItem(null)} onClose={() => setEditItem(null)} /></Modal>}
    </div>
  );
}
