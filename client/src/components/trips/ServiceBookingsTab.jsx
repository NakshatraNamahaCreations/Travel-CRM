import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Hotel, Bus, Pencil, Trash2, Sparkles, User } from 'lucide-react';
import { format, formatDistanceToNow, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import { serviceBookingsApi } from '../../api/serviceBookings.js';
import StarRating from '../ui/StarRating.jsx';
import Modal from '../ui/Modal.jsx';
import { useConfirm } from '../ui/ConfirmProvider.jsx';
import { cn } from '../../lib/cn.js';

const SUBS = [
  { k: 'hotel', l: 'Hotels', icon: Hotel },
  { k: 'operational', l: 'Operational', icon: Bus },
];
const TITLES = { hotel: 'Hotel Bookings', operational: 'Operational Services' };
const ord = (n) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);

const STATUS = {
  initialized: { label: 'Initialized', cls: 'bg-slate-100 text-slate-600' },
  booked: { label: 'Booked', cls: 'bg-amber-50 text-amber-700' },
  confirmed: { label: 'Confirmed', cls: 'bg-green-50 text-green-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600' },
};
const STATUS_KEYS = Object.keys(STATUS);
const money = (n, c = 'INR') => `${c} ${new Intl.NumberFormat('en-IN').format(Math.round(n || 0))}`;
const fmtD = (d) => (d ? format(new Date(d), 'd MMM') : '—');
const ago = (d) => (d ? `${formatDistanceToNow(new Date(d))} ago` : '');

