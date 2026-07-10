import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, ImageOff, Pencil, User, RefreshCw, MoreVertical, Power, Trash2, ImagePlus, GripVertical } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { transportApi } from '../../api/services.js';
import { activityLogApi } from '../../api/activities.js';
import Modal from '../../components/ui/Modal.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';
import { cn } from '../../lib/cn.js';

const dt = (d) => (d ? format(new Date(d), 'd MMM, yyyy') : '—');
// Avoid "Route - Route" when the item name equals the route name.
const serviceTitle = (route, item) => (item.name === route ? item.name : `${route} - ${item.name}`);

function ServiceMenu({ item, editTo, onImage, onToggle, onDelete }) {
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
      ? <Link to={to} onClick={() => setOpen(false)} className={cls}><Icon size={15} className={danger ? '' : 'text-slate-400'} /> {children}</Link>
      : <button onClick={() => { setOpen(false); onClick(); }} className={cls}><Icon size={15} className={danger ? '' : 'text-slate-400'} /> {children}</button>;
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Options"><MoreVertical size={16} /></button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <Item icon={Pencil} to={editTo}>Edit Service</Item>
          <Item icon={ImagePlus} onClick={onImage}>{item.imageUrl ? 'Change Image' : 'Add Image'}</Item>
          <Item icon={Power} onClick={onToggle}>{item.isActive === false ? 'Enable' : 'Disable'}</Item>
          <div className="my-1 border-t border-slate-100" />
          <Item icon={Trash2} onClick={onDelete} danger>Delete</Item>
        </div>
      )}
    </div>
  );
}

function RearrangeModal({ items, onClose, onSave, isPending }) {
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
    <Modal open onClose={onClose} title="Services Re-arrangement">
      <div className="space-y-2 py-1" style={{ minWidth: 380 }}>
        {order.map((it, i) => (
          <div
            key={it._id || i}
            draggable
            onDragStart={() => onDragStart(i)}
            onDragOver={(e) => onDragOver(e, i)}
            onDragEnd={onDragEnd}
            className="flex cursor-grab items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-xs active:cursor-grabbing hover:border-brand-300 hover:shadow-soft"
          >
            <span className="shrink-0 text-slate-400">{i + 1}.</span>
            <span className="flex-1 truncate font-medium">{it.name}</span>
            <GripVertical size={16} className="shrink-0 text-slate-300" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={() => onSave(order)} disabled={isPending} className="btn-primary">
          {isPending ? 'Saving…' : 'Submit'}
        </button>
      </div>
    </Modal>
  );
}

function ImageBox({ url, onAdd, size = 'lg' }) {
  const dims = size === 'lg' ? 'h-40 w-full max-w-[260px]' : 'h-28 w-40';
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn('flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50', dims)}>
        {url ? <img src={url} alt="" className="h-full w-full rounded-xl object-cover" /> : <ImageOff size={26} className="text-slate-300" />}
      </div>
      <button onClick={onAdd} className="btn-secondary text-sm">{url ? 'Change Image' : 'Add Image'}</button>
    </div>
  );
}

