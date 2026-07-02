import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import {
  ArrowLeft, MapPin, Calendar, Users, Phone, Mail, Tag as TagIcon, MessageSquare,
  User as UserIcon, MoreVertical, Pencil, Ban, Plus, FileText, CheckCircle2, Clock, Circle, Trash2, ListChecks, Share2,
  Bed, Bus, CreditCard, History, ChevronRight, Sparkles,
} from 'lucide-react';
import { queriesApi } from '../../api/queries.js';
import { bookingsApi } from '../../api/bookings.js';
import { quotesApi } from '../../api/quotes.js';
import { commentsApi } from '../../api/comments.js';
import { installmentsApi } from '../../api/installments.js';
import { activityLogApi } from '../../api/activities.js';
import { usersApi } from '../../api/masterData.js';
import { cn } from '../../lib/cn.js';
import { tripNo } from '../../lib/format.js';
import Modal from '../../components/ui/Modal.jsx';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import SharePackageModal from '../../components/quotes/SharePackageModal.jsx';
import ServiceBookingsTab from '../../components/trips/ServiceBookingsTab.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';

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
  { key: 'new_quote', label: 'New Quote' },
  { key: 'services', label: 'Services Bookings' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'docs', label: 'Docs' },
  { key: 'activities', label: 'Activities' },
];
// Tabs that only make sense once the trip is booked (hidden for enquiry-stage trips).
const BOOKING_TABS = ['services', 'accounting', 'docs'];

