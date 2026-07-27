import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ArrowLeft, Ban, CheckCircle2, CreditCard, Pencil } from 'lucide-react';
import { ownerApi } from '../../api/owner.js';
import Modal from '../../components/ui/Modal.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';
import { SubscriptionBadge } from './CompaniesListPage.jsx';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export default function CompanyDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ['owner-org', id], queryFn: () => ownerApi.getOrganization(id) });
  const { data: plans = [] } = useQuery({ queryKey: ['owner-plans'], queryFn: ownerApi.listPlans });

  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ planId: '', months: '', amount: '', paidOn: '', notes: '' });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['owner-org', id] });
    qc.invalidateQueries({ queryKey: ['owner-orgs'] });
  };

  const updateMut = useMutation({
    mutationFn: (payload) => ownerApi.updateOrganization(id, payload),
    onSuccess: () => { toast.success('Company updated'); setRenameOpen(false); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const payMut = useMutation({
    mutationFn: () =>
      ownerApi.recordSubscription(id, {
        planId: pay.planId || undefined,
        months: pay.months ? Number(pay.months) : undefined,
        amount: pay.amount ? Number(pay.amount) : undefined,
        paidOn: pay.paidOn || undefined,
        notes: pay.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Payment recorded — subscription extended');
      setPayOpen(false);
      setPay({ planId: '', months: '', amount: '', paidOn: '', notes: '' });
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <p className="py-10 text-center text-slate-400">Loading…</p>;
  if (!data) return <p className="py-10 text-center text-slate-400">Company not found.</p>;

  const { organization: org, users = [], subscriptionPayments = [] } = data;

  const toggleActive = async () => {
    const suspending = org.isActive;
    const okay = await confirm({
      title: suspending ? 'Suspend this company?' : 'Reactivate this company?',
      message: suspending
        ? `All ${org.name} users will be locked out immediately until reactivated.`
        : `${org.name} users will be able to log in again.`,
      confirmLabel: suspending ? 'Suspend' : 'Reactivate',
      danger: suspending,
    });
    if (okay) updateMut.mutate({ isActive: !suspending });
  };

  const selectedPlan = plans.find((p) => p._id === pay.planId);

  return (
    <div>
      <Link to="/owner/companies" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> All companies
      </Link>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-slate-900">{org.name}</h1>
        <SubscriptionBadge org={org} />
        <div className="ml-auto flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            onClick={() => { setName(org.name); setRenameOpen(true); }}
          >
            <Pencil size={14} /> Rename
          </button>
          <button
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
              org.isActive
                ? 'border border-red-200 text-red-600 hover:bg-red-50'
                : 'border border-emerald-200 text-emerald-600 hover:bg-emerald-50'
            }`}
            onClick={toggleActive}
          >
            {org.isActive ? <><Ban size={14} /> Suspend</> : <><CheckCircle2 size={14} /> Reactivate</>}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Users', org.users ?? users.length],
          ['Trip Queries', org.queries ?? 0],
          ['Bookings', org.bookings ?? 0],
          ['Created', fmtDate(org.createdAt)],
        ].map(([k, v]) => (
          <div key={k} className="card px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k}</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{v}</p>
          </div>
        ))}
      </div>

      {/* Subscription */}
      <div className="card card-flush mb-6">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="font-semibold text-slate-900">Subscription</h2>
          <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={() => setPayOpen(true)}>
            <CreditCard size={15} /> Record Payment
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Plan</p>
            <p className="mt-0.5 font-medium text-slate-900">{org.subscription?.planName || 'No plan'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Expires</p>
            <p className="mt-0.5 font-medium text-slate-900">
              {org.subscription?.expiresAt ? fmtDate(org.subscription.expiresAt) : 'Never'}
            </p>
          </div>
        </div>
        {subscriptionPayments.length > 0 && (
          <div className="border-t border-slate-100 px-5 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Payment History</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="py-1.5 pr-4">Date</th>
                  <th className="py-1.5 pr-4">Plan</th>
                  <th className="py-1.5 pr-4">Months</th>
                  <th className="py-1.5 pr-4">Amount</th>
                  <th className="py-1.5">Notes</th>
                </tr>
              </thead>
              <tbody>
                {subscriptionPayments.map((p) => (
                  <tr key={p._id} className="border-t border-slate-100">
                    <td className="py-2 pr-4">{fmtDate(p.paidOn)}</td>
                    <td className="py-2 pr-4">{p.planName || p.plan?.name || '—'}</td>
                    <td className="py-2 pr-4">{p.months}</td>
                    <td className="py-2 pr-4 font-medium">{inr(p.amount)}</td>
                    <td className="py-2 text-slate-500">{p.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Users */}
      <div className="card card-flush">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="font-semibold text-slate-900">Users ({users.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="px-5 py-2.5">Name</th>
              <th className="px-5 py-2.5">Email</th>
              <th className="px-5 py-2.5">Role</th>
              <th className="px-5 py-2.5">Last Login</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-2.5 font-medium text-slate-900">{u.name}</td>
                <td className="px-5 py-2.5 text-slate-600">{u.email}</td>
                <td className="px-5 py-2.5 capitalize">{u.role}</td>
                <td className="px-5 py-2.5 text-slate-500">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : 'Never'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rename modal */}
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename Company">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); updateMut.mutate({ name }); }}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" onClick={() => setRenameOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={updateMut.isPending}>Save</button>
          </div>
        </form>
      </Modal>

      {/* Record payment modal */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Record Subscription Payment">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); payMut.mutate(); }}>
          <div>
            <label className="label">Plan</label>
            <select className="input" value={pay.planId} onChange={(e) => setPay((f) => ({ ...f, planId: e.target.value }))}>
              <option value="">Keep current plan</option>
              {plans.filter((p) => p.isActive).map((p) => (
                <option key={p._id} value={p._id}>{p.name} — ₹{p.price} / {p.durationMonths} mo</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Months</label>
              <input
                className="input" type="number" min="1"
                placeholder={selectedPlan ? String(selectedPlan.durationMonths) : '1'}
                value={pay.months}
                onChange={(e) => setPay((f) => ({ ...f, months: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Amount (₹)</label>
              <input
                className="input" type="number" min="0"
                placeholder={selectedPlan ? String(selectedPlan.price) : '0'}
                value={pay.amount}
                onChange={(e) => setPay((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Paid On</label>
            <input className="input" type="date" value={pay.paidOn} onChange={(e) => setPay((f) => ({ ...f, paidOn: e.target.value }))} />
          </div>
          <div>
            <label className="label">Notes (UTR / reference)</label>
            <input className="input" value={pay.notes} onChange={(e) => setPay((f) => ({ ...f, notes: e.target.value }))} placeholder="Bank transfer ref…" />
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            The expiry extends from the current expiry date while the subscription is still active, or from today if it has lapsed.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" onClick={() => setPayOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={payMut.isPending}>
              {payMut.isPending ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
