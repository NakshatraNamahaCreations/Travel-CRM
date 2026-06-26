import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { hotelsApi } from '../../api/services.js';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';

export default function MergeHotelsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [dups, setDups] = useState([]); // [{ _id, name }]
  const [primaryId, setPrimaryId] = useState('');

  const loadHotels = (s) =>
    hotelsApi.list({ search: s, limit: 20 }).then((r) =>
      r.data.map((h) => ({ _id: h._id, name: `${h.name}${h.location?.city ? ` (${h.location.city})` : ''}` }))
    );

  const onDupsChange = (next) => {
    setDups(next);
    if (!next.some((d) => d._id === primaryId)) setPrimaryId('');
  };

  const mut = useMutation({
    mutationFn: async () => {
      const targets = dups.filter((d) => d._id !== primaryId);
      for (const d of targets) {
        // eslint-disable-next-line no-await-in-loop
        await hotelsApi.merge(d._id, primaryId);
      }
      return targets.length;
    },
    onSuccess: (n) => {
      toast.success(`Merged ${n} hotel${n === 1 ? '' : 's'} into the primary`);
      qc.invalidateQueries({ queryKey: ['hotels'] });
      navigate('/services/hotels');
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = async () => {
    if (dups.length < 2) return toast.error('Select at least 2 duplicate hotels');
    if (!primaryId) return toast.error('Select the primary/master hotel');
    const n = dups.filter((d) => d._id !== primaryId).length;
    if (await confirm({ title: 'Merge hotels?', message: `${n} duplicate hotel${n === 1 ? '' : 's'} will be merged into the primary and permanently deleted.`, confirmLabel: 'Merge' })) {
      mut.mutate();
    }
    return undefined;
  };

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
        <button onClick={() => navigate('/services/hotels')} className="text-slate-600 hover:text-slate-900"><ArrowLeft size={18} /></button>
        <h1 className="text-lg font-bold text-slate-900">Merge Hotels</h1>
      </div>

      <div className="mx-auto max-w-2xl">
        <h2 className="text-lg font-bold text-slate-900">Merge Duplicate Hotels</h2>

        <div className="mt-4">
          <p className="font-semibold text-slate-800">Duplicate Hotels</p>
          <p className="mb-2 text-sm text-slate-400">Please select the duplicate hotels.</p>
          <AsyncSelect loadOptions={loadHotels} value={dups} onChange={onDupsChange} isMulti placeholder="Type to search hotels…" />
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="font-semibold text-slate-800">Primary / Master Hotel</p>
          <p className="mb-2 text-sm text-slate-400">Please select the primary/master hotel from the duplicates. The others will be merged into it and removed.</p>
          {dups.length === 0 ? (
            <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">Please select some duplicates to choose a primary hotel</div>
          ) : (
            <div className="space-y-2">
              {dups.map((d) => (
                <label key={d._id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <input type="radio" name="primary" checked={primaryId === d._id} onChange={() => setPrimaryId(d._id)} />
                  {d.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
          <button onClick={submit} disabled={mut.isPending} className="btn-primary">{mut.isPending ? 'Merging…' : 'Merge Hotels'}</button>
          <button onClick={() => navigate('/services/hotels')} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
