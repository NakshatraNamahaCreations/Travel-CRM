import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, MoreVertical, Power, Trash2, ImagePlus, ImageOff, RefreshCw, GripVertical, User } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { activitiesApi } from '../../api/services.js';
import Modal from '../../components/ui/Modal.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';
import { cn } from '../../lib/cn.js';

const dt = (d) => (d ? format(new Date(d), 'd MMM, yyyy') : null);

function TicketMenu({ ticket, onImage, onToggle, onDelete, editTo }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const Item = ({ icon: Icon, children, onClick, to, danger }) => {
    const cls = cn('flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm', danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50');
    return to
      ? <Link to={to} onClick={() => setOpen(false)} className={cls}><Icon size={15} className={danger ? '' : 'text-slate-400'} />{children}</Link>
      : <button onClick={() => { setOpen(false); onClick(); }} className={cls}><Icon size={15} className={danger ? '' : 'text-slate-400'} />{children}</button>;
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><MoreVertical size={16} /></button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <Item icon={Pencil} to={editTo}>Edit</Item>
          <Item icon={ImagePlus} onClick={onImage}>{ticket.imageUrl ? 'Change Image' : 'Add Image'}</Item>
          <Item icon={Power} onClick={onToggle}>{ticket.isActive === false ? 'Enable' : 'Disable'}</Item>
          <div className="my-1 border-t border-slate-100" />
          <Item icon={Trash2} onClick={onDelete} danger>Delete</Item>
        </div>
      )}
    </div>
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

      <div className="mx-auto max-w-5xl px-6 py-6">
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
                          editTo={`/services/activities/${id}/edit`}
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
            <input className="input" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="https://…" autoFocus />
            <p className="mt-1 text-xs text-slate-400">Paste a public image URL.</p>
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
    </div>
  );
}
