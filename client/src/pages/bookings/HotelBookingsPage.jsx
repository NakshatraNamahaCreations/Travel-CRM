import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw, Pencil, Sparkles, User } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { bookingsApi } from '../../api/bookings.js';
import { serviceBookingsApi } from '../../api/serviceBookings.js';
import { money } from '../../lib/pricing.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { cn } from '../../lib/cn.js';
import Modal from '../../components/ui/Modal.jsx';
import StarRating from '../../components/ui/StarRating.jsx';

const TABS = [
  { key: 'new',         label: 'New' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'booked',      label: 'Booked' },
  { key: 'on_trip',     label: 'On Trip' },
  { key: 'past',        label: 'Past' },
  { key: 'dropped',     label: 'Dropped' },
  { key: 'all',         label: 'All' },
];

// Tabs that are derived from ServiceBooking state — send 'all' to server, filter client-side.
const CLIENT_SIDE_TABS = new Set(['in_progress', 'booked']);

const STATUS = {
  initialized: { label: 'Initialized', cls: 'bg-slate-100 text-slate-600' },
  booked:      { label: 'Booked',      cls: 'bg-amber-50 text-amber-700' },
  confirmed:   { label: 'Confirmed',   cls: 'bg-green-50 text-green-700' },
  cancelled:   { label: 'Cancelled',   cls: 'bg-red-50 text-red-600' },
};
const STATUS_KEYS = Object.keys(STATUS);

const fmtD = (d) => (d ? format(new Date(d), 'd MMM') : '—');
const ago  = (d) => (d ? `${formatDistanceToNow(new Date(d))} ago` : '');
const paxLabel = (pax) => {
  if (!pax) return '';
  const a = pax.adults || 0;
  const c = (pax.children || []).length;
  return `${a}A${c ? `, ${c}C` : ''}`;
};

function StatusSelect({ row, onChange }) {
  return (
    <select
      value={row.status}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'cursor-pointer rounded-md border-0 px-2 py-1 text-xs font-semibold focus:ring-2 focus:ring-brand-300',
        STATUS[row.status]?.cls,
      )}
    >
      {STATUS_KEYS.map((s) => (
        <option key={s} value={s}>{STATUS[s].label}</option>
      ))}
    </select>
  );
}