const STATUS_BADGE = {
  new_query: 'bg-blue-50 text-blue-700', in_progress: 'bg-amber-50 text-amber-700',
  converted: 'bg-green-50 text-green-700', on_trip: 'bg-purple-50 text-purple-700',
  past: 'bg-gray-100 text-gray-600', canceled: 'bg-red-50 text-red-700', dropped: 'bg-red-50 text-red-700',
};
const ALL_LABEL = {
  new_query: 'New Query', in_progress: 'In Progress', converted: 'Converted',
  on_trip: 'On Trip', past: 'Past Trips', ...TERMINAL_LABEL,
};

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

  // Booking-only tabs are hidden while the trip is still an enquiry (new query / in progress);
  // they appear once it's converted/booked.
  const isBooked = ['converted', 'on_trip', 'past'].includes(q.status);
  const visibleTabs = TABS.filter((t) => isBooked || !BOOKING_TABS.includes(t.key));
  const activeTab = visibleTabs.some((t) => t.key === tab) ? tab : 'basic';

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
              <KebabMenu status={q.status} onEdit={() => navigate(`/trips/${id}/edit`)} onDrop={() => setLostMode('dropped')} onCancel={() => setLostMode('canceled')} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 overflow-x-auto border-b border-gray-200 bg-white px-6">
        {visibleTabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn('flex items-center gap-1.5 whitespace-nowrap border-b-2 py-3 text-sm font-medium', activeTab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800')}>
            {t.label}{t.key === 'quotes' && quotes.length ? <span className="rounded-full bg-gray-100 px-1.5 text-xs">{quotes.length}</span> : null}
          </button>
        ))}
      </div>

      <div className="px-6 py-5">
        {activeTab === 'basic' && (
          <BasicDetailsTab
            q={q} quote={fullQuote} comments={comments}
            onAddComment={() => setCommentOpen(true)}
            onToggleResolve={(cid, isResolved) => toggleResolve.mutate({ cid, isResolved })}
            onDeleteComment={askDeleteComment}
            onSaved={refresh}
          />
        )}
        {activeTab === 'quotes' && <QuotesTab id={id} quotes={quotes} onShare={setShareQuoteId} canConvert={BEFORE_CONVERT.includes(q.status)} />}
        {activeTab === 'new_quote' && <NewQuoteTab id={id} />}
        {activeTab === 'services' && <ServiceBookingsTab queryId={id} quote={fullQuote} startDate={q.startDate} />}
        {activeTab === 'accounting' && <AccountingTab id={id} />}
        {activeTab === 'docs' && <DocsTab quotes={quotes} />}
        {activeTab === 'activities' && <ActivitiesTab id={id} />}
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
                  {pkg.transports.map((t, i) => {
                    const dayNos = Array.isArray(t.days) && t.days.length ? t.days : [t.day || i + 1];
                    return (
                      <div key={i} className="rounded-lg border border-gray-100 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold text-brand-600">Day {dayNos.join(', ')}</span>
                            <p className="font-medium text-gray-900">{t.serviceLocation || 'Service'}</p>
                            {t.serviceType && <p className="text-xs text-gray-500">{t.serviceType}</p>}
                          </div>
                          <div className="text-right text-xs text-gray-500">{(t.items || []).map((it) => `${it.qty}× ${it.type}`).join(', ')}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Special inclusions in hotels */}
            {pkg?.inclusions?.length > 0 && (
              <div className="card p-5">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900"><Bed size={16} className="text-brand-500" /> Special Hotel Inclusions</h3>
                <div className="divide-y divide-gray-100">
                  {pkg.inclusions.map((inc, i) => (
                    <div key={i} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="font-medium text-gray-900">{inc.service || 'Service'}</p>
                        <p className="text-xs text-gray-400">{[inc.hotelName, inc.night ? `Night ${inc.night}` : null, inc.comments].filter(Boolean).join(' • ')}</p>
                      </div>
                      <span className="font-semibold text-gray-800">{inc.price ? `₹${Number(inc.price).toLocaleString('en-IN')}` : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other special services */}
            {pkg?.extras?.length > 0 && (
              <div className="card p-5">
                <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900"><Sparkles size={16} className="text-brand-500" /> Other Special Services</h3>
                <div className="divide-y divide-gray-100">
                  {pkg.extras.map((e, i) => (
                    <div key={i} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="font-medium text-gray-900">{e.label || 'Service'}</p>
                        <p className="text-xs text-gray-400">{[e.date ? format(new Date(e.date), 'd MMM, yyyy') : null, e.comments].filter(Boolean).join(' • ')}</p>
                      </div>
                      <span className="font-semibold text-gray-800">{e.price ? `₹${Number(e.price).toLocaleString('en-IN')}` : '—'}</span>
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
const ord = (n) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);

export function QuotesTab({ id, quotes, onShare, canConvert }) {
  // Default selection: the converted (accepted) quote, else the latest.
  const acceptedId = quotes.find((x) => x.status === 'accepted')?._id;
  const [selId, setSelId] = useState(null);
  const activeId = selId && quotes.some((x) => x._id === selId) ? selId : (acceptedId || quotes[0]?._id);

  const { data: sel } = useQuery({ queryKey: ['quote-full', activeId], queryFn: () => quotesApi.get(activeId), enabled: !!activeId });

  if (!quotes.length) {
    return (
      <div className="card p-8 text-center text-sm text-gray-400">
        No quotes yet. <Link to={`/trips/${id}/quote/new`} className="font-medium text-brand-600 hover:underline">Build the first itinerary &amp; quote.</Link>
      </div>
    );
  }

  const latestId = quotes[0]?._id; // list is sorted newest first
  const pkg = pkgOf(sel);
  const hotelTotal = (pkg?.hotels || []).reduce((s, h) => s + (h.amount || 0), 0);
  const startDate = sel?.startDate ? new Date(sel.startDate) : null;

  // Transports grouped by day number for the day-wise listing.
  const byDay = new Map();
  (pkg?.transports || []).forEach((t) => {
    const dayNos = Array.isArray(t.days) && t.days.length ? t.days : [t.day || 1];
    dayNos.forEach((d) => {
      if (!byDay.has(d)) byDay.set(d, []);
      byDay.get(d).push(t);
    });
  });
  const dayGroups = [...byDay.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="flex items-start gap-5">
      {/* ---- Left: quote version list ---- */}
      <aside className="w-44 shrink-0">
        <Link to={`/trips/${id}/quote/new`} className="btn-secondary mb-3 flex w-full items-center justify-center gap-1 text-xs"><Plus size={13} /> New Quote</Link>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {quotes.map((quote) => {
            const isSel = quote._id === activeId;
            const isConverted = quote.status === 'accepted';
            return (
              <button
                key={quote._id}
                onClick={() => setSelId(quote._id)}
                className={cn(
                  'block w-full border-l-[3px] px-3 py-2.5 text-left transition',
                  isSel ? 'border-brand-600 bg-brand-50/60' : 'border-transparent hover:bg-gray-50',
                )}
              >
                <p className={cn('flex items-center gap-1.5 text-lg font-bold leading-tight', isConverted ? 'text-green-600' : 'text-gray-800')}>
                  {(quote.pricing?.total || 0).toLocaleString('en-IN')}
                  {isConverted && <CheckCircle2 size={14} className="shrink-0 text-green-500" title="Used for conversion" />}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {quote.startDate ? format(new Date(quote.startDate), 'd MMM') : 'Flexible'} • {(quote.nights || 0) + 1}D • {paxLabel(quote.pax) || '—'}
                </p>
                <p className="text-[10.5px] text-gray-400">{formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}</p>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ---- Right: selected quote detail ---- */}
      <div className="min-w-0 flex-1">
        {!sel ? (
          <div className="py-16 text-center text-gray-400">Loading quote…</div>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Package Quote Price</h3>
              <div className="flex items-center gap-2">
                <Link to={`/quotes/${sel._id}/edit`} className="btn-primary text-sm"><Pencil size={14} /> Edit Quote</Link>
                <button onClick={() => onShare(sel._id)} className="btn-secondary text-sm"><Share2 size={14} /> Share</button>
              </div>
            </div>

            {/* Price banner — green when this quote won the conversion */}
            <div className={cn(
              'inline-block min-w-[320px] overflow-hidden rounded-lg border',
              sel.status === 'accepted' ? 'border-green-300' : 'border-gray-200',
            )}>
              {sel.status === 'accepted' && (
                <div className="border-b border-green-200 bg-green-50 px-4 py-1.5 text-xs font-semibold text-green-700">Used for Conversion</div>
              )}
              <div className="flex items-baseline gap-2 bg-white px-4 py-3">
                <span className="text-xs font-semibold text-gray-400">{sel.currency || 'INR'}</span>
                <span className="text-xl font-bold text-brand-700">{(sel.pricing?.total || 0).toLocaleString('en-IN')}</span>
                <span className="text-xs text-gray-500">(exc. GST)</span>
                <span className="text-gray-300">/</span>
                <span className="text-xs font-semibold text-gray-400">{sel.currency || 'INR'}</span>
                <span className="text-sm font-semibold text-gray-700">{(sel.pricing?.subtotal || 0).toLocaleString('en-IN')}</span>
                <span className="text-xs text-gray-400">(cost price)</span>
              </div>
            </div>

            <p className="mt-2 text-xs text-gray-400">
              Created {formatDistanceToNow(new Date(sel.createdAt), { addSuffix: true })}{sel.createdBy?.name ? ` by ${sel.createdBy.name}` : ''}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {sel._id === latestId && (
                <span className="inline-block rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-500">Latest Quote</span>
              )}
              {canConvert && (
                <Link to={`/trips/${id}/convert/${sel._id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50">
                  <CheckCircle2 size={13} /> Convert using Quote
                </Link>
              )}
            </div>

            {/* Trip summary strip */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700">
              <span className="flex items-center gap-1.5"><Calendar size={14} className="text-gray-400" /> {startDate ? format(startDate, 'd MMM, yyyy') : 'Flexible'} for {(sel.nights || 0) + 1} Days</span>
              <span className="text-gray-300">•</span>
              <span className="flex items-center gap-1.5"><Users size={14} className="text-gray-400" /> {sel.pax?.adults || 0} Adult{(sel.pax?.adults || 0) !== 1 ? 's' : ''}{sel.pax?.children?.length ? `, ${sel.pax.children.length} Child${sel.pax.children.length !== 1 ? 'ren' : ''}` : ''}</span>
            </div>

            <h3 className="mt-5 text-base font-bold text-gray-900">Services</h3>

            {/* Accommodation */}
            {pkg?.hotels?.length > 0 && (
              <div className="mt-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50"><Bed size={15} className="text-brand-600" /></span>
                  <h4 className="font-semibold text-gray-900">Accommodation</h4>
                </div>
                <div className="card card-flush overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-100 text-left text-xs text-gray-400">
                      <tr><th className="px-4 py-2 font-medium">Night</th><th className="px-4 py-2 font-medium">Hotel</th><th className="px-4 py-2 font-medium">Meal</th><th className="px-4 py-2 font-medium">Rooms</th><th className="px-4 py-2 text-right font-medium">Price</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pkg.hotels.map((h, i) => {
                        const firstNight = (h.nights || [])[0];
                        return (
                          <tr key={i}>
                            <td className="px-4 py-3 align-top">
                              <p className="font-medium text-gray-800">{(h.nights || []).map(ord).join(', ') || '—'}</p>
                              {startDate && firstNight ? <p className="text-xs text-gray-400">{format(addDays(startDate, firstNight - 1), 'd MMM')}</p> : null}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <p className="font-medium text-gray-900">{h.hotelName}</p>
                              <p className="text-xs text-gray-400">{[h.city, h.stars ? `${h.stars} Star` : null].filter(Boolean).join(', ')}</p>
                            </td>
                            <td className="px-4 py-3 align-top text-gray-600">{h.mealPlan || '—'}</td>
                            <td className="px-4 py-3 align-top">
                              <p className="text-gray-800">{h.rooms || 1} {h.roomType || 'Room'}</p>
                              <p className="text-xs text-gray-400">{h.paxPerRoom || 2} Pax{h.aweb ? ` +${h.aweb} AWEB` : ''}{h.cnb ? ` +${h.cnb} CNB` : ''}</p>
                            </td>
                            <td className="px-4 py-3 text-right align-top font-semibold text-gray-900">{h.amount ? `₹${h.amount.toLocaleString('en-IN')}` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 flex justify-end">
                  <span className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">Total: {hotelTotal ? `₹${hotelTotal.toLocaleString('en-IN')}` : 'N/A'}</span>
                </div>
              </div>
            )}

            {/* Transportation & Activities */}
            {dayGroups.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50"><Bus size={15} className="text-brand-600" /></span>
                  <h4 className="font-semibold text-gray-900">Transportation and Activities</h4>
                </div>
                <div className="space-y-3">
                  {dayGroups.map(([day, rows]) => (
                    <div key={day} className="flex gap-4">
                      <div className="w-24 shrink-0 pt-3">
                        <p className="text-sm font-semibold text-gray-800">{ord(day)} Day</p>
                        {startDate && <p className="text-xs text-gray-400">{format(addDays(startDate, day - 1), 'EEE, d MMM')}</p>}
                      </div>
                      <div className="card card-flush min-w-0 flex-1 divide-y divide-gray-100">
                        {rows.map((t, i) => {
                          const amt = (t.items || []).reduce((s, it) => s + (it.amount || 0), 0);
                          return (
                            <div key={i} className="flex items-start justify-between gap-4 px-4 py-3">
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900">{t.serviceLocation || 'Service'}</p>
                                {t.serviceType && <p className="text-xs text-gray-500">{t.serviceType}</p>}
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-sm text-gray-700">{(t.items || []).map((it) => `${it.qty || 1}-${it.type || 'Vehicle'}`).join(', ') || '—'}</p>
                                <p className="text-xs font-semibold text-gray-900">{amt ? `₹${amt.toLocaleString('en-IN')}` : <span className="font-normal text-gray-400">N/A</span>}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Special inclusions + other services */}
            {(pkg?.inclusions?.length > 0 || pkg?.extras?.length > 0) && (
              <div className="mt-5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50"><Sparkles size={15} className="text-brand-600" /></span>
                  <h4 className="font-semibold text-gray-900">Special Services</h4>
                </div>
                <div className="card card-flush divide-y divide-gray-100">
                  {(pkg.inclusions || []).map((inc, i) => (
                    <div key={`inc-${i}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-gray-900">{inc.service || 'Service'}</p>
                        <p className="text-xs text-gray-400">{[inc.hotelName, inc.night ? `Night ${inc.night}` : null].filter(Boolean).join(' • ') || 'Hotel inclusion'}</p>
                      </div>
                      <span className="font-semibold text-gray-800">{inc.price ? `₹${Number(inc.price).toLocaleString('en-IN')}` : '—'}</span>
                    </div>
                  ))}
                  {(pkg.extras || []).map((e, i) => (
                    <div key={`ext-${i}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-gray-900">{e.label || 'Service'}</p>
                        <p className="text-xs text-gray-400">{[e.date ? format(new Date(e.date), 'd MMM') : null, e.comments].filter(Boolean).join(' • ') || 'Trip service'}</p>
                      </div>
                      <span className="font-semibold text-gray-800">{e.price ? `₹${Number(e.price).toLocaleString('en-IN')}` : '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!pkg?.hotels?.length && !dayGroups.length && !pkg?.inclusions?.length && !pkg?.extras?.length && (
              <div className="card mt-3 p-8 text-center text-sm text-gray-400">No services added to this quote yet.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- New Quote ------------------------------ */
// Start a quote from an existing one (searchable suggestions) or from scratch.
function NewQuoteTab({ id }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 350);
    return () => clearTimeout(t);
  }, [term]);

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['quote-suggestions', id, debounced],
    queryFn: () => quotesApi.suggestions({ search: debounced || undefined, exclude: id, limit: 6 }),
  });

  const cloneMut = useMutation({
    mutationFn: (quoteId) => quotesApi.clone(quoteId, id),
    onSuccess: (q) => { toast.success('Quote created — review and adjust it'); navigate(`/quotes/${q._id}/edit`); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-sm font-semibold text-slate-800">To create a quote you can start with the below suggestions.</p>
        <input
          className="input w-72"
          placeholder="Search by trip id or guest name"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-slate-400">Loading suggestions…</div>
      ) : !suggestions.length ? (
        <div className="card p-10 text-center text-sm text-slate-400">No matching quotes found. Create a custom quotation below.</div>
      ) : (
        suggestions.map((sq) => (
          <SuggestionCard key={sq._id} quote={sq} pending={cloneMut.isPending} onUse={() => cloneMut.mutate(sq._id)} />
        ))
      )}

      <div className="mt-6 text-center">
        <Link to={`/trips/${id}/quote/new`} className="btn-primary inline-flex px-6"><Plus size={15} /> Create Custom Quotation</Link>
      </div>
    </div>
  );
}

function SuggestionCard({ quote, onUse, pending }) {
  const [view, setView] = useState('itinerary');
  const pkg = pkgOf(quote);
  const trip = quote.query;
  const dests = (trip?.destinations || []).map((d) => d.name).join(', ');

  // Day-wise lines: prefer the flattened itinerary, fall back to package transports.
  const days = quote.days?.length
    ? quote.days.map((d) => ({ day: d.dayNumber, title: d.title, sub: d.description }))
    : (pkg?.transports || []).map((t, i) => ({
        day: (Array.isArray(t.days) && t.days[0]) || t.day || i + 1,
        title: t.serviceLocation || `Day ${(Array.isArray(t.days) && t.days[0]) || t.day || i + 1}`,
        sub: t.serviceType,
      }));

  return (
    <div className="card mb-4 overflow-hidden">
      {/* Card header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
        <p className="text-sm text-slate-700"><span className="font-bold text-slate-900">{tripNo(trip?.queryNumber)}</span> • {[trip?.guest?.salutation, trip?.guest?.name].filter(Boolean).join(' ') || 'Guest'}</p>
        <div className="flex items-center gap-2 text-xs">
          {dests && <span className="font-medium text-slate-600">{dests}</span>}
          <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-semibold text-slate-500">{quote.nights || 0}N</span>
          <span className="rounded bg-brand-50 px-1.5 py-0.5 font-semibold text-brand-700">₹{(quote.pricing?.total || 0).toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Preview tabs */}
      <div className="flex gap-5 border-b border-slate-100 px-4">
        {['itinerary', 'hotels', 'details'].map((v) => (
          <button key={v} onClick={() => setView(v)} className={cn('border-b-2 py-2 text-sm font-medium capitalize', view === v ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700')}>
            {v}
          </button>
        ))}
      </div>

      <div className="max-h-56 overflow-y-auto px-4 py-3">
        {view === 'itinerary' && (
          days.length ? (
            <div className="space-y-1.5">
              {days.map((d, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 rounded border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700">Day {d.day}</span>
                  <span className="rounded bg-amber-50 px-2 py-0.5 text-[13px] text-slate-700">{d.title}{d.sub ? <span className="text-slate-400"> — {d.sub}</span> : null}</span>
                </div>
              ))}
            </div>
          ) : <p className="py-4 text-center text-xs text-slate-400">No itinerary in this quote.</p>
        )}
        {view === 'hotels' && (
          pkg?.hotels?.length ? (
            <div className="divide-y divide-slate-100">
              {pkg.hotels.map((h, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{h.hotelName}</p>
                    <p className="text-xs text-slate-400">{[h.city, h.roomType, h.mealPlan].filter(Boolean).join(' • ')}</p>
                  </div>
                  <span className="text-xs text-slate-500">{(h.nights || []).length || 1}N • {h.rooms || 1} room(s)</span>
                </div>
              ))}
            </div>
          ) : <p className="py-4 text-center text-xs text-slate-400">No hotels in this quote.</p>
        )}
        {view === 'details' && (
          <div className="grid grid-cols-2 gap-3 py-1 text-sm sm:grid-cols-4">
            <div><p className="text-[11px] uppercase text-slate-400">Duration</p><p className="font-semibold text-slate-800">{(quote.nights || 0) + 1} Days</p></div>
            <div><p className="text-[11px] uppercase text-slate-400">Travelers</p><p className="font-semibold text-slate-800">{quote.pax?.adults || 0} Adult{(quote.pax?.adults || 0) !== 1 ? 's' : ''}{quote.pax?.children?.length ? `, ${quote.pax.children.length} Child` : ''}</p></div>
            <div><p className="text-[11px] uppercase text-slate-400">Package Price</p><p className="font-semibold text-slate-800">₹{(quote.pricing?.total || 0).toLocaleString('en-IN')}</p></div>
            <div><p className="text-[11px] uppercase text-slate-400">Options</p><p className="font-semibold text-slate-800">{quote.packages?.length || 1} Package{(quote.packages?.length || 1) !== 1 ? 's' : ''}</p></div>
          </div>
        )}
      </div>

      <button
        onClick={onUse}
        disabled={pending}
        className="block w-full border-t border-brand-100 bg-brand-50 py-2.5 text-center text-sm font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'Use this Quote'}
      </button>
    </div>
  );
}

/* ------------------------------- Accounting ------------------------------ */

function UpdateScheduleModal({ open, onClose, bookingId, totalAmount, existingRows, onSaved }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState([]);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!open) return;
    setComment('');
    if (existingRows.length) {
      setRows(existingRows.map((r) => ({
        _id: r.paid ? r._id : undefined,
        amount: r.amount,
        dueDate: r.dueDate ? format(new Date(r.dueDate), 'yyyy-MM-dd') : '',
        paid: r.paid,
        percent: totalAmount ? +(r.amount / totalAmount * 100).toFixed(1) : 0,
      })));
    } else {
      // Default 2-instalment schedule: 50% now, 50% on trip start
      const half = Math.round(totalAmount / 2);
      setRows([
        { amount: half, dueDate: '', percent: 50, paid: false },
        { amount: totalAmount - half, dueDate: '', percent: 50, paid: false },
      ]);
    }
  }, [open, existingRows, totalAmount]);

  const ordLabel = (i, len) => {
    if (i === 0) return 'First';
    if (i === len - 1) return 'Last';
    return null;
  };

  const updateRow = (i, field, value) => {
    setRows((prev) => prev.map((r, idx) => {
      if (idx !== i) return r;
      const next = { ...r, [field]: value };
      if (field === 'amount') next.percent = totalAmount ? +(Number(value) / totalAmount * 100).toFixed(1) : 0;
      if (field === 'percent') next.amount = Math.round(totalAmount * Number(value) / 100);
      return next;
    }));
  };

  const addRow = () => setRows((prev) => [...prev, { amount: 0, dueDate: '', percent: 0, paid: false }]);
  const removeRow = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const saveMut = useMutation({
    mutationFn: () => bookingsApi.updateInstalmentSchedule(bookingId, { instalments: rows, comment }),
    onSuccess: () => {
      toast.success('Instalment schedule updated');
      qc.invalidateQueries({ queryKey: ['inst'] });
      onSaved?.();
      onClose();
    },
    onError: (e) => toast.error(e.message || 'Could not save schedule'),
  });

  const rowsSum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const diff = totalAmount - rowsSum;

  return (
    <Modal open={open} onClose={onClose} title="Update Instalments Amount" width="max-w-2xl">
      <div className="space-y-4">
        {/* Total */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3">
          <p className="text-xs font-semibold text-slate-500 mb-1">Total Payment Amount (INR)</p>
          <p className="text-lg font-bold text-slate-900">{Number(totalAmount).toFixed(2)}</p>
        </div>

        {/* Instalment rows */}
        <div>
          <p className="text-sm font-semibold text-gray-800 mb-2">Instalments</p>
          <div className="rounded-lg border border-gray-200">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: '80px' }} />
                <col style={{ width: '160px' }} />
                <col style={{ width: '100px' }} />
                <col />
                <col style={{ width: '28px' }} />
              </colgroup>
              <thead className="bg-slate-100 text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Amount (INR)</th>
                  <th className="px-3 py-2 text-left">%</th>
                  <th className="px-3 py-2 text-left">Due Date</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => {
                  const lbl = ordLabel(i, rows.length);
                  return (
                    <tr key={i} className={r.paid ? 'bg-green-50/40' : ''}>
                      <td className="px-3 py-2.5 text-xs font-medium text-gray-500 align-middle">
                        <div>{i === 0 ? '1st' : i === 1 ? '2nd' : i === 2 ? '3rd' : `${i + 1}th`}</div>
                        {lbl && <div className="mt-0.5 text-[10px] rounded bg-slate-200 text-slate-600 px-1 inline-block">{lbl}</div>}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <input
                          type="number"
                          className="input w-full text-sm disabled:bg-slate-100 disabled:text-slate-500"
                          value={r.amount}
                          disabled={r.paid}
                          onChange={(e) => updateRow(i, 'amount', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <input
                          type="number"
                          step="0.1"
                          className="input w-full text-sm disabled:bg-slate-100"
                          value={r.percent}
                          disabled={r.paid}
                          onChange={(e) => updateRow(i, 'percent', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        {r.paid ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-gray-600">{r.dueDate ? format(new Date(r.dueDate), 'd MMM, yyyy') : '—'}</span>
                            <span className="rounded bg-green-100 text-green-700 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap">Already Paid</span>
                          </div>
                        ) : (
                          <input
                            type="date"
                            className="input w-full text-sm"
                            value={r.dueDate}
                            onChange={(e) => updateRow(i, 'dueDate', e.target.value)}
                          />
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {!r.paid && rows.filter((x) => !x.paid).length > 1 && (
                          <button onClick={() => removeRow(i)} className="text-rose-400 hover:text-rose-600 text-xs">✕</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button onClick={addRow} className="text-xs text-brand-600 hover:underline">+ Add instalment</button>
            {Math.abs(diff) > 0 && (
              <span className={cn('text-xs font-medium', diff > 0 ? 'text-amber-600' : 'text-rose-600')}>
                {diff > 0 ? `Under by ₹${diff.toLocaleString('en-IN')}` : `Over by ₹${Math.abs(diff).toLocaleString('en-IN')}`}
              </span>
            )}
          </div>
        </div>

        {/* Comment */}
        <div>
          <label className="label">Comments</label>
          <textarea
            className="input min-h-[70px] resize-y"
            placeholder="Regarding payment or instalment changes..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="btn-primary">
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function LogPaymentModal({ inst, onClose, onSaved }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    paidAmount: inst?.amount || 0,
    paidOn: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    reference: '',
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => installmentsApi.logPayment(inst._id, { ...f, paidAmount: Number(f.paidAmount) }),
    onSuccess: () => {
      toast.success('Payment logged successfully');
      qc.invalidateQueries({ queryKey: ['inst'] });
      onSaved?.();
      onClose();
    },
    onError: (e) => toast.error(e.message || 'Could not log payment'),
  });

  if (!inst) return null;
  return (
    <Modal open onClose={onClose} title="Log Payment" width="max-w-md">
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">Due Amount (INR)</p>
          <p className="text-xl font-bold text-slate-900">{(inst.amount || 0).toLocaleString('en-IN')}</p>
          {inst.dueDate && (
            <p className="mt-0.5 text-xs text-slate-400">Due: {format(new Date(inst.dueDate), 'd MMM, yyyy')}</p>
          )}
        </div>
        <div>
          <label className="label">Paid Amount (INR)</label>
          <input type="number" className="input" value={f.paidAmount} onChange={set('paidAmount')} />
        </div>
        <div>
          <label className="label">Paid On</label>
          <input type="datetime-local" className="input" value={f.paidOn} onChange={set('paidOn')} />
        </div>
        <div>
          <label className="label">Reference ID <span className="text-slate-400 text-xs">(optional)</span></label>
          <input className="input" placeholder="UTR / cheque / reference number" value={f.reference} onChange={set('reference')} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => mut.mutate()} disabled={mut.isPending || !f.paidAmount} className="btn-primary">
            {mut.isPending ? 'Saving…' : 'Log Payment'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function AccountingTab({ id, bookingId, totalAmount }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['inst', id], queryFn: () => installmentsApi.list({ query: id, direction: 'incoming' }) });
  const rows = data?.data || [];
  const paidTotal = rows.reduce((s, r) => s + (r.paidAmount || 0), 0);
  const scheduleTotal = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const effectiveTotal = totalAmount || scheduleTotal;
  const dt = (d) => (d ? format(new Date(d), 'd MMM, yyyy') : '—');
  const STATUS = { paid: 'text-green-700 bg-green-50', overdue: 'text-rose-700 bg-rose-50', unverified: 'text-amber-700 bg-amber-50', upcoming: 'text-slate-600 bg-slate-100' };
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [payInst, setPayInst] = useState(null); // instalment being paid

  return (
    <div className="flex gap-6">
      <aside className="w-40 shrink-0 space-y-1">
        <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700">Payments</div>
      </aside>
      <div className="min-w-0 flex-1">
        <h3 className="mb-3 font-semibold text-gray-900">Payments from customer</h3>
        <div className="mb-4 rounded-xl border border-gray-200 bg-white px-5 py-3">
          <p className="text-xs uppercase tracking-wide text-gray-400">INR</p>
          <p className="text-xl font-bold text-gray-900">
            <span className="text-green-600">+ {paidTotal.toLocaleString('en-IN')}</span>
            {' '}<span className="text-gray-300">/</span>{' '}
            {effectiveTotal.toLocaleString('en-IN')}
          </p>
        </div>
        {isLoading ? <div className="py-10 text-center text-gray-400">Loading…</div> : !rows.length ? (
          <div className="card p-8 text-center text-sm text-gray-400">No instalment schedule yet. It is generated when the booking is created.</div>
        ) : (
          <div className="card card-flush overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Amount (INR)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Due Date</th>
                  <th className="px-4 py-3">Comments</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r._id}>
                    <td className="px-4 py-3 text-base font-semibold text-gray-900">{(r.amount || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded px-2 py-0.5 text-xs font-medium capitalize', STATUS[r.status] || 'bg-slate-100')}>{r.status}</span>
                      {r.paid && r.paidAmount && (
                        <p className="mt-0.5 text-xs text-green-600">Paid: ₹{r.paidAmount.toLocaleString('en-IN')}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{dt(r.dueDate)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {r.comments?.length ? r.comments[r.comments.length - 1].body : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!r.paid && (
                        <button
                          onClick={() => setPayInst(r)}
                          className="rounded border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
                        >
                          + Add Payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {bookingId && (
          <div className="mt-3">
            <button onClick={() => setScheduleOpen(true)} className="btn-secondary text-sm">
              Update Payment / Instalments
            </button>
          </div>
        )}
      </div>

      {bookingId && (
        <UpdateScheduleModal
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          bookingId={bookingId}
          totalAmount={effectiveTotal}
          existingRows={rows}
        />
      )}
      {payInst && (
        <LogPaymentModal
          inst={payInst}
          onClose={() => setPayInst(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['inst', id] })}
        />
      )}
    </div>
  );
}

/* ---------------------------------- Docs --------------------------------- */
export function DocsTab({ quotes }) {
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
export function ActivitiesTab({ id }) {
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
