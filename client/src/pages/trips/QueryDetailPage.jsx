import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  ArrowLeft, MapPin, Calendar, Users, Phone, Mail, Tag as TagIcon, MessageSquare,
  User as UserIcon, MoreVertical, Pencil, Ban, Plus, FileText, CheckCircle2, Clock, Circle, Trash2, ListChecks, Share2,
} from 'lucide-react';
import { queriesApi } from '../../api/queries.js';
import { quotesApi } from '../../api/quotes.js';
import { commentsApi } from '../../api/comments.js';
import { usersApi } from '../../api/masterData.js';
import { money } from '../../lib/pricing.js';
import { cn } from '../../lib/cn.js';
import { tripNo } from '../../lib/format.js';
import Modal from '../../components/ui/Modal.jsx';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import SharePackageModal from '../../components/quotes/SharePackageModal.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';

const QUOTE_BADGE = { draft: 'bg-gray-100 text-gray-600', sent: 'bg-blue-50 text-blue-700', accepted: 'bg-green-50 text-green-700', rejected: 'bg-red-50 text-red-700' };
const STATUS_FLOW = [
  { value: 'new_query', label: 'New Query' }, { value: 'in_progress', label: 'In Progress' },
  { value: 'converted', label: 'Converted' }, { value: 'on_trip', label: 'On Trip' },
  { value: 'past', label: 'Past Trips' }, { value: 'canceled', label: 'Canceled' }, { value: 'dropped', label: 'Dropped' },
];

function Field({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={16} className="mt-0.5 text-gray-400" />
      <div><p className="text-xs uppercase tracking-wide text-gray-400">{label}</p><p className="text-sm font-medium text-gray-900">{children || '—'}</p></div>
    </div>
  );
}

