import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, MoreVertical, Power, Trash2, ImagePlus, ImageOff, RefreshCw, GripVertical, User } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { activitiesApi, transportApi } from '../../api/services.js';
import Modal from '../../components/ui/Modal.jsx';
import ImageUrlInput from '../../components/form/ImageUrlInput.jsx';
import RichTextEditor from '../../components/form/RichTextEditor.jsx';
import { DayPicker, IntervalList } from '../../components/form/Repeaters.jsx';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';
import { cn } from '../../lib/cn.js';

const DURATION_UNITS = ['mins', 'hours', 'days'];

const dt = (d) => (d ? format(new Date(d), 'd MMM, yyyy') : null);

function TicketMenu({ ticket, onImage, onToggle, onDelete, onEdit }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const Item = ({ icon: Icon, children, onClick, danger }) => {
    const cls = cn('flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm', danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50');
    return <button onClick={() => { setOpen(false); onClick(); }} className={cls}><Icon size={15} className={danger ? '' : 'text-slate-400'} />{children}</button>;
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><MoreVertical size={16} /></button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <Item icon={Pencil} onClick={onEdit}>Edit</Item>
          <Item icon={ImagePlus} onClick={onImage}>{ticket.imageUrl ? 'Change Image' : 'Add Image'}</Item>
          <Item icon={Power} onClick={onToggle}>{ticket.isActive === false ? 'Enable' : 'Disable'}</Item>
          <div className="my-1 border-t border-slate-100" />
          <Item icon={Trash2} onClick={onDelete} danger>Delete</Item>
        </div>
      )}
    </div>
  );
}

