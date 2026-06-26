import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Info, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { hotelNotesApi } from '../../api/hotelNotes.js';
import CreatableSelect from '../../components/form/CreatableSelect.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';

const SHARE_OPTIONS = ['Quotation and Voucher', 'Quotation', 'Voucher'];

export default function GeneralHotelNotesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const { data: notes = [], isLoading } = useQuery({ queryKey: ['hotel-notes'], queryFn: hotelNotesApi.list });
  const refresh = () => qc.invalidateQueries({ queryKey: ['hotel-notes'] });
  const delMut = useMutation({ mutationFn: (id) => hotelNotesApi.remove(id), onSuccess: () => { toast.success('Deleted'); refresh(); } });
  const askDelete = async (id) => { if (await confirm({ title: 'Delete this note?', message: 'This hotel note will be permanently removed.' })) delMut.mutate(id); };

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/services/hotels')} className="text-slate-600 hover:text-slate-900"><ArrowLeft size={18} /></button>
          <h1 className="text-lg font-bold text-slate-900">General Hotel Notes</h1>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-secondary text-sm"><Plus size={15} /> Create Notes</button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-400">Loading…</div>
      ) : notes.length === 0 ? (
        <div className="py-20 text-center">
          <Info className="mx-auto mb-2 text-slate-300" size={40} />
          <p className="text-slate-600">There are no items in this list.</p>
          <button onClick={refresh} className="btn-secondary mt-3 text-sm"><RefreshCw size={14} /> Refresh Results</button>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n._id} className="card p-4">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded bg-brand-50 px-2 py-0.5 font-medium text-brand-700">{n.shareWith}</span>
                  {n.general && <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">General</span>}
                  {(n.mealPlans || []).map((m) => <span key={m} className="rounded bg-amber-50 px-2 py-0.5 text-amber-700">{m}</span>)}
                  {n.dateRange?.start && <span className="text-slate-400">{format(new Date(n.dateRange.start), 'd MMM yy')} → {n.dateRange.end ? format(new Date(n.dateRange.end), 'd MMM yy') : ''}</span>}
                </div>
                <button onClick={() => askDelete(n._id)} className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{n.notes}</p>
              <p className="mt-2 text-[11px] text-slate-400">{n.createdBy?.name || 'You'} · {format(new Date(n.createdAt), 'd MMM yyyy')}</p>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateNoteModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); refresh(); }} />}
    </div>
  );
}

function CreateNoteModal({ onClose, onSaved }) {
  const [f, setF] = useState({ shareWith: 'Quotation and Voucher', general: true, mealPlans: [], start: '', end: '', notes: '' });
  const [submitted, setSubmitted] = useState(false);
  const notesRef = useRef(null);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const noteMissing = !f.notes.trim();
  const mut = useMutation({
    mutationFn: () => hotelNotesApi.create({
      shareWith: f.shareWith, general: f.general, mealPlans: f.mealPlans,
      dateRange: { start: f.start || undefined, end: f.end || undefined }, notes: f.notes.trim(),
    }),
    onSuccess: () => { toast.success('Note created'); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  const submit = () => {
    setSubmitted(true);
    if (noteMissing) {
      toast.error('Please enter the notes before saving');
      notesRef.current?.focus();
      return undefined;
    }
    return mut.mutate();
  };
  return (
    <Modal open onClose={onClose} title="Create General Hotel Notes" width="max-w-2xl">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Share With</label>
            <select className="input" value={f.shareWith} onChange={(e) => set('shareWith')(e.target.value)}>
              {SHARE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 pt-7 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={f.general} onChange={(e) => set('general')(e.target.checked)} /> General (Applicable on all hotel combinations)
          </label>
        </div>
        <div>
          <label className="label">Meal Plan <span className="label-optional">(optional)</span></label>
          <CreatableSelect category="mealPlan" isMulti value={f.mealPlans} onChange={set('mealPlans')} placeholder="Select meals…" />
        </div>
        <div>
          <label className="label">Range Between <span className="label-optional">(optional)</span></label>
          <div className="flex items-center gap-2">
            <input type="date" className="input" value={f.start} onChange={(e) => set('start')(e.target.value)} />
            <span className="text-slate-400">→</span>
            <input type="date" className="input" value={f.end} onChange={(e) => set('end')(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Notes <span className="text-red-500">*</span></label>
          <textarea
            ref={notesRef}
            rows={4}
            className={`input ${submitted && noteMissing ? 'border-red-500 ring-1 ring-red-300' : ''}`}
            value={f.notes}
            onChange={(e) => set('notes')(e.target.value)}
            placeholder="Enter notes here…"
          />
          {submitted && noteMissing && <p className="mt-1 text-xs font-medium text-red-600">Notes are required to save.</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={submit} disabled={mut.isPending} className="btn-primary">{mut.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </Modal>
  );
}