function KebabMenu({ onEdit, onCancel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn-secondary px-2"><MoreVertical size={16} /></button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
          <button onClick={() => { setOpen(false); onEdit(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><Pencil size={14} /> Edit Details</button>
          <button onClick={() => { setOpen(false); onCancel(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"><Ban size={14} /> Cancel Trip</button>
        </div>
      )}
    </div>
  );
}

function CancelModal({ open, onClose, onConfirm, pending }) {
  const [reason, setReason] = useState('');
  const [reminderOn, setReminderOn] = useState('');
  const [comments, setComments] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="Mark Lead / Query as Canceled" width="max-w-xl">
      <div className="space-y-3 rounded-lg bg-amber-50 p-4">
        <p className="text-sm text-amber-700">Leads can be cancelled for reasons like client not interested, plan changed, or already converted elsewhere.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Reason for Cancellation</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Plan Dropped" /></div>
          <div><label className="label">Contact Reminder On (optional)</label><input type="date" className="input" value={reminderOn} onChange={(e) => setReminderOn(e.target.value)} /></div>
        </div>
        <div><label className="label">Any Comments (optional)</label><textarea rows={2} className="input" value={comments} onChange={(e) => setComments(e.target.value)} placeholder="More information regarding the cancellation" /></div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary">Back</button>
          <button onClick={() => onConfirm({ reason, reminderOn, comments })} disabled={pending} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
            {pending ? 'Saving…' : 'Mark as Canceled'}
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

export default function QueryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [shareQuoteId, setShareQuoteId] = useState(null);

  const { data: q, isLoading } = useQuery({ queryKey: ['query', id], queryFn: () => queriesApi.get(id) });
  const { data: quotes = [] } = useQuery({ queryKey: ['quotes', id], queryFn: () => quotesApi.listForQuery(id), enabled: !!id });
  const { data: comments = [] } = useQuery({ queryKey: ['comments', id], queryFn: () => commentsApi.listForQuery(id), enabled: !!id });

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
  const cancelMut = useMutation({
    mutationFn: async ({ reason, reminderOn, comments: c }) => {
      await queriesApi.setStatus(id, 'canceled', reason, reminderOn || undefined);
      if (c?.trim()) await commentsApi.create({ query: id, body: `Cancelled: ${c}` });
    },
    onSuccess: () => { toast.success('Trip cancelled'); setCancelOpen(false); refresh(); refreshComments(); },
    onError: (e) => toast.error(e.message),
  });
  const addCommentMut = useMutation({
    mutationFn: (payload) => commentsApi.create({ query: id, ...payload }),
    onSuccess: () => { toast.success('Saved'); setCommentOpen(false); refreshComments(); },
    onError: (e) => toast.error(e.message),
  });
  const toggleResolve = useMutation({
    mutationFn: ({ cid, isResolved }) => commentsApi.update(cid, { isResolved }),
    onSuccess: refreshComments,
  });
  const delComment = useMutation({ mutationFn: (cid) => commentsApi.remove(cid), onSuccess: refreshComments });
  const askDeleteComment = async (cid) => { if (await confirm({ title: 'Delete comment?', message: 'This task/comment will be permanently removed.' })) delComment.mutate(cid); };

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!q) return <div className="py-20 text-center text-gray-500">Query not found.</div>;

  const guestName = [q.guest?.salutation, q.guest?.name].filter(Boolean).join(' ') || 'Unnamed guest';
  const openTasks = comments.filter((c) => c.isActionable && !c.isResolved);

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-6 py-3 text-sm">
        <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /></button>
        <span className="font-semibold text-gray-900">Trip Details</span>
        <span className="text-gray-400">/</span>
        <Link to="/trips" className="text-gray-500 hover:text-gray-800">Trips</Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-500">#{tripNo(q.queryNumber)}</span>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{guestName}</h1>
              <p className="text-sm text-gray-500">Query #{tripNo(q.queryNumber)} · created {format(new Date(q.createdAt), 'd MMM yyyy')}</p>
            </div>
            <div className="flex items-center gap-2">
              <select className="input w-40" value={q.status} onChange={(e) => statusMut.mutate(e.target.value)} disabled={statusMut.isPending}>
                {STATUS_FLOW.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <KebabMenu onEdit={() => navigate(`/trips/${id}/edit`)} onCancel={() => setCancelOpen(true)} />
            </div>
          </div>

          {q.reminderOn && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700">
              <Clock size={14} /> Contact reminder set for {format(new Date(q.reminderOn), 'd MMM yyyy')}
              {q.lostReason ? ` · Reason: ${q.lostReason}` : ''}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="card space-y-4 p-5">
              <h3 className="font-semibold text-gray-900">Trip</h3>
              <Field icon={MapPin} label="Destinations">{(q.destinations || []).map((d) => d.name).join(', ')}</Field>
              <Field icon={Calendar} label="When">{q.startDate ? format(new Date(q.startDate), 'd MMM yyyy') : 'Flexible'} · {q.nights}N / {q.days}D</Field>
              <Field icon={Users} label="Travellers">
                {q.pax?.adults} adult{q.pax?.adults === 1 ? '' : 's'}
                {q.pax?.children?.length ? `, ${q.pax.children.length} child (ages ${q.pax.children.map((c) => c.age).join(', ')})` : ''}
                {q.foc ? ` · ${q.foc} FOC` : ''}
              </Field>
              <Field icon={TagIcon} label="Source / Tags">{q.source?.name || '—'}{q.tags?.length ? ` · ${q.tags.map((t) => t.name).join(', ')}` : ''}</Field>
            </div>
            <div className="card space-y-4 p-5">
              <h3 className="font-semibold text-gray-900">Guest</h3>
              <Field icon={UserIcon} label="Name">{guestName}</Field>
              <Field icon={Phone} label="Phone">{q.guest?.phones?.map((p) => `+${p.countryCode} ${p.number}`).join(', ')}</Field>
              <Field icon={Mail} label="Email">{q.guest?.email}</Field>
              <Field icon={MapPin} label="Location">{q.guest?.location}</Field>
              <Field icon={UserIcon} label="Sales person">{q.owner?.name}</Field>
            </div>
          </div>

          {/* Quotes */}
          <div className="mt-6 card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-gray-900"><FileText size={16} /> Quotes <span className="text-sm font-normal text-gray-400">({quotes.length})</span></h3>
              <Link to={`/trips/${id}/quote/new`} className="btn-primary text-sm"><Plus size={15} /> Create Quote</Link>
            </div>
            {quotes.length === 0 ? (
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
                      <button onClick={() => setShareQuoteId(quote._id)} title="Share package" className="btn-secondary px-2 py-1 text-xs"><Share2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tasks & Comments sidebar */}
        <aside className="card h-fit p-4 lg:sticky lg:top-20">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900"><ListChecks size={16} /> Tasks &amp; Comments</h3>
            <button onClick={() => setCommentOpen(true)} className="btn-secondary text-xs"><Plus size={13} /> Add New</button>
          </div>
          {comments.length === 0 && !q.comments ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto mb-1 text-green-400" size={28} />
              <p className="text-sm font-medium text-gray-700">All caught up!</p>
              <p className="text-xs text-gray-400">Add follow-ups or required actions for better trip flow.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {q.comments && (
                <div className="rounded-lg border border-gray-100 p-2.5">
                  <div className="flex items-start gap-2">
                    <MessageSquare size={15} className="mt-0.5 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">{q.comments}</p>
                      <p className="mt-1 text-[11px] text-gray-400">{format(new Date(q.createdAt), 'd MMM, h:mm a')} · {q.owner?.name || 'Query note'}</p>
                    </div>
                  </div>
                </div>
              )}
              {openTasks.length > 0 && <p className="text-xs font-semibold uppercase text-amber-600">Demanding ({openTasks.length})</p>}
              {comments.map((c) => (
                <div key={c._id} className={cn('rounded-lg border p-2.5', c.isActionable && !c.isResolved ? 'border-amber-200 bg-amber-50/50' : 'border-gray-100')}>
                  <div className="flex items-start gap-2">
                    {c.isActionable && (
                      <button onClick={() => toggleResolve.mutate({ cid: c._id, isResolved: !c.isResolved })} title={c.isResolved ? 'Reopen' : 'Resolve'} className="mt-0.5">
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
                    <button onClick={() => askDeleteComment(c._id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <CancelModal open={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={(d) => cancelMut.mutate(d)} pending={cancelMut.isPending} />
      <AddCommentModal open={commentOpen} onClose={() => setCommentOpen(false)} onSave={(d) => addCommentMut.mutate(d)} pending={addCommentMut.isPending} />
      <SharePackageModal quoteId={shareQuoteId} open={!!shareQuoteId} onClose={() => setShareQuoteId(null)} />
    </div>
  );
}