function EditModal({ row, onClose, onSave, saving }) {
  const [f, setF] = useState({
    price: row.price ?? 0,
    tag: row.tag || '',
    comment: row.comment || '',
    detail: row.detail || '',
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <Modal open onClose={onClose} title={`Edit — ${row.name || 'Booking'}`}>
      <div className="space-y-3">
        <div>
          <label className="label">Stay / Services</label>
          <input className="input" value={f.detail} onChange={set('detail')} placeholder="CP • 3 Deluxe Room • 1 AWEB" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Booking Price (₹)</label>
            <input type="number" className="input" value={f.price} onChange={set('price')} />
          </div>
          <div>
            <label className="label">Tag</label>
            <input className="input" value={f.tag} onChange={set('tag')} placeholder="e.g. Paid" />
          </div>
        </div>
        <div>
          <label className="label">Comment</label>
          <textarea rows={3} className="input" value={f.comment} onChange={set('comment')} placeholder="Notes / follow-up…" />
        </div>
        <div className="flex justify-end pt-1">
          <button
            onClick={() => onSave({ price: Number(f.price) || 0, tag: f.tag, comment: f.comment, detail: f.detail })}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function HotelRow({ h, onEdit, onStatusChange }) {
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-1 py-2.5">
      <div className="min-w-[130px]">
        <div className="font-medium text-slate-800">{h.name}</div>
        {h.city && <div className="text-xs text-slate-400">{h.city}</div>}
        {h.stars ? <StarRating value={h.stars} size={11} /> : null}
      </div>

      <div className="whitespace-nowrap text-xs text-slate-500">
        {h.checkIn || h.checkOut ? `${fmtD(h.checkIn)} – ${fmtD(h.checkOut)}` : '—'}
        {h.nights?.length ? ` · ${h.nights.length}N` : ''}
      </div>

      <div className="flex flex-col gap-0.5">
        <StatusSelect row={h} onChange={onStatusChange} />
        {h.bookedBy?.name && (
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <User size={10} /> {h.bookedBy.name}{h.updatedAt ? ` · ${ago(h.updatedAt)}` : ''}
          </div>
        )}
      </div>

      <div className="flex-1">
        {h.tag && (
          <span className="mb-0.5 inline-block rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">
            {h.tag}
          </span>
        )}
        {h.detail && <div className="text-xs text-slate-500">{h.detail}</div>}
        {h.comment && <div className="mt-0.5 text-xs text-slate-400 italic">{h.comment}</div>}
      </div>

      <button onClick={onEdit} className="mt-0.5 text-slate-300 hover:text-brand-600" title="Edit">
        <Pencil size={14} />
      </button>
    </div>
  );
}

function BookingCard({ b, onEditRow, onStatusChange, onGenerate, generating }) {
  const queryId = b.query?._id || b.query;
  const destinationLabel = (b.destinations || []).map((d) => d?.name).filter(Boolean).join(', ');

  return (
    <div className="card overflow-hidden p-0">
      <div className="grid lg:grid-cols-[240px_1fr]">
        {/* Left: booking summary */}
        <div className="border-b border-slate-100 p-4 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-baseline gap-x-1.5">
            <Link to={`/bookings/${b._id}`} className="font-semibold text-brand-700 hover:underline">
              {b.guest?.name || b.title || 'Guest'}
            </Link>
            {destinationLabel && (
              <span className="text-xs font-medium text-slate-500">• {destinationLabel}</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">
            #{b.bookingNumber}
            {b.query?.source ? ` • ${b.query.source}` : ''}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-800">{money(b.totalAmount, b.currency)}</div>
          <div className="mt-1 text-xs text-slate-500">
            {fmtD(b.startDate)}
            {b.nights ? ` · ${b.nights + 1}D/${b.nights}N` : ''}
            {b.pax ? ` · ${paxLabel(b.pax)}` : ''}
          </div>
          {b.createdAt && (
            <div className="mt-1 text-xs text-slate-400">
              {ago(b.createdAt)}
              {b.owner?.name ? ` by ${b.owner.name}` : ''}
            </div>
          )}
          {b.owner?.name && (
            <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
              <User size={11} /> {b.owner.name}
            </div>
          )}
        </div>

        {/* Right: hotel rows */}
        <div className="p-4">
          {b.hasServiceBookings ? (
            <>
              <div className="mb-2 text-xs font-semibold text-slate-600">
                {b.bookedCount}/{b.hotels.length} Booked · {b.voucherCount}/{b.hotels.length} Voucher Sent
              </div>
              <div className="divide-y divide-slate-100">
                {b.hotels.map((h) => (
                  <HotelRow
                    key={h._id}
                    h={h}
                    onEdit={() => onEditRow(h)}
                    onStatusChange={(status) => onStatusChange(h._id, status)}
                  />
                ))}
              </div>
            </>
          ) : b.hotels.length > 0 ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs italic text-slate-400">Hotel bookings not generated yet</span>
                {b.quoteId && (
                  <button
                    onClick={() => onGenerate(queryId, b.quoteId)}
                    disabled={generating}
                    className="btn-secondary text-xs"
                  >
                    <Sparkles size={12} /> Generate
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {b.hotels.map((h, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <span className="font-medium text-slate-800">{h.hotelName}</span>
                    {h.city && <span className="text-xs text-slate-400">{h.city}</span>}
                    <span className="text-xs text-slate-500">{fmtD(h.checkIn)} · {h.nights}N</span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{h.reservationStatus}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-slate-400">No hotel bookings yet.</p>
              {b.quoteId && (
                <button
                  onClick={() => onGenerate(queryId, b.quoteId)}
                  disabled={generating}
                  className="btn-primary text-xs"
                >
                  <Sparkles size={13} /> Generate from quote
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HotelBookingsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [editRow, setEditRow] = useState(null);
  const debounced = useDebounced(search);

  const serverTab = CLIENT_SIDE_TABS.has(tab) ? 'all' : tab;
  const { data, isLoading } = useQuery({
    queryKey: ['hotel-bookings', serverTab, debounced],
    queryFn: () => bookingsApi.hotels({ tab: serverTab, search: debounced, limit: 200 }),
  });
  const allItems = data?.data || [];
  const items = allItems.filter((b) => {
    if (tab === 'in_progress') return b.hasServiceBookings && b.bookedCount < b.hotels.length;
    if (tab === 'booked')      return b.hasServiceBookings && b.hotels.length > 0 && b.bookedCount >= b.hotels.length;
    return true;
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['hotel-bookings'] });

  const updMut = useMutation({
    mutationFn: ({ id, patch }) => serviceBookingsApi.update(id, patch),
    onSuccess: () => { setEditRow(null); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const genMut = useMutation({
    mutationFn: ({ queryId, quoteId }) => serviceBookingsApi.generate(queryId, quoteId, 'hotel'),
    onSuccess: (created) => {
      toast.success(created?.length ? `Generated ${created.length} hotel booking(s)` : 'Nothing to generate');
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Hotel Bookings</h1>
        <div className="flex w-72 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Search size={15} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by id, guest…"
            className="w-full text-sm outline-none"
          />
        </div>
      </div>

      <div className="flex gap-6">
        <aside className="w-36 shrink-0 space-y-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'block w-full rounded-lg px-3 py-2 text-left text-sm',
                tab === t.key ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {t.label}
            </button>
          ))}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            Showing {items.length} bookings
            <button onClick={refresh} className="text-slate-400 hover:text-slate-700">
              <RefreshCw size={14} />
            </button>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-slate-400">Loading…</div>
          ) : !items.length ? (
            <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400">
              No bookings found.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((b) => (
                <BookingCard
                  key={b._id}
                  b={b}
                  onEditRow={setEditRow}
                  onStatusChange={(id, status) => updMut.mutate({ id, patch: { status } })}
                  onGenerate={(queryId, quoteId) => genMut.mutate({ queryId, quoteId })}
                  generating={genMut.isPending}
                />
              ))}
            </div>
          )}
        </div>
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