function EditModal({ row, onClose, onSave, saving }) {
  const [f, setF] = useState({ price: row.price ?? 0, tag: row.tag || '', comment: row.comment || '', detail: row.detail || '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title={`Edit — ${row.name || 'Booking'}`}>
      <div className="space-y-3">
        <div><label className="label">Stay / Services</label><input className="input" value={f.detail} onChange={set('detail')} placeholder="CP • 3 Deluxe Room • 1 AWEB" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Booking Price (₹)</label><input type="number" className="input" value={f.price} onChange={set('price')} /></div>
          <div><label className="label">Tag</label><input className="input" value={f.tag} onChange={set('tag')} placeholder="e.g. Paid" /></div>
        </div>
        <div><label className="label">Comment</label><textarea rows={3} className="input" value={f.comment} onChange={set('comment')} placeholder="Notes / follow-up…" /></div>
        <div className="flex justify-end pt-1">
          <button onClick={() => onSave({ price: Number(f.price) || 0, tag: f.tag, comment: f.comment, detail: f.detail })} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </Modal>
  );
}

function StatusSelect({ row, onChange }) {
  return (
    <select
      value={row.status}
      onChange={(e) => onChange(e.target.value)}
      className={cn('cursor-pointer rounded-md border-0 px-2 py-1 text-xs font-semibold focus:ring-2 focus:ring-brand-300', STATUS[row.status]?.cls)}
    >
      {STATUS_KEYS.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
    </select>
  );
}

// Day-grouped operational services (Sembark-style: day chip left, service rows right).
function OperationalGroups({ rows, startDate, onStatus, onEdit, onDelete }) {
  // Older rows have no `day` — derive it from checkIn vs trip start.
  const dayOf = (r) => {
    if (r.day) return r.day;
    if (r.checkIn && startDate) {
      const diff = Math.round((new Date(r.checkIn) - new Date(startDate)) / 86400000);
      if (diff >= 0) return diff + 1;
    }
    return 0;
  };
  const byDay = new Map();
  rows.forEach((r) => {
    const d = dayOf(r);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(r);
  });
  const groups = [...byDay.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <div className="space-y-4">
      {groups.map(([day, groupRows]) => {
        const date = day && startDate ? addDays(new Date(startDate), day - 1) : (groupRows[0]?.checkIn ? new Date(groupRows[0].checkIn) : null);
        return (
          <div key={day} className="flex items-start gap-4">
            <div className="w-24 shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center">
              <p className="text-sm font-semibold text-slate-800">{day ? `${ord(day)} Day` : '—'}</p>
              {date && <p className="text-[11px] text-slate-400">{format(date, 'EEE, d MMM')}</p>}
            </div>
            <div className="card card-flush min-w-0 flex-1 divide-y divide-gray-100">
              {groupRows.map((r) => {
                const [serviceType, cabDetail] = (r.detail || '').split(' — ');
                return (
                  <div key={r._id} className="flex items-start gap-4 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-brand-700">{[r.name, serviceType].filter(Boolean).join(' - ')}</p>
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
                        <User size={10} /> {r.bookedBy?.name || '—'}{r.updatedAt ? ` • ${ago(r.updatedAt)}` : ''}
                      </div>
                    </div>
                    <div className="w-36 shrink-0 text-sm text-gray-600">{cabDetail || serviceType || '—'}</div>
                    <div className="w-32 shrink-0">
                      <StatusSelect row={r} onChange={(status) => onStatus(r, status)} />
                      {r.tag && <span className="mt-1 inline-block rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">{r.tag}</span>}
                    </div>
                    <div className="w-32 shrink-0 text-right">
                      <span className="text-[11px] uppercase text-gray-400">Booking: </span>
                      <span className="font-semibold text-gray-900">{money(r.price, r.currency)}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pt-0.5 text-gray-300">
                      <button onClick={() => onEdit(r)} className="hover:text-brand-600" title="Edit"><Pencil size={14} /></button>
                      <button onClick={() => onDelete(r)} className="hover:text-red-600" title="Remove"><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ServiceBookingsTab({ queryId, quote, startDate }) {
  const [sub, setSub] = useState('hotel');
  const [editRow, setEditRow] = useState(null);
  const qc = useQueryClient();
  const confirm = useConfirm();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['service-bookings', queryId, sub],
    queryFn: () => serviceBookingsApi.list(queryId, sub),
    enabled: !!queryId,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['service-bookings', queryId] });

  const genMut = useMutation({
    // Generate all kinds at once (no kind param) so one click fills Hotels + Operational + Flights.
    mutationFn: () => serviceBookingsApi.generate(queryId, quote._id, null),
    onSuccess: (rows) => { toast.success(rows?.length ? `Generated ${rows.length} booking line(s)` : 'Already generated'); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const updMut = useMutation({
    mutationFn: ({ id, patch }) => serviceBookingsApi.update(id, patch),
    onSuccess: () => { setEditRow(null); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id) => serviceBookingsApi.remove(id),
    onSuccess: () => { toast.success('Removed'); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const askDelete = async (row) => {
    if (await confirm({ title: 'Remove booking line?', message: `“${row.name}” will be removed from bookings.`, confirmLabel: 'Remove', danger: true })) delMut.mutate(row._id);
  };

  const title = TITLES[sub] || SUBS.find((s) => s.k === sub)?.l;
  const canGenerate = !!quote?._id;

  return (
    <div className="flex gap-6">
      <aside className="w-36 shrink-0 space-y-1">
        {SUBS.map((s) => (
          <button key={s.k} onClick={() => setSub(s.k)} className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm', sub === s.k ? 'bg-brand-50 font-semibold text-brand-700' : 'text-gray-600 hover:bg-gray-50')}>
            <s.icon size={14} /> {s.l}
          </button>
        ))}
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        </div>

        {isLoading ? (
          <div className="card p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : !rows.length ? (
          <div className="card flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm text-gray-400">No {title.toLowerCase()} yet.</p>
            {canGenerate ? (
              <button onClick={() => genMut.mutate()} disabled={genMut.isPending} className="btn-primary text-sm"><Sparkles size={14} /> {genMut.isPending ? 'Generating…' : 'Generate from quote'}</button>
            ) : (
              <p className="text-xs text-gray-400">Accept a quote first to generate bookings.</p>
            )}
          </div>
        ) : sub === 'operational' ? (
          <OperationalGroups
            rows={rows}
            startDate={startDate}
            onStatus={(r, status) => updMut.mutate({ id: r._id, patch: { status } })}
            onEdit={setEditRow}
            onDelete={askDelete}
          />
        ) : (
          <div className="card card-flush overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">{sub === 'hotel' ? 'Hotel' : 'Service'}</th>
                  <th className="px-4 py-3">{sub === 'hotel' ? 'Stay and Services' : 'Details'}</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tag / Comments</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r._id} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-brand-700">{r.name}</div>
                      {r.city && <div className="text-xs text-gray-400">{r.city}</div>}
                      {sub === 'hotel' && r.stars ? <StarRating value={r.stars} size={11} /> : null}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {sub === 'hotel' && (r.checkIn || r.checkOut) && (
                        <div className="font-medium text-gray-800">{fmtD(r.checkIn)} – {fmtD(r.checkOut)}{r.nights?.length ? ` · ${r.nights.length}N` : ''}</div>
                      )}
                      {r.detail && <div className="text-xs text-gray-500">{r.detail}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusSelect row={r} onChange={(status) => updMut.mutate({ id: r._id, patch: { status } })} />
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
                        <User size={10} /> {r.bookedBy?.name || '—'}{r.updatedAt ? ` • ${ago(r.updatedAt)}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.tag && <span className="mb-1 inline-block rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">{r.tag}</span>}
                      {r.comment ? <div className="text-xs text-gray-500">{r.comment}</div> : (!r.tag && <span className="text-xs text-gray-300">—</span>)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-[11px] uppercase text-gray-400">Booking</div>
                      <div className="font-semibold text-gray-900">{money(r.price, r.currency)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-300">
                        <button onClick={() => setEditRow(r)} className="hover:text-brand-600" title="Edit"><Pencil size={15} /></button>
                        <button onClick={() => askDelete(r)} className="hover:text-red-600" title="Remove"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editRow && (
        <EditModal
          row={editRow}
          saving={updMut.isPending}
          onClose={() => setEditRow(null)}
          onSave={(patch) => updMut.mutate({ id: editRow._id, patch })}
        />
      )}
    </div>
  );
}
