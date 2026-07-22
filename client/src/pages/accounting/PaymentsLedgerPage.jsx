import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { RefreshCw, Download, Phone, FileText, MessageSquarePlus, Check, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { installmentsApi } from '../../api/installments.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { useDebounced } from '../../hooks/useDebounced.js';
import { company } from '../../config/company.js';
import { money } from '../../lib/pricing.js';
import { cn } from '../../lib/cn.js';
import { tripNo } from '../../lib/format.js';
import Modal from '../../components/ui/Modal.jsx';
import AccountSelect from '../../components/form/AccountSelect.jsx';

// Bank accounts (config) + trip/guest accounts (API) merged for the debit/credit pickers.
const BANK_OPTIONS = company.bankAccounts.map((label) => ({ type: 'bank', label, subtitle: 'Manage transactions for the associate bank account' }));

const TABS = [
  ['upcoming', 'Upcoming'], ['past7', 'Past 7 Days'], ['unverified', 'Unverified'],
  ['paid', 'Paid'], ['overdue', 'Overdue'], ['all', 'All'],
];

const rel = (d) => (d ? formatDistanceToNow(new Date(d), { addSuffix: true }) : '—');
const guestLabel = (g) => [g?.salutation, g?.name].filter(Boolean).join(' ') || 'Guest';

function StatusBadge({ inst }) {
  const map = {
    paid: ['bg-green-50 text-green-700', `Paid ${inst.paidOn ? rel(inst.paidOn) : ''}`],
    unverified: ['bg-blue-50 text-blue-700', 'Unverified'],
    overdue: ['bg-amber-50 text-amber-700', 'Overdue'],
    upcoming: ['bg-slate-100 text-slate-600', 'Upcoming'],
  };
  const [cls, label] = map[inst.status] || map.upcoming;
  return <span className={cn('inline-block rounded px-2 py-0.5 text-xs font-medium', cls)}>{label}</span>;
}

function Contact({ inst }) {
  return (
    <div>
      <Link to={inst.query ? `/trips/${inst.query}` : '#'} className="font-medium text-brand-700 hover:underline">
        {tripNo(inst.tripId) || '—'} · {guestLabel(inst.guest)}{inst.destinations?.length ? ` · ${inst.destinations.join(', ')}` : ''}
      </Link>
      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
        {inst.startDate && <span>{format(new Date(inst.startDate), 'd MMM')}</span>}
        {inst.endDate && <span>· {format(new Date(inst.endDate), 'd MMM')}</span>}
        {inst.guest?.phones?.[0] && <Phone size={11} />}
        <span className="h-2 w-2 rounded-full bg-brand-500" />
      </div>
    </div>
  );
}

function LogPaymentModal({ inst, direction, onClose, onSaved }) {
  const [f, setF] = useState({
    debitAccount: company.bankAccounts[0],
    creditAccount: `${guestLabel(inst.guest)} - Trip ID: ${tripNo(inst.tripId)}`,
    paidAmount: inst.amount,
    paidOn: '',
    reference: '',
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const setVal = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const { data: guestAccounts } = useQuery({ queryKey: ['account-options'], queryFn: () => installmentsApi.accounts('') });
  const accountOpts = useMemo(() => [...(guestAccounts || []), ...BANK_OPTIONS], [guestAccounts]);

  const copyPhone = () => {
    const p = inst.guest?.phones?.[0];
    if (!p) return;
    navigator.clipboard.writeText(`+${p.countryCode || '91'} ${p.number}`).then(() => toast.success('Phone copied'));
  };

  const { data: schedule } = useQuery({
    queryKey: ['inst-schedule', inst.booking, direction],
    queryFn: () => installmentsApi.list({ direction, booking: inst.booking, filter: 'all' }),
    enabled: !!inst.booking,
  });
  const rows = schedule?.data?.length ? schedule.data : [inst];
  const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const paidTotal = rows.filter((r) => r.paid).reduce((s, r) => s + (r.paidAmount || r.amount || 0), 0);

  const mut = useMutation({
    mutationFn: () => installmentsApi.logPayment(inst._id, { ...f, paidAmount: Number(f.paidAmount), paidOn: f.paidOn || undefined }),
    onSuccess: () => { toast.success('Payment logged'); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Modal open onClose={onClose} title="Log Payment" width="max-w-2xl">
      <div className="space-y-5">
        {/* Review panel */}
        <div className="rounded-xl border border-slate-200">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600">Please review the full payment details</div>
          <div className="grid gap-4 px-4 py-3 sm:grid-cols-3">
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Due Amount ({inst.currency})</p><p className="text-lg font-bold text-slate-900">{Number(inst.amount).toLocaleString('en-IN')}</p></div>
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Due Date</p><p className="font-semibold text-slate-900">{inst.dueDate ? format(new Date(inst.dueDate), 'd MMM, yyyy') : '—'}</p><p className="text-xs text-slate-400">{rel(inst.dueDate)}</p></div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Contact</p>
              <p className="text-sm font-medium text-brand-700">{tripNo(inst.tripId)} · {guestLabel(inst.guest)}</p>
              {inst.destinations?.length ? <p className="text-xs text-slate-400">{inst.destinations.join(', ')}</p> : null}
              {inst.guest?.phones?.[0] && (
                <button type="button" onClick={copyPhone} title="Copy phone" className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700">
                  <Phone size={11} /> +{inst.guest.phones[0].countryCode || '91'} {inst.guest.phones[0].number} <Copy size={11} />
                </button>
              )}
            </div>
          </div>
          {/* Instalments table */}
          <div className="px-4 pb-3">
            <p className="mb-1 text-xs font-medium text-slate-500">All instalments for this payment</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-400"><tr><th className="py-1">#ID</th><th>Due</th><th className="text-right">Amount ({inst.currency})</th><th className="text-right">Status</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r._id} className="border-t border-slate-100">
                    <td className="py-1.5">{r.installmentNumber} {r._id === inst._id && <span className="ml-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">You are here</span>}</td>
                    <td>{r.dueDate ? format(new Date(r.dueDate), 'd MMM, yyyy') : '—'}</td>
                    <td className="text-right tabular-nums">{Number(r.amount).toLocaleString('en-IN')}</td>
                    <td className="text-right"><StatusBadge inst={r} /></td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200 font-semibold">
                  <td className="py-1.5" colSpan={2}>Total ({inst.currency})</td>
                  <td className="text-right tabular-nums">{total.toLocaleString('en-IN')}</td>
                  <td className="text-right text-xs"><span className="rounded bg-green-50 px-1.5 py-0.5 text-green-700">{paidTotal.toLocaleString('en-IN')}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Transaction details */}
        <div>
          <h4 className="mb-2 font-semibold text-slate-900">Payment Transaction details</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Debit Account</label><AccountSelect value={f.debitAccount} onChange={setVal('debitAccount')} accounts={accountOpts} /></div>
            <div><label className="label">Credit Account</label><AccountSelect value={f.creditAccount} onChange={setVal('creditAccount')} accounts={accountOpts} /></div>
            <div><label className="label">Paid Amount ({inst.currency})</label><input type="number" className="input" value={f.paidAmount} onChange={set('paidAmount')} /></div>
            <div><label className="label">Paid on</label><input type="datetime-local" className="input" value={f.paidOn} onChange={set('paidOn')} /></div>
            <div className="sm:col-span-2"><label className="label">Reference Id <span className="label-optional">(optional)</span></label><input className="input" value={f.reference} onChange={set('reference')} placeholder="Reference Id of the payment" /></div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => mut.mutate()} disabled={mut.isPending} className="btn-primary">{mut.isPending ? 'Saving…' : 'Save'}</button>
          <button onClick={onClose} className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

/* Sembark-style instalment drill-down: amount + Nth instalment badge, trip
   link, contact card, due/paid banner with Log Payment, and Comments /
   Transactions tabs. Opened by clicking the amount in the ledger. */
function InstalmentDetailsModal({ inst, direction, onClose, onLogPayment, onSaved }) {
  const [tab, setTab] = useState('comments');
  const [comments, setComments] = useState(inst.comments || []);
  const [body, setBody] = useState('');

  // Position of this instalment within its booking's schedule → "1st Instalment".
  const { data: schedule } = useQuery({
    queryKey: ['inst-schedule', inst.booking, direction],
    queryFn: () => installmentsApi.list({ direction, booking: inst.booking, filter: 'all' }),
    enabled: !!inst.booking,
  });
  const rows = (schedule?.data?.length ? schedule.data : [inst])
    .slice()
    .sort((a, b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
  const idx = Math.max(0, rows.findIndex((r) => r._id === inst._id));
  const ordLabel = ['1st', '2nd', '3rd'][idx] || `${idx + 1}th`;
  const nights = inst.startDate && inst.endDate
    ? Math.max(0, Math.round((new Date(inst.endDate) - new Date(inst.startDate)) / 86400000))
    : null;

  const commentMut = useMutation({
    mutationFn: () => installmentsApi.addComment(inst._id, body),
    onSuccess: (updated) => {
      setComments(updated?.comments || [...comments, { _id: Date.now(), body, createdAt: new Date() }]);
      setBody('');
      toast.success('Comment added');
      onSaved?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const openReceipt = async () => {
    const t = toast.loading('Preparing receipt…');
    try {
      const blob = await installmentsApi.receipt(inst._id);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      toast.error('Could not generate the receipt');
    } finally {
      toast.dismiss(t);
    }
  };

  const phone = inst.guest?.phones?.[0];

  return (
    <Modal open onClose={onClose} title="Instalment Details" width="max-w-2xl">
      <div className="space-y-4">
        {/* Amount */}
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-900">Instalment Amount ({inst.currency || 'INR'})</h3>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">{ordLabel} Instalment</span>
          </div>
          <p className="mt-0.5"><span className="text-xs font-semibold text-slate-400">{inst.currency || 'INR'}</span> <span className="text-2xl font-bold text-slate-900">{Number(inst.amount).toLocaleString('en-IN')}</span>{inst.paid && inst.paidAmount ? <span className="ml-2 text-sm text-slate-400">{Number(inst.paidAmount).toLocaleString('en-IN')} paid</span> : null}</p>
          <Link to={inst.query ? `/trips/${inst.query}` : '#'} onClick={onClose} className="mt-1 inline-block text-sm font-semibold text-brand-700 hover:underline">
            For Trip {tripNo(inst.tripId)}{inst.destinations?.length ? ` • ${inst.destinations.join(', ')}` : ''}{nights != null ? ` • ${nights}N, ${nights + 1}D` : ''}
          </Link>
        </div>

        {/* Contact card */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60">
          <div className="flex items-center justify-between px-4 pt-3">
            <p className="font-bold text-slate-900">Contact Details</p>
            <span className="rounded border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{direction === 'incoming' ? 'Guest' : 'Supplier'}</span>
          </div>
          <p className="px-4 py-1.5 text-sm text-slate-800">{direction === 'incoming' ? guestLabel(inst.guest) : inst.supplierName || 'Supplier'}</p>
          <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
            {[
              phone ? `+${phone.countryCode || '91'} ${phone.number}` : null,
              inst.destinations?.join(', ') || null,
              inst.startDate ? `${format(new Date(inst.startDate), 'd MMM')}${inst.endDate ? ` – ${format(new Date(inst.endDate), 'd MMM yyyy')}` : ''}` : null,
            ].filter(Boolean).join(' • ') || '—'}
          </div>
        </div>

        {/* Status banner */}
        {inst.paid ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-green-800"><Check size={15} /> Paid {inst.paidOn ? `on ${format(new Date(inst.paidOn), 'd MMM, yyyy')}` : ''}{inst.reference ? ` · Ref: ${inst.reference}` : ''}</p>
            {direction === 'incoming' && (
              <button onClick={openReceipt} className="rounded-lg border border-green-200 bg-white px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100"><FileText size={12} className="mr-1 inline" /> Receipt</button>
            )}
          </div>
        ) : (
          <div className={cn('rounded-xl border px-4 py-3', inst.status === 'overdue' ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50')}>
            <p className={cn('text-sm font-medium', inst.status === 'overdue' ? 'text-rose-800' : 'text-slate-700')}>
              🕐 Payment {inst.status === 'overdue' ? 'Overdue' : 'Due'} {inst.dueDate ? format(new Date(inst.dueDate), 'd MMM, yyyy') : ''}
            </p>
            <button onClick={onLogPayment} className="btn-primary mt-2 text-sm"><FileText size={13} /> Log Payment</button>
          </div>
        )}

        {/* Tabs */}
        <div>
          <div className="flex gap-6 border-b border-slate-200">
            {[['comments', 'Comments'], ['transactions', 'Transactions']].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={cn('border-b-2 pb-2 text-sm font-semibold', tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>{label}</button>
            ))}
          </div>

          {tab === 'comments' && (
            <div className="pt-3">
              {comments.length ? (
                <div className="mb-3 max-h-44 space-y-2 overflow-y-auto">
                  {comments.map((c) => (
                    <div key={c._id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      {c.body}
                      {c.createdAt && <span className="ml-2 text-xs text-slate-400">{rel(c.createdAt)}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-3 py-4 text-center text-sm text-slate-400">No comments added!</p>
              )}
              <div className="flex gap-2">
                <input className="input flex-1" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment about this payment…" />
                <button onClick={() => body.trim() && commentMut.mutate()} disabled={commentMut.isPending} className="btn-secondary">{commentMut.isPending ? 'Saving…' : 'Add'}</button>
              </div>
            </div>
          )}

          {tab === 'transactions' && (
            <div className="pt-3">
              {inst.paid ? (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-400"><tr><th className="py-1.5">Paid On</th><th>Amount ({inst.currency})</th><th>Debit → Credit</th><th>Reference</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-slate-100">
                      <td className="py-2">{inst.paidOn ? format(new Date(inst.paidOn), 'd MMM, yyyy h:mm a') : '—'}</td>
                      <td className="font-semibold tabular-nums">{Number(inst.paidAmount || inst.amount).toLocaleString('en-IN')}</td>
                      <td className="text-xs text-slate-500">{[inst.debitAccount, inst.creditAccount].filter(Boolean).join(' → ') || '—'}</td>
                      <td className="text-slate-500">{inst.reference || '—'}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="py-4 text-center text-sm text-slate-400">No transactions yet — payment hasn't been logged.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function CommentModal({ inst, onClose, onSaved }) {
  const [body, setBody] = useState('');
  const mut = useMutation({
    mutationFn: () => installmentsApi.addComment(inst._id, body),
    onSuccess: () => { toast.success('Comment added'); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Modal open onClose={onClose} title="Add Comment">
      <div className="space-y-3">
        {inst.comments?.length > 0 && (
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
            {inst.comments.map((c) => <div key={c._id} className="text-sm text-slate-700">• {c.body}</div>)}
          </div>
        )}
        <textarea rows={3} className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment about this payment…" />
        <div className="flex justify-end"><button onClick={() => body.trim() && mut.mutate()} disabled={mut.isPending} className="btn-primary">{mut.isPending ? 'Saving…' : 'Save'}</button></div>
      </div>
    </Modal>
  );
}

export default function PaymentsLedgerPage({ direction }) {
  const { can } = useAuth();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [logFor, setLogFor] = useState(null);
  const [commentFor, setCommentFor] = useState(null);
  const [detailsFor, setDetailsFor] = useState(null);
  const debounced = useDebounced(search);
  const qc = useQueryClient();

  const title = direction === 'incoming' ? 'Incoming Payments' : 'Outgoing Payments';

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['installments', direction, filter, debounced],
    queryFn: () => installmentsApi.list({ direction, filter, search: debounced }),
  });
  const { data: counts } = useQuery({
    queryKey: ['installments-summary', direction],
    queryFn: () => installmentsApi.summary({ direction }),
  });

  const items = data?.data || [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['installments'] });
    qc.invalidateQueries({ queryKey: ['installments-summary'] });
    qc.invalidateQueries({ queryKey: ['inst-schedule'] });
    qc.invalidateQueries({ queryKey: ['bookings'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const verifyMut = useMutation({
    mutationFn: (id) => installmentsApi.verify(id),
    onSuccess: () => { toast.success('Verified'); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const exportCsv = () => {
    const header = ['Installment', 'Amount', 'Currency', 'Due Date', 'Status', 'Trip', 'Contact', 'Paid On', 'Reference'];
    const rows = items.map((i) => [
      i.installmentNumber, i.amount, i.currency, i.dueDate ? format(new Date(i.dueDate), 'yyyy-MM-dd') : '',
      i.status, i.tripId, guestLabel(i.guest), i.paidOn ? format(new Date(i.paidOn), 'yyyy-MM-dd') : '', i.reference || '',
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${direction}-payments-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-56 bg-transparent text-sm outline-none" />
        </div>
      </div>

      <div className="flex">
        {/* Left filter tabs */}
        <aside className="w-44 shrink-0 border-r border-slate-200 py-3">
          {TABS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn('flex w-full items-center justify-between border-l-2 px-5 py-2.5 text-left text-sm',
                filter === k ? 'border-brand-600 bg-brand-50/50 font-semibold text-brand-700' : 'border-transparent text-slate-600 hover:bg-slate-50')}
            >
              {label}
              {counts?.[k] ? <span className="rounded-full bg-slate-200 px-1.5 text-[11px] text-slate-600">{counts[k]}</span> : null}
            </button>
          ))}
        </aside>

        {/* Content */}
        <div className="flex-1 p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-slate-500">
              Showing {items.length} {items.length === 1 ? 'Item' : 'Items'}
              <button onClick={() => refetch()} className="text-slate-400 hover:text-slate-700"><RefreshCw size={14} className={cn(isFetching && 'animate-spin')} /></button>
            </span>
            <button onClick={exportCsv} disabled={!items.length} className="btn-secondary text-sm"><Download size={15} /> Download</button>
          </div>

          <div className="card card-flush overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
                <tr><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Due Date</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Comments</th><th className="px-4 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={5} className="py-12 text-center text-slate-400">Loading…</td></tr>
                ) : items.length === 0 ? (
                  <tr><td colSpan={5} className="py-12 text-center text-slate-400">No payments in this view.</td></tr>
                ) : items.map((i) => (
                  <tr key={i._id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button onClick={() => setDetailsFor(i)} title="View instalment details" className="text-left">
                        <div className="font-semibold text-slate-900 hover:text-brand-700 hover:underline"><span className="text-xs text-slate-400">{i.currency} </span>{Number(i.amount).toLocaleString('en-IN')}</div>
                      </button>
                      <div className="mt-1"><StatusBadge inst={i} /></div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{rel(i.dueDate)}</td>
                    <td className="px-4 py-3"><Contact inst={i} /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => setCommentFor(i)} className="flex items-center gap-1 text-sm text-brand-700 hover:underline">
                        <MessageSquarePlus size={14} /> {i.comments?.length ? `${i.comments.length} comment${i.comments.length === 1 ? '' : 's'}` : 'Add Comment'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {i.status === 'paid' ? (
                        <span className="flex items-center gap-1 text-xs text-green-600"><Check size={14} /> Paid</span>
                      ) : i.status === 'unverified' ? (
                        <button onClick={() => verifyMut.mutate(i._id)} className="btn-secondary text-xs">Verify</button>
                      ) : direction === 'outgoing' && can('payments.create') ? (
                        <button onClick={() => setLogFor(i)} className="btn-secondary text-xs text-brand-700"><FileText size={13} /> Log Payment</button>
                      ) : (
                        <span className="text-xs text-slate-400">Awaiting payment</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {detailsFor && (
        <InstalmentDetailsModal
          inst={detailsFor}
          direction={direction}
          onClose={() => setDetailsFor(null)}
          onLogPayment={() => { setLogFor(detailsFor); setDetailsFor(null); }}
          onSaved={refresh}
        />
      )}
      {logFor && <LogPaymentModal inst={logFor} direction={direction} onClose={() => setLogFor(null)} onSaved={() => { setLogFor(null); refresh(); }} />}
      {commentFor && <CommentModal inst={commentFor} onClose={() => setCommentFor(null)} onSaved={() => { setCommentFor(null); refresh(); }} />}
    </div>
  );
}