// Edits ONE ticket/package type in a focused popup instead of the whole
// multi-ticket form — some activities (ferry routes) have 15+ ticket types.
function EditTicketTypeModal({ ticket, useSameClosing, onClose, onSave, isPending }) {
  const [f, setF] = useState({
    name: ticket.name || '',
    internalRefCode: ticket.internalRefCode || '',
    forService: ticket.forService || '',
    slots: ticket.slots || '',
    duration: ticket.duration ?? '',
    durationUnit: ticket.durationUnit || 'mins',
    details: ticket.details || '',
    closedDays: ticket.closedDays || [],
    closedDates: ticket.closedDates || [],
  });
  const set = (patch) => setF((s) => ({ ...s, ...patch }));
  const submit = () => onSave({
    ...ticket,
    name: f.name,
    internalRefCode: f.internalRefCode || undefined,
    forService: f.forService || undefined,
    slots: f.slots || undefined,
    duration: f.duration !== '' ? Number(f.duration) : undefined,
    durationUnit: f.durationUnit,
    details: f.details || undefined,
    closedDays: useSameClosing ? [] : f.closedDays,
    closedDates: useSameClosing ? [] : f.closedDates.filter((d) => d.start && d.end),
  });
  return (
    <Modal open onClose={onClose} title="Edit Ticket / Package" width="max-w-2xl">
      <div className="space-y-3">
        <div><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Premium" /></div>
        <div>
          <label className="label">For Service <span className="label-optional">(optional — links this ticket to a transport service, so it shows under that service in quotations)</span></label>
          <AsyncSelect
            loadOptions={async (qs) => {
              const list = (await transportApi.list({ search: qs, limit: 50 }).catch(() => ({ data: [] }))).data || [];
              const names = [...new Set(list.flatMap((s) => (s.items || []).map((it) => it.name)).filter(Boolean))];
              const term = (qs || '').toLowerCase();
              return names.filter((nm) => nm.toLowerCase().includes(term)).map((nm) => ({ _id: nm, name: nm }));
            }}
            value={f.forService ? { _id: f.forService, name: f.forService } : null}
            onChange={(v) => set({ forService: v ? v.name : '' })}
            creatable onCreate={(name) => Promise.resolve({ _id: name, name })}
            placeholder="e.g. Cellular Jail Visit with Sound & Light Show"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Internal Ref Code <span className="label-optional">(optional)</span></label><input className="input" value={f.internalRefCode} onChange={(e) => set({ internalRefCode: e.target.value })} placeholder="e.g. 1PXABC" /></div>
          <div><label className="label">Slots <span className="label-optional">(optional)</span></label><input className="input" value={f.slots} onChange={(e) => set({ slots: e.target.value })} placeholder="11:00, 13:00" /></div>
        </div>
        <div>
          <label className="label">Duration <span className="label-optional">(optional)</span></label>
          <div className="flex gap-2">
            <input type="number" min="0" className="input" value={f.duration} onChange={(e) => set({ duration: e.target.value })} placeholder="30" />
            <select className="input w-28" value={f.durationUnit} onChange={(e) => set({ durationUnit: e.target.value })}>
              {DURATION_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Itinerary/Details <span className="label-optional">(optional)</span></label>
          <RichTextEditor value={f.details} onChange={(html) => set({ details: html })} placeholder="Some details regarding this ticket type" minHeight="90px" />
        </div>
        {!useSameClosing && (
          <>
            <div>
              <label className="label">Closed on Days of Week <span className="label-optional">(optional)</span></label>
              <DayPicker value={f.closedDays} onChange={(v) => set({ closedDays: v })} />
            </div>
            <div>
              <label className="label">Closed on Dates / Intervals</label>
              <IntervalList value={f.closedDates} onChange={(v) => set({ closedDates: v })} />
            </div>
          </>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={submit} disabled={isPending || !f.name.trim()} className="btn-primary">{isPending ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  );
}

function RearrangeModal({ items, isPending, onClose, onSave }) {
  const [order, setOrder] = useState([...items]);
  const dragIdx = useRef(null);
  const onDragStart = (i) => { dragIdx.current = i; };
  const onDragOver = (e, i) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === i) return;
    const next = [...order];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(i, 0, moved);
    dragIdx.current = i;
    setOrder(next);
  };
  const onDragEnd = () => { dragIdx.current = null; };
  return (
    <Modal open onClose={onClose} title="Tickets Re-arrangement">
      <div className="space-y-2 py-1" style={{ minWidth: 380 }}>
        {order.map((it, i) => (
          <div
            key={it._id || i}
            draggable
            onDragStart={() => onDragStart(i)}
            onDragOver={(e) => onDragOver(e, i)}
            onDragEnd={onDragEnd}
            className="flex cursor-grab items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-xs active:cursor-grabbing hover:border-brand-300"
          >
            <span className="shrink-0 text-slate-400">{i + 1}.</span>
            <span className="flex-1 truncate font-medium">{it.name}</span>
            <GripVertical size={16} className="shrink-0 text-slate-300" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={() => onSave(order)} disabled={isPending} className="btn-primary">{isPending ? 'Saving…' : 'Submit'}</button>
      </div>
    </Modal>
  );
}

export default function ActivityDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [tab, setTab] = useState('tickets');
  const [showRearrange, setShowRearrange] = useState(false);
  const [imgTarget, setImgTarget] = useState(null);
  const [imgUrl, setImgUrl] = useState('');
  const [editTicket, setEditTicket] = useState(null); // ticket type being edited in the focused popup

  const { data: a, isLoading } = useQuery({ queryKey: ['activity', id], queryFn: () => activitiesApi.get(id) });

  const refresh = () => qc.invalidateQueries({ queryKey: ['activity', id] });

  const updateMut = useMutation({
    mutationFn: (payload) => activitiesApi.update(id, payload),
    onSuccess: () => { toast.success('Updated'); closeImg(); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const ticketsMut = useMutation({
    mutationFn: ({ ticketTypes }) => activitiesApi.update(id, { ticketTypes }),
    onSuccess: (_r, vars) => { toast.success(vars.msg || 'Updated'); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const openImg = (target) => {
    setImgTarget(target);
    setImgUrl(target.kind === 'header' ? (a.imageUrl || '') : (target.ticket.imageUrl || ''));
  };
  const closeImg = () => { setImgTarget(null); setImgUrl(''); };
  const saveImg = () => {
    const url = imgUrl.trim();
    if (imgTarget.kind === 'header') return updateMut.mutate({ imageUrl: url });
    const ticketTypes = (a.ticketTypes || []).map((t) => (t._id === imgTarget.ticket._id ? { ...t, imageUrl: url } : t));
    updateMut.mutate({ ticketTypes });
  };

  const toggleTicket = (ticket) => {
    const ticketTypes = (a.ticketTypes || []).map((t) => (t._id === ticket._id ? { ...t, isActive: t.isActive === false } : t));
    ticketsMut.mutate({ ticketTypes, msg: ticket.isActive === false ? 'Ticket enabled' : 'Ticket disabled' });
  };
  const deleteTicket = async (ticket) => {
    if (!(await confirm({ title: 'Delete ticket?', message: `"${ticket.name}" will be removed.`, confirmLabel: 'Delete', danger: true }))) return;
    const ticketTypes = (a.ticketTypes || []).filter((t) => t._id !== ticket._id);
    ticketsMut.mutate({ ticketTypes, msg: 'Ticket deleted' });
  };
  const saveEditedTicket = (updated) => {
    const ticketTypes = (a.ticketTypes || []).map((t) => (t._id === updated._id ? updated : t));
    ticketsMut.mutate({ ticketTypes, msg: 'Ticket updated' }, { onSuccess: () => setEditTicket(null) });
  };

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!a) return <div className="py-20 text-center text-gray-500">Activity not found.</div>;

  const tickets = a.ticketTypes || [];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-3">
        <div className="flex items-center gap-3 text-sm">
          <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /></button>
          <span className="font-semibold text-gray-900">Travel Activity Details</span>
          <span className="text-gray-300">›</span>
          <Link to="/services/activities" className="text-gray-500 hover:text-gray-800">Travel Activities</Link>
          <span className="text-gray-300">›</span>
          <span className="text-gray-500">{a.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/services/activities/${id}/edit`} className="btn-secondary text-sm"><Pencil size={13} /> Edit</Link>
          <Link to={`/services/activity-prices?activity=${a._id}`} className="btn-secondary text-sm">View Prices</Link>
        </div>
      </div>

      <div className="px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{a.name}</h1>

            <div className="mt-4 flex flex-wrap gap-8">
              <div>
                <p className="text-xs font-semibold text-brand-600">Trip Destinations</p>
                <p className="mt-0.5 text-sm font-medium text-gray-900">{(a.destinations || []).map((d) => d.name).join(', ') || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-brand-600">Tickets For</p>
                <p className="mt-0.5 text-sm font-medium text-gray-900">{a.ageConfig || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-brand-600">Complimentary Till</p>
                <p className="mt-0.5 text-sm font-medium text-gray-900">{a.complimentaryAge ? `Under ${a.complimentaryAge} yrs` : 'N/A'}</p>
              </div>
            </div>

            {a.createdBy && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-400">Created By</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-800">{a.createdBy.name}</p>
                {a.createdAt && <p className="text-xs text-gray-400">on {dt(a.createdAt)}</p>}
              </div>
            )}
          </div>

          {/* Header image */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-40 w-56 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {a.imageUrl
                ? <img src={a.imageUrl} alt="" className="h-full w-full object-cover" />
                : <ImageOff size={32} className="text-slate-300" />}
            </div>
            <button onClick={() => openImg({ kind: 'header' })} className="btn-secondary text-sm">{a.imageUrl ? 'Change Image' : 'Add Image'}</button>
            <p className="max-w-[14rem] text-center text-[11px] text-gray-400">ⓘ Fallback image when individual tickets/packages image is not available.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-6 border-b border-slate-200">
          {[['tickets', 'Tickets/Packages'], ['log', 'Log']].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn('relative -mb-px border-b-2 px-1 py-2.5 text-sm font-medium transition-colors',
                tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'tickets' ? (
          <>
            <div className="mt-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Tickets/Packages</h2>
              {tickets.length > 1 && (
                <button onClick={() => setShowRearrange(true)} className="btn-secondary text-sm">Re-arrange Tickets</button>
              )}
            </div>

            <div className="mt-3 space-y-3">
              {tickets.map((t) => (
                <div key={t._id || t.name} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
                  <div className="flex items-start gap-4 p-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-gray-900">{t.name}</h3>
                        <TicketMenu
                          ticket={t}
                          onEdit={() => setEditTicket(t)}
                          onImage={() => openImg({ kind: 'ticket', ticket: t })}
                          onToggle={() => toggleTicket(t)}
                          onDelete={() => deleteTicket(t)}
                        />
                      </div>

                      {t.details
                        ? <div className="rich-content mt-1 text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: t.details }} />
                        : <p className="mt-1 text-sm font-medium text-amber-600">Itinerary N/A</p>
                      }

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                        {t.createdBy && (
                          <span className="inline-flex items-center gap-1">
                            <User size={11} /> Created by {t.createdBy?.name || a.createdBy?.name || '—'}{t.createdAt ? ` on ${dt(t.createdAt)}` : ''}
                          </span>
                        )}
                        {t.updatedAt && <span>• Last Updated on {dt(t.updatedAt)}</span>}
                        {t.isActive === false && <span className="rounded bg-red-50 px-1.5 py-0.5 text-red-600">Disabled</span>}
                      </div>
                    </div>

                    {/* Ticket image */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <div className="flex h-28 w-36 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        {t.imageUrl
                          ? <img src={t.imageUrl} alt="" className="h-full w-full object-cover" />
                          : <ImageOff size={26} className="text-slate-300" />}
                      </div>
                      <button onClick={() => openImg({ kind: 'ticket', ticket: t })} className="btn-secondary text-xs">{t.imageUrl ? 'Change Image' : 'Add Image'}</button>
                    </div>
                  </div>
                </div>
              ))}
              {!tickets.length && <p className="text-sm text-gray-400">No tickets/packages added yet.</p>}
            </div>
          </>
        ) : (
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Log</h2>
              <button onClick={refresh} className="text-gray-400 hover:text-gray-700"><RefreshCw size={14} /></button>
            </div>
            <p className="mt-3 text-sm text-gray-400">No activity log available.</p>
          </div>
        )}
      </div>

      {/* Re-arrange modal */}
      {showRearrange && (
        <RearrangeModal
          items={tickets}
          isPending={ticketsMut.isPending}
          onClose={() => setShowRearrange(false)}
          onSave={(ordered) => {
            ticketsMut.mutate(
              { ticketTypes: ordered, msg: 'Tickets reordered' },
              { onSuccess: () => setShowRearrange(false) }
            );
          }}
        />
      )}

      {/* Image modal */}
      <Modal open={!!imgTarget} onClose={closeImg} title={imgTarget?.kind === 'header' ? 'Activity Image' : 'Ticket Image'}>
        <div className="space-y-3">
          <div>
            <label className="label">Image URL</label>
            <ImageUrlInput value={imgUrl} onChange={setImgUrl} />
          </div>
          {imgUrl.trim() && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <img src={imgUrl} alt="preview" className="max-h-48 w-full object-cover" />
            </div>
          )}
          <div className="flex justify-between pt-1">
            {imgUrl ? <button onClick={() => setImgUrl('')} className="text-sm font-medium text-slate-500 hover:text-slate-800">Clear</button> : <span />}
            <button onClick={saveImg} disabled={updateMut.isPending} className="btn-primary">{updateMut.isPending ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      {editTicket && (
        <EditTicketTypeModal
          ticket={editTicket}
          useSameClosing={a.useSameClosing ?? true}
          isPending={ticketsMut.isPending}
          onClose={() => setEditTicket(null)}
          onSave={saveEditedTicket}
        />
      )}
    </div>
  );
}