export default function TransportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [tab, setTab] = useState('services');
  const [disabledOnly, setDisabledOnly] = useState(false);
  const [showRearrange, setShowRearrange] = useState(false);
  const [imgTarget, setImgTarget] = useState(null); // { kind:'header' } | { kind:'item', item } | null
  const [imgUrl, setImgUrl] = useState('');

  const { data: t, isLoading } = useQuery({ queryKey: ['transport', id], queryFn: () => transportApi.get(id) });
  const { data: activities = [], isLoading: logLoading } = useQuery({
    queryKey: ['transport-log', id],
    queryFn: () => activityLogApi.listForTransport(id),
    enabled: tab === 'log',
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['transport', id] });
  const saveMut = useMutation({
    mutationFn: (payload) => transportApi.update(id, payload),
    onSuccess: () => { toast.success('Image updated'); closeImg(); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const openImg = (target) => { setImgTarget(target); setImgUrl(target.kind === 'header' ? (t.imageUrl || '') : (target.item.imageUrl || '')); };
  const closeImg = () => { setImgTarget(null); setImgUrl(''); };
  const saveImg = () => {
    const url = imgUrl.trim();
    if (imgTarget.kind === 'header') return saveMut.mutate({ imageUrl: url });
    const items = (t.items || []).map((it) => (it._id === imgTarget.item._id ? { ...it, imageUrl: url } : it));
    saveMut.mutate({ items });
  };

  // Per-service item actions (toggle active / delete) — sent as a full items array.
  const itemsMut = useMutation({
    mutationFn: ({ items }) => transportApi.update(id, { items }),
    onSuccess: (_r, vars) => { toast.success(vars.msg || 'Updated'); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const toggleItem = (item) => {
    const items = (t.items || []).map((it) => (it._id === item._id ? { ...it, isActive: it.isActive === false } : it));
    itemsMut.mutate({ items, msg: item.isActive === false ? 'Service enabled' : 'Service disabled' });
  };
  const deleteItem = async (item) => {
    if (!(await confirm({ title: 'Delete service?', message: `“${item.name}” will be removed from this transport service.`, confirmLabel: 'Delete', danger: true }))) return;
    const items = (t.items || []).filter((it) => it._id !== item._id);
    itemsMut.mutate({ items, msg: 'Service deleted' });
  };

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!t) return <div className="py-20 text-center text-gray-500">Service not found.</div>;

  const items = (t.items || []).filter((it) => (disabledOnly ? it.isActive === false : true));
  const disabledCount = (t.items || []).filter((it) => it.isActive === false).length;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-6 py-3 text-sm">
        <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /></button>
        <span className="font-semibold text-gray-900">Service Details</span>
        <span className="text-gray-400">/</span>
        <Link to="/services/transport" className="text-gray-500 hover:text-gray-800">Transport Services</Link>
        <span className="text-gray-400">/</span>
        <span className="text-gray-500">{t.name}</span>
      </div>

      <div className="px-6 py-6">
        {/* Header */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.name}</h1>
            {t.to ? <p className="text-sm text-gray-500">{t.from} → {t.to}</p> : t.from && <p className="text-sm text-gray-500">{t.from}</p>}
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Trip Destinations</p>
            <p className="inline-flex items-center gap-1 text-sm font-medium text-gray-900">
              <MapPin size={13} className="text-gray-400" />{(t.destinations || []).map((d) => d.name).join(', ') || '—'}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-end gap-2">
              <ImageBox url={t.imageUrl} onAdd={() => openImg({ kind: 'header' })} />
              <p className="flex items-center gap-1 text-xs text-gray-400">ⓘ Fallback image when individual service image is not available.</p>
            </div>
            <Link to={`/services/transport/${t._id}/edit`} className="btn-secondary text-sm"><Pencil size={14} /> Edit</Link>
            <Link to={`/services/transport-prices?service=${t._id}`} className="btn-secondary text-sm">View Prices</Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex gap-6 border-b border-slate-200">
          {[['services', 'Services'], ['log', 'Log']].map(([k, label]) => (
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

        {tab === 'services' ? (
          <>
            <div className="mt-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Services</h2>
              <div className="flex items-center gap-4">
                {(t.items || []).length > 1 && (
                  <button onClick={() => setShowRearrange(true)} className="btn-secondary text-sm">
                    Re-arrange Services
                  </button>
                )}
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={disabledOnly} onChange={(e) => setDisabledOnly(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  Only Disabled {disabledCount > 0 && <span className="rounded-full bg-slate-100 px-1.5 text-xs">{disabledCount}</span>}
                </label>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {items.map((it) => (
                <div key={it._id || it.name} className="card flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900">{serviceTitle(t.name, it)}</h3>
                      <ServiceMenu
                        item={it}
                        editTo={`/services/transport/${t._id}/edit`}
                        onImage={() => openImg({ kind: 'item', item: it })}
                        onToggle={() => toggleItem(it)}
                        onDelete={() => deleteItem(it)}
                      />
                    </div>
                    {it.description && <div className="rich-content mt-1 text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: it.description }} />}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1"><User size={12} /> Created by {t.createdBy?.name || '—'}{it.createdAt ? ` on ${dt(it.createdAt)}` : ''}</span>
                      {it.updatedAt && <span>• Last Updated on {dt(it.updatedAt)}</span>}
                    </div>
                    {it.isActive === false && <span className="mt-1 inline-block rounded bg-red-50 px-2 py-0.5 text-xs text-red-600">Disabled</span>}
                  </div>
                  <ImageBox url={it.imageUrl} onAdd={() => openImg({ kind: 'item', item: it })} size="sm" />
                </div>
              ))}
              {!items.length && <p className="text-sm text-gray-400">{disabledOnly ? 'No disabled services.' : 'No services added yet.'}</p>}
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Activities</h2>
              <button onClick={() => qc.invalidateQueries({ queryKey: ['transport-log', id] })} className="text-gray-400 hover:text-gray-700" title="Refresh"><RefreshCw size={14} /></button>
            </div>
            <div className="mt-3">
              {logLoading ? (
                <p className="text-sm text-gray-400">Loading…</p>
              ) : activities.length ? (
                <ul className="space-y-2.5">
                  {activities.map((a) => (
                    <li key={a._id} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                      <span>
                        <span className="font-semibold">{a.user?.name || 'Someone'}</span>{' '}
                        <span className="text-slate-600">{a.message}</span>{' '}
                        <span className="text-slate-400">(on {dt(a.createdAt)})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">No activity yet.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Re-arrange modal */}
      {showRearrange && (
        <RearrangeModal
          items={t.items || []}
          isPending={itemsMut.isPending}
          onClose={() => setShowRearrange(false)}
          onSave={(ordered) => {
            itemsMut.mutate(
              { items: ordered, msg: 'Services reordered' },
              { onSuccess: () => setShowRearrange(false) }
            );
          }}
        />
      )}

      {/* Add/Change image modal (by URL) */}
      <Modal open={!!imgTarget} onClose={closeImg} title={imgTarget?.kind === 'header' ? 'Service Image' : 'Service Item Image'}>
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
            <button onClick={saveImg} disabled={saveMut.isPending} className="btn-primary">{saveMut.isPending ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
