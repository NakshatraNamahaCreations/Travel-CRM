import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Pencil } from 'lucide-react';
import { ownerApi } from '../../api/owner.js';
import Modal from '../../components/ui/Modal.jsx';

const EMPTY = { name: '', price: '', durationMonths: '1', description: '' };
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function PlansPage() {
  const qc = useQueryClient();
  const { data: plans = [], isLoading } = useQuery({ queryKey: ['owner-plans'], queryFn: ownerApi.listPlans });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // plan _id when editing
  const [form, setForm] = useState(EMPTY);

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        price: Number(form.price) || 0,
        durationMonths: Number(form.durationMonths) || 1,
        description: form.description,
      };
      return editing ? ownerApi.updatePlan(editing, payload) : ownerApi.createPlan(payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Plan updated' : 'Plan created');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['owner-plans'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (plan) => ownerApi.updatePlan(plan._id, { isActive: !plan.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owner-plans'] }),
    onError: (e) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (p) => {
    setEditing(p._id);
    setForm({ name: p.name, price: String(p.price ?? ''), durationMonths: String(p.durationMonths ?? 1), description: p.description || '' });
    setOpen(true);
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Subscription Plans</h1>
          <p className="text-sm text-slate-500">Billing is manual — assign a plan when recording a company's payment.</p>
        </div>
        <button className="btn-primary flex items-center gap-1.5" onClick={openNew}>
          <Plus size={16} /> New Plan
        </button>
      </div>

      <div className="card card-flush overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Duration</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>}
            {!isLoading && !plans.length && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No plans yet — create one to start assigning subscriptions.</td></tr>
            )}
            {plans.map((p) => (
              <tr key={p._id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-900">{p.name}</p>
                  {p.description && <p className="text-xs text-slate-500">{p.description}</p>}
                </td>
                <td className="px-4 py-3 font-medium">{inr(p.price)}</td>
                <td className="px-4 py-3">{p.durationMonths} month{p.durationMonths > 1 ? 's' : ''}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleMut.mutate(p)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      p.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {p.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-slate-400 hover:text-slate-700" onClick={() => openEdit(p)}>
                    <Pencil size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Plan' : 'New Plan'}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); saveMut.mutate(); }}>
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Pro" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Price (₹)</label>
              <input className="input" type="number" min="0" value={form.price} onChange={set('price')} required />
            </div>
            <div>
              <label className="label">Duration (months)</label>
              <input className="input" type="number" min="1" value={form.durationMonths} onChange={set('durationMonths')} required />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={set('description')} placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saveMut.isPending}>
              {saveMut.isPending ? 'Saving…' : 'Save Plan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
