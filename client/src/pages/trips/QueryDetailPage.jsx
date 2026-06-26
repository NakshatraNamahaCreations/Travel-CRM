import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  ArrowLeft, MapPin, Calendar, Users, Phone, Mail, Tag as TagIcon, MessageSquare,
  User as UserIcon, MoreVertical, Pencil, Ban, Plus, FileText, CheckCircle2, Clock, Circle, Trash2, ListChecks, Share2,
  Bed, Bus, Hotel, Plane, CreditCard, History, ChevronRight,
} from 'lucide-react';
import { queriesApi } from '../../api/queries.js';
import { quotesApi } from '../../api/quotes.js';
import { commentsApi } from '../../api/comments.js';
import { installmentsApi } from '../../api/installments.js';
import { activityLogApi } from '../../api/activities.js';
import { usersApi } from '../../api/masterData.js';
import { money } from '../../lib/pricing.js';
import { cn } from '../../lib/cn.js';
import { tripNo } from '../../lib/format.js';
import Modal from '../../components/ui/Modal.jsx';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import SharePackageModal from '../../components/quotes/SharePackageModal.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';

const QUOTE_BADGE = { draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-50 text-blue-700', accepted: 'bg-green-50 text-green-700', rejected: 'bg-red-50 text-red-700' };
// Forward pipeline stages shown in the status dropdown.
const PIPELINE = [
  { value: 'new_query', label: 'New Query' }, { value: 'in_progress', label: 'In Progress' },
  { value: 'converted', label: 'Converted' }, { value: 'on_trip', label: 'On Trip' },
  { value: 'past', label: 'Past Trips' },
];
const TERMINAL_LABEL = { canceled: 'Canceled', dropped: 'Dropped' };
// Drop is allowed before conversion; Cancel only after.
const BEFORE_CONVERT = ['new_query', 'in_progress'];
const AFTER_CONVERT = ['converted', 'on_trip'];

function Field({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={16} className="mt-0.5 text-gray-400" />
      <div><p className="text-xs uppercase tracking-wide text-gray-400">{label}</p><p className="text-sm font-medium text-gray-900">{children || '—'}</p></div>
    </div>
  );
}

function KebabMenu({ status, onEdit, onDrop, onCancel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const canDrop = BEFORE_CONVERT.includes(status);
  const canCancel = AFTER_CONVERT.includes(status);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn-secondary px-2"><MoreVertical size={16} /></button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
          <button onClick={() => { setOpen(false); onEdit(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><Pencil size={14} /> Edit Details</button>
          {canDrop && <button onClick={() => { setOpen(false); onDrop(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"><Ban size={14} /> Drop Query</button>}
          {canCancel && <button onClick={() => { setOpen(false); onCancel(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"><Ban size={14} /> Cancel Trip</button>}
        </div>
      )}
    </div>
  );
}

// Shared modal for the two "lost" outcomes: drop (before convert) / cancel (after convert).
function LostModal({ mode, onClose, onConfirm, pending }) {
  const [reason, setReason] = useState('');
  const [reminderOn, setReminderOn] = useState('');
  const [comments, setComments] = useState('');
  const isCancel = mode === 'canceled';
  const noun = isCancel ? 'Cancellation' : 'Drop';
  return (
    <Modal open={!!mode} onClose={onClose} title={isCancel ? 'Cancel Trip' : 'Drop Query'} width="max-w-xl">
      <div className="space-y-3 rounded-lg bg-amber-50 p-4">
        <p className="text-sm text-amber-700">
          {isCancel
            ? 'Cancel a converted trip when the booking can no longer proceed (e.g. client backed out after confirming).'
            : 'Drop a lead before conversion for reasons like client not interested or plan changed.'}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Reason for {noun}</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={isCancel ? 'e.g. Booking cancelled' : 'e.g. Plan dropped'} /></div>
          <div><label className="label">Contact Reminder On (optional)</label><input type="date" className="input" value={reminderOn} onChange={(e) => setReminderOn(e.target.value)} /></div>
        </div>
        <div><label className="label">Any Comments (optional)</label><textarea rows={2} className="input" value={comments} onChange={(e) => setComments(e.target.value)} placeholder={`More information regarding the ${noun.toLowerCase()}`} /></div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary">Back</button>
          <button onClick={() => onConfirm({ reason, reminderOn, comments })} disabled={pending} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
            {pending ? 'Saving…' : isCancel ? 'Mark as Canceled' : 'Mark as Dropped'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AddCommentModal({ open, onClose, onSave, pending }) {
  const [body, setBody] = useState('');
  const [actionable, setActionable] = useState(true);
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState(null);
  const submit = () => {
    if (!body.trim()) return toast.error('Enter a comment');
    onSave({ body, isActionable: actionable, dueDate: dueDate || undefined, assignedTo: assignee?._id });
    setBody(''); setDueDate(''); setAssignee(null); setActionable(true);
  };
  return (
    <Modal open={open} onClose={onClose} title="Add Task / Comment" width="max-w-2xl">
      <div className="space-y-3">
        <div><label className="label">Comment</label><textarea rows={3} className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body of the comment here…" /></div>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-3">
          <input type="checkbox" checked={actionable} onChange={(e) => setActionable(e.target.checked)} className="mt-0.5" />
          <span><span className="text-sm font-medium text-gray-800">Mark it as actionable comment</span><br /><span className="text-xs text-gray-400">This will make it show up in the demanding comments section</span></span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Due Date (optional)</label><input type="datetime-local" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          <div><label className="label">Assign To (optional)</label><AsyncSelect loadOptions={usersApi.search} value={assignee} onChange={setAssignee} placeholder="Leave empty for yourself" /></div>
        </div>
        <div className="flex justify-end gap-2 pt-1"><button onClick={onClose} className="btn-secondary">Cancel</button><button onClick={submit} disabled={pending} className="btn-primary">{pending ? 'Saving…' : 'Save'}</button></div>
      </div>
    </Modal>
  );
}

const TABS = [
  { key: 'basic', label: 'Basic Details' },
  { key: 'quotes', label: 'All Quotes' },
  { key: 'services', label: 'Services Bookings' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'docs', label: 'Docs' },
  { key: 'activities', label: 'Activities' },
];

const STATUS_BADGE = {
  new_query: 'bg-blue-50 text-blue-700', in_progress: 'bg-amber-50 text-amber-700',
  converted: 'bg-green-50 text-green-700', on_trip: 'bg-purple-50 text-purple-700',
  past: 'bg-gray-100 text-gray-600', canceled: 'bg-red-50 text-red-700', dropped: 'bg-red-50 text-red-700',
};
const ALL_LABEL = { ...TERMINAL_LABEL, ...Object.fromEntries(PIPELINE.map((p) => [p.value, p.label])) };

const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const pkgOf = (quote) => quote?.packages?.[quote.selectedPackageIndex || 0] || quote?.packages?.[0] || null;
const paxLabel = (pax) => pax ? `${pax.adults || 0}A${pax.children?.length ? `, ${pax.children.length}C` : ''}` : '';

export default function QueryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [tab, setTab] = useState('basic');
  const [lostMode, setLostMode] = useState(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [shareQuoteId, setShareQuoteId] = useState(null);

  const { data: q, isLoading } = useQuery({ queryKey: ['query', id], queryFn: () => queriesApi.get(id) });
  const { data: quotes = [] } = useQuery({ queryKey: ['quotes', id], queryFn: () => quotesApi.listForQuery(id), enabled: !!id });
  const { data: comments = [] } = useQuery({ queryKey: ['comments', id], queryFn: () => commentsApi.listForQuery(id), enabled: !!id });

  const selQuoteId = (quotes.find((x) => x.status === 'accepted') || quotes[0])?._id;
  const { data: fullQuote } = useQuery({ queryKey: ['quote-full', selQuoteId], queryFn: () => quotesApi.get(selQuoteId), enabled: !!selQuoteId });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['query', id] });
    qc.invalidateQueries({ queryKey: ['queries'] });
    qc.invalidateQueries({ queryKey: ['query-stats'] });
  };
  const refreshComments = () => qc.invalidateQueries({ queryKey: ['comments', id] });

  const statusMut = useMutation({
    mutationFn: (status) => queriesApi.setStatus(id, status),
    onSuccess: () => { toast.success('Status updated'); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const lostMut = useMutation({
    mutationFn: async ({ reason, reminderOn, comments: c }) => {
      await queriesApi.setStatus(id, lostMode, reason, reminderOn || undefined);
      if (c?.trim()) await commentsApi.create({ query: id, body: `${lostMode === 'canceled' ? 'Cancelled' : 'Dropped'}: ${c}` });
    },
    onSuccess: () => { toast.success(lostMode === 'canceled' ? 'Trip cancelled' : 'Query dropped'); setLostMode(null); refresh(); refreshComments(); },
    onError: (e) => toast.error(e.message),
  });
  const addCommentMut = useMutation({
    mutationFn: (payload) => commentsApi.create({ query: id, ...payload }),
    onSuccess: () => { toast.success('Saved'); setCommentOpen(false); refreshComments(); },
    onError: (e) => toast.error(e.message),
  });
  const toggleResolve = useMutation({ mutationFn: ({ cid, isResolved }) => commentsApi.update(cid, { isResolved }), onSuccess: refreshComments });
  const delComment = useMutation({ mutationFn: (cid) => commentsApi.remove(cid), onSuccess: refreshComments });
  const askDeleteComment = async (cid) => { if (await confirm({ title: 'Delete comment?', message: 'This task/comment will be permanently removed.' })) delComment.mutate(cid); };

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!q) return <div className="py-20 text-center text-gray-500">Query not found.</div>;

  const guestName = [q.guest?.salutation, q.guest?.name].filter(Boolean).join(' ') || 'Unnamed guest';
  const dests = (q.destinations || []).map((d) => d.name).join(', ');
  const pkgTotal = quotes.find((x) => x.status === 'accepted')?.pricing?.total ?? quotes[0]?.pricing?.total ?? 0;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-6 py-2.5 text-sm">
        <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /></button>
        <span className="font-semibold text-gray-900">Trip Details</span>
        <span className="text-gray-400">/</span>
        <Link to="/trips" className="text-gray-500 hover:text-gray-800">Trips</Link>
      </div>

      {/* Header meta */}
      <div className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-lg font-bold text-gray-900">
              # {tripNo(q.queryNumber)} <span className="text-gray-300">•</span> {guestName} <span className="text-gray-300">•</span> <span className="font-semibold">{dests || '—'}</span>
              <span className={cn('rounded px-2 py-0.5 text-xs font-medium', STATUS_BADGE[q.status])}>{ALL_LABEL[q.status] || q.status}</span>
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="flex items-center gap-1"><Calendar size={12} /> {q.startDate ? format(new Date(q.startDate), 'd MMM, yyyy') : 'Flexible'} · {q.nights}N, {q.days}D</span>
              <span className="flex items-center gap-1"><Users size={12} /> {paxLabel(q.pax)}</span>
              <span className="flex items-center gap-1"><Phone size={12} /> {q.guest?.phones?.[0] ? `+${q.guest.phones[0].countryCode} ${q.guest.phones[0].number}` : '—'}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Package (INR)</p>
              <p className="text-lg font-bold text-gray-900">{(pkgTotal || 0).toLocaleString('en-IN')}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Sales / Ops</p>
              <p className="text-sm font-medium text-gray-700">{q.owner?.name || 'Not set'}</p>
            </div>
            <div className="flex items-center gap-2">
              <select className="input w-36" value={q.status} onChange={(e) => statusMut.mutate(e.target.value)} disabled={statusMut.isPending}>
                {PIPELINE.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                {TERMINAL_LABEL[q.status] && <option value={q.status}>{TERMINAL_LABEL[q.status]}</option>}
              </select>
              <KebabMenu status={q.status} onEdit={() => navigate(`/trips/${id}/edit`)} onDrop={() => setLostMode('dropped')} onCancel={() => setLostMode('canceled')} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 overflow-x-auto border-b border-gray-200 bg-white px-6">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn('flex items-center gap-1.5 whitespace-nowrap border-b-2 py-3 text-sm font-medium', tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800')}>
            {t.label}{t.key === 'quotes' && quotes.length ? <span className="rounded-full bg-gray-100 px-1.5 text-xs">{quotes.length}</span> : null}
          </button>
        ))}
      </div>

      <div className="px-6 py-5">
        {tab === 'basic' && (
          <BasicDetailsTab
            q={q} quote={fullQuote} comments={comments}
            onAddComment={() => setCommentOpen(true)}
            onToggleResolve={(cid, isResolved) => toggleResolve.mutate({ cid, isResolved })}
            onDeleteComment={askDeleteComment}
            onSaved={refresh}
          />
        )}
        {tab === 'quotes' && <QuotesTab id={id} quotes={quotes} onShare={setShareQuoteId} />}
        {tab === 'services' && <ServicesBookingsTab quote={fullQuote} startDate={q.startDate} />}
        {tab === 'accounting' && <AccountingTab id={id} />}
        {tab === 'docs' && <DocsTab quotes={quotes} />}
        {tab === 'activities' && <ActivitiesTab id={id} />}
      </div>

      <LostModal mode={lostMode} onClose={() => setLostMode(null)} onConfirm={(d) => lostMut.mutate(d)} pending={lostMut.isPending} />
      <AddCommentModal open={commentOpen} onClose={() => setCommentOpen(false)} onSave={(d) => addCommentMut.mutate(d)} pending={addCommentMut.isPending} />
      <SharePackageModal quoteId={shareQuoteId} open={!!shareQuoteId} onClose={() => setShareQuoteId(null)} />
    </div>
  );
}

/* ----------------------------- Basic Details ----------------------------- */
function BasicDetailsTab({ q, quote, comments, onAddComment, onToggleResolve, onDeleteComment, onSaved }) {
  const pkg = pkgOf(quote);
  const openTasks = comments.filter((c) => c.isActionable && !c.isResolved);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {!quote ? (
          <div className="card p-8 text-center text-sm text-gray-400">No quote yet — <Link to={`/trips/${q._id}/quote/new`} className="font-medium text-brand-600 hover:underline">create the first quote</Link> to see the itinerary here.</div>
        ) : (
          <>
            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Latest Quote</h3>
                <Link to={`/quotes/${quote._id}`} className="btn-secondary text-sm"><Pencil size={14} /> Edit Quote</Link>
              </div>
              <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                <span className="text-xs font-semibold text-green-700">Package Quote Price</span>
                <p className="mt-0.5"><span className="text-lg font-bold text-gray-900">INR {(quote.pricing?.total || 0).toLocaleString('en-IN')}</span> <span className="text-xs text-gray-500">(exc. GST)</span></p>
              </div>
            </div>

            {/* Accommodation */}
            {pkg?.hotels?.length > 0 && (
              <div className="card p-5">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900"><Bed size={16} className="text-brand-500" /> Accommodation</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-gray-400"><tr><th className="py-1.5">Night</th><th>Hotel</th><th>Meal</th><th>Rooms</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {pkg.hotels.map((h, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-2 text-gray-500">{(h.nights || []).join(', ') || '—'}</td>
                          <td className="py-2 pr-2"><span className="font-medium text-gray-900">{h.hotelName}</span>{h.city ? <span className="text-xs text-gray-400"> · {h.city}</span> : ''}</td>
                          <td className="py-2 pr-2">{h.mealPlan || '—'}</td>
                          <td className="py-2 text-gray-600">{h.rooms} {h.roomType || 'Room'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Transportation & Activities */}
            {pkg?.transports?.length > 0 && (
              <div className="card p-5">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900"><Bus size={16} className="text-brand-500" /> Transportation &amp; Activities</h3>
                <div className="space-y-2">
                  {pkg.transports.map((t, i) => (
                    <div key={i} className="rounded-lg border border-gray-100 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-brand-600">Day {t.day || i + 1}</span>
                          <p className="font-medium text-gray-900">{t.serviceLocation || 'Service'}</p>
                          {t.serviceType && <p className="text-xs text-gray-500">{t.serviceType}</p>}
                        </div>
                        <div className="text-right text-xs text-gray-500">{(t.items || []).map((it) => `${it.qty}× ${it.type}`).join(', ')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inclusions / Exclusions */}
            {(quote.inclusions?.length || quote.exclusions?.length) ? (
              <div className="card grid gap-4 p-5 sm:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-green-700">Inclusions</h4>
                  <ul className="space-y-1 text-sm text-gray-600">{(quote.inclusions || []).map((x, i) => <li key={i}>• {x}</li>)}{!quote.inclusions?.length && <li className="text-gray-300">—</li>}</ul>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-red-700">Exclusions</h4>
                  <ul className="space-y-1 text-sm text-gray-600">{(quote.exclusions || []).map((x, i) => <li key={i}>• {x}</li>)}{!quote.exclusions?.length && <li className="text-gray-300">—</li>}</ul>
                </div>
              </div>
            ) : null}

            {quote.terms && (
              <div className="card p-5">
                <h3 className="mb-2 font-semibold text-gray-900">Terms &amp; Conditions</h3>
                <p className="whitespace-pre-wrap text-sm text-gray-600">{quote.terms}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <ArrivalDeparture q={q} onSaved={onSaved} />
        <aside className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900"><ListChecks size={16} /> Tasks &amp; Comments</h3>
            <button onClick={onAddComment} className="btn-secondary text-xs"><Plus size={13} /> Add New</button>
          </div>
          {!comments.length ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto mb-1 text-green-400" size={28} />
              <p className="text-sm font-medium text-gray-700">All caught up!</p>
              <p className="text-xs text-gray-400">Add comments such as follow ups, required actions etc for better trip flow.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {openTasks.length > 0 && <p className="text-xs font-semibold uppercase text-amber-600">Demanding ({openTasks.length})</p>}
              {comments.map((c) => (
                <div key={c._id} className={cn('rounded-lg border p-2.5', c.isActionable && !c.isResolved ? 'border-amber-200 bg-amber-50/50' : 'border-gray-100')}>
                  <div className="flex items-start gap-2">
                    {c.isActionable && (
                      <button onClick={() => onToggleResolve(c._id, !c.isResolved)} title={c.isResolved ? 'Reopen' : 'Resolve'} className="mt-0.5">
                        {c.isResolved ? <CheckCircle2 size={15} className="text-green-500" /> : <Circle size={15} className="text-amber-500" />}
                      </button>
                    )}
                    <div className="flex-1">
                      <p className={cn('text-sm', c.isResolved && 'text-gray-400 line-through')}>{c.body}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                        <span>{c.createdBy?.name || 'You'}</span>
                        {c.dueDate && <span className="flex items-center gap-0.5"><Clock size={10} /> {format(new Date(c.dueDate), 'd MMM, h:mm a')}</span>}
                        {c.assignedTo && <span>→ {c.assignedTo.name}</span>}
                      </div>
                    </div>
                    <button onClick={() => onDeleteComment(c._id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// Editable arrival / departure logistics, saved onto the query.
function ArrivalDeparture({ q, onSaved }) {
  const [edit, setEdit] = useState(null); // 'arrival' | 'departure'
  const [form, setForm] = useState({});
  const mut = useMutation({
    mutationFn: () => queriesApi.update(q._id, { [edit]: form }),
    onSuccess: () => { toast.success('Saved'); setEdit(null); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  const open = (key) => { setForm(q[key] || {}); setEdit(key); };
  const Block = ({ k, title }) => {
    const v = q[k];
    const has = v && (v.reference || v.date || v.time || v.mode);
    return (
      <div className="card p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button onClick={() => open(k)} className="text-gray-400 hover:text-brand-600"><Pencil size={13} /></button>
        </div>
        {has ? (
          <p className="text-sm text-gray-600">{[v.mode, v.reference, v.date && format(new Date(v.date), 'd MMM'), v.time].filter(Boolean).join(' · ')}</p>
        ) : <p className="text-sm text-gray-400">Not Set</p>}
      </div>
    );
  };
  return (
    <>
      <Block k="arrival" title="Arrival Details" />
      <Block k="departure" title="Departure Details" />
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'departure' ? 'Departure Details' : 'Arrival Details'} width="max-w-md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Mode</label><input className="input" value={form.mode || ''} onChange={(e) => setForm({ ...form, mode: e.target.value })} placeholder="Flight / Train" /></div>
            <div><label className="label">Reference</label><input className="input" value={form.reference || ''} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="6E-123 / PNR" /></div>
            <div><label className="label">Date</label><input type="date" className="input" value={form.date ? String(form.date).slice(0, 10) : ''} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><label className="label">Time</label><input className="input" value={form.time || ''} onChange={(e) => setForm({ ...form, time: e.target.value })} placeholder="14:30" /></div>
          </div>
          <div><label className="label">Notes</label><input className="input" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-2 pt-1"><button onClick={() => setEdit(null)} className="btn-secondary">Cancel</button><button onClick={() => mut.mutate()} disabled={mut.isPending} className="btn-primary">{mut.isPending ? 'Saving…' : 'Save'}</button></div>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------- All Quotes ------------------------------ */
function QuotesTab({ id, quotes, onShare }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900"><FileText size={16} /> Quotes <span className="text-sm font-normal text-gray-400">({quotes.length})</span></h3>
        <Link to={`/trips/${id}/quote/new`} className="btn-primary text-sm"><Plus size={15} /> Create Quote</Link>
      </div>
      {!quotes.length ? (
        <p className="py-6 text-center text-sm text-gray-400">No quotes yet. Build the first itinerary &amp; quote.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {quotes.map((quote) => (
            <div key={quote._id} className="flex items-center justify-between py-3">
              <Link to={`/quotes/${quote._id}`} className="flex-1 hover:opacity-80">
                <p className="font-medium text-gray-900">#{quote.quoteNumber} · {quote.title || 'Untitled quote'}</p>
                <p className="text-xs text-gray-400">{quote.days?.length || 0} days · {quote.costItems?.length || 0} cost lines</p>
              </Link>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900">{money(quote.pricing?.total, quote.currency)}</span>
                <span className={cn('rounded px-2 py-0.5 text-xs font-medium', QUOTE_BADGE[quote.status])}>{quote.status}</span>
                <button onClick={() => onShare(quote._id)} title="Share package" className="btn-secondary px-2 py-1 text-xs"><Share2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------- Services Bookings --------------------------- */
function ServicesBookingsTab({ quote, startDate }) {
  const [sub, setSub] = useState('hotels');
  const pkg = pkgOf(quote);
  if (!quote || !pkg) return <div className="card p-8 text-center text-sm text-gray-400">No confirmed quote/booking yet.</div>;

  const stays = (pkg.hotels || []).map((h) => {
    const nights = (h.nights || []).slice().sort((a, b) => a - b);
    const checkIn = startDate ? addDays(startDate, (nights[0] || 1) - 1) : null;
    return { ...h, count: Math.max(1, nights.length), checkIn, checkOut: checkIn ? addDays(checkIn, Math.max(1, nights.length)) : null };
  });
  const fmtD = (d) => (d ? format(new Date(d), 'd MMM') : '—');

  return (
    <div className="flex gap-6">
      <aside className="w-36 shrink-0 space-y-1">
        {[{ k: 'hotels', l: 'Hotels', icon: Hotel }, { k: 'operational', l: 'Operational', icon: Bus }, { k: 'flights', l: 'Flights', icon: Plane }].map((s) => (
          <button key={s.k} onClick={() => setSub(s.k)} className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm', sub === s.k ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-600 hover:bg-gray-50')}><s.icon size={14} /> {s.l}</button>
        ))}
      </aside>
      <div className="min-w-0 flex-1">
        {sub === 'hotels' && (
          <div className="card card-flush overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Hotel</th><th className="px-4 py-3">Stay</th><th className="px-4 py-3">Room / Meal</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {stays.map((h, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><span className="font-medium text-brand-700">{h.hotelName}</span>{h.city ? <div className="text-xs text-gray-400">{h.city}</div> : null}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtD(h.checkIn)} – {fmtD(h.checkOut)} · {h.count}N</td>
                    <td className="px-4 py-3 text-gray-600">{h.rooms} {h.roomType || 'Room'}{h.mealPlan ? ` · ${h.mealPlan}` : ''}</td>
                    <td className="px-4 py-3"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Initialized</span></td>
                  </tr>
                ))}
                {!stays.length && <tr><td colSpan={4} className="py-8 text-center text-gray-400">No hotels.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {sub === 'operational' && (
          <div className="space-y-2">
            {(pkg.transports || []).map((t, i) => (
              <div key={i} className="card flex items-center justify-between p-4">
                <div>
                  <span className="text-xs font-semibold text-brand-600">Day {t.day || i + 1}{startDate ? ` · ${fmtD(addDays(startDate, (t.day || 1) - 1))}` : ''}</span>
                  <p className="font-medium text-gray-900">{t.serviceLocation || 'Service'}</p>
                  {t.serviceType && <p className="text-xs text-gray-500">{t.serviceType}</p>}
                </div>
                <div className="text-right text-sm text-gray-600">{(t.items || []).map((it) => `${it.qty}× ${it.type}`).join(', ')}</div>
              </div>
            ))}
            {!(pkg.transports || []).length && <div className="card p-8 text-center text-sm text-gray-400">No operational services.</div>}
          </div>
        )}
        {sub === 'flights' && (
          <div className="space-y-2">
            {(pkg.flights || []).map((f, i) => (
              <div key={i} className="card flex items-center justify-between p-4"><span className="font-medium text-gray-900">{f.label || 'Flight'}</span><span className="font-semibold text-gray-700">{money(f.given || f.cost, quote.currency)}</span></div>
            ))}
            {!(pkg.flights || []).length && <div className="card p-8 text-center text-sm text-gray-400">No flights added.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Accounting ------------------------------ */
function AccountingTab({ id }) {
  const { data, isLoading } = useQuery({ queryKey: ['inst', id], queryFn: () => installmentsApi.list({ query: id, direction: 'incoming' }) });
  const rows = data?.data || [];
  const total = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const paid = rows.reduce((s, r) => s + (r.paidAmount || 0), 0);
  const dt = (d) => (d ? format(new Date(d), 'd MMM, yyyy') : '—');
  const STATUS = { paid: 'text-green-700 bg-green-50', overdue: 'text-rose-700 bg-rose-50', unverified: 'text-amber-700 bg-amber-50', upcoming: 'text-slate-600 bg-slate-100' };

  return (
    <div className="flex gap-6">
      <aside className="w-40 shrink-0 space-y-1">
        <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">Payments</div>
      </aside>
      <div className="min-w-0 flex-1">
        <h3 className="mb-3 font-semibold text-gray-900">Payments from customer</h3>
        <div className="mb-4 rounded-xl border border-gray-200 bg-white px-5 py-3">
          <p className="text-xs uppercase tracking-wide text-gray-400">INR</p>
          <p className="text-xl font-bold text-gray-900"><span className="text-green-600">+ {paid.toLocaleString('en-IN')}</span> <span className="text-gray-300">/</span> {total.toLocaleString('en-IN')}</p>
        </div>
        {isLoading ? <div className="py-10 text-center text-gray-400">Loading…</div> : !rows.length ? (
          <div className="card p-8 text-center text-sm text-gray-400">No instalment schedule yet. It is generated when the booking is created.</div>
        ) : (
          <div className="card card-flush overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600"><tr><th className="px-4 py-3">Amount (INR)</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Due Date</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td className="px-4 py-3 text-base font-semibold text-gray-900">{(r.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3"><span className={cn('rounded px-2 py-0.5 text-xs font-medium capitalize', STATUS[r.status] || 'bg-slate-100')}>{r.status}</span></td>
                    <td className="px-4 py-3 text-gray-600">{dt(r.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Docs --------------------------------- */
function DocsTab({ quotes }) {
  const accepted = quotes.find((x) => x.status === 'accepted') || quotes[0];
  if (!accepted) return <div className="card p-8 text-center text-sm text-gray-400">No quote to generate documents from yet.</div>;
  return (
    <div className="max-w-xl space-y-2">
      <p className="mb-2 text-sm text-gray-500">Generate trip documents from quote #{accepted.quoteNumber}.</p>
      <Link to={`/quotes/${accepted._id}/quotation`} className="card flex items-center justify-between p-4 hover:border-brand-300"><span className="flex items-center gap-2 font-medium text-gray-800"><FileText size={16} className="text-brand-500" /> Trip Voucher / Quotation</span><ChevronRight size={16} className="text-gray-400" /></Link>
      <Link to={`/quotes/${accepted._id}`} className="card flex items-center justify-between p-4 hover:border-brand-300"><span className="flex items-center gap-2 font-medium text-gray-800"><Share2 size={16} className="text-brand-500" /> Share package (WhatsApp / Email / PDF)</span><ChevronRight size={16} className="text-gray-400" /></Link>
    </div>
  );
}

/* -------------------------------- Activities ------------------------------ */
function ActivitiesTab({ id }) {
  const { data: items = [], isLoading } = useQuery({ queryKey: ['activity-log', id], queryFn: () => activityLogApi.list(id) });
  if (isLoading) return <div className="py-10 text-center text-gray-400">Loading…</div>;
  if (!items.length) return <div className="card p-8 text-center text-sm text-gray-400">No activity recorded yet.</div>;
  return (
    <div className="card p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900"><History size={16} /> Activities <span className="text-sm font-normal text-gray-400">({items.length})</span></h3>
      <ul className="space-y-2.5">
        {items.map((a) => (
          <li key={a._id} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            <span className="text-gray-700"><b>{a.user?.name || 'System'}</b> {a.message} <span className="text-xs text-gray-400">· {format(new Date(a.createdAt), 'd MMM yyyy, h:mm a')}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
