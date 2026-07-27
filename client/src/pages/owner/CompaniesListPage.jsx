import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Building2 } from 'lucide-react';
import { ownerApi } from '../../api/owner.js';
import Modal from '../../components/ui/Modal.jsx';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export function SubscriptionBadge({ org }) {
  if (!org.isActive) {
    return <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Suspended</span>;
  }
  const status = org.subscriptionStatus || 'active';
  if (status === 'expired') {
    return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">Expired</span>;
  }
  if (status === 'expiring') {
    return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Expiring soon</span>;
  }
  return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Active</span>;
}

const EMPTY_FORM = { name: '', adminName: '', adminEmail: '', adminPassword: '', planId: '' };

export default function CompaniesListPage() {
  const qc = useQueryClient();
  const { data: orgs = [], isLoading } = useQuery({ queryKey: ['owner-orgs'], queryFn: ownerApi.listOrganizations });
  const { data: plans = [] } = useQuery({ queryKey: ['owner-plans'], queryFn: ownerApi.listPlans });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const createMut = useMutation({
    mutationFn: () => ownerApi.createOrganization({ ...form, planId: form.planId || undefined }),
    onSuccess: () => {
      toast.success('Company created');
      setOpen(false);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ['owner-orgs'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Companies</h1>
          <p className="text-sm text-slate-500">{orgs.length} tenant compan{orgs.length === 1 ? 'y' : 'ies'} on the platform</p>
        </div>
        <button className="btn-primary flex items-center gap-1.5" onClick={() => setOpen(true)}>
          <Plus size={16} /> New Company
        </button>
      </div>

      <div className="card card-flush overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Expires</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>
            )}
            {!isLoading && !orgs.length && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No companies yet — create the first one.</td></tr>
            )}
            {orgs.map((o) => (
              <tr key={o._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <Link to={`/owner/companies/${o._id}`} className="flex items-center gap-2 font-semibold text-brand-700 hover:underline">
                    <Building2 size={15} className="text-slate-400" /> {o.name}
                  </Link>
                </td>
                <td className="px-4 py-3">{o.users ?? 0}</td>
                <td className="px-4 py-3">{o.subscription?.planName || '—'}</td>
                <td className="px-4 py-3">{o.subscription?.expiresAt ? fmtDate(o.subscription.expiresAt) : 'Never'}</td>
                <td className="px-4 py-3"><SubscriptionBadge org={o} /></td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New Company">
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}
        >
          <div>
            <label className="label">Company Name</label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Blue Lagoon Travels" required />
          </div>
          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">First Admin Account</p>
            <div className="space-y-3">
              <input className="input" value={form.adminName} onChange={set('adminName')} placeholder="Admin name" required />
              <input className="input" type="email" value={form.adminEmail} onChange={set('adminEmail')} placeholder="admin@company.com" required />
              <input className="input" type="password" value={form.adminPassword} onChange={set('adminPassword')} placeholder="Password (min 6 chars)" minLength={6} required />
            </div>
          </div>
          <div>
            <label className="label">Plan (optional — record a payment later to activate)</label>
            <select className="input" value={form.planId} onChange={set('planId')}>
              <option value="">No plan (never expires)</option>
              {plans.filter((p) => p.isActive).map((p) => (
                <option key={p._id} value={p._id}>{p.name} — ₹{p.price} / {p.durationMonths} mo</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createMut.isPending}>
              {createMut.isPending ? 'Creating…' : 'Create Company'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
