import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw, Pencil, Sparkles, Users, Share2, ChevronRight, ChevronLeft, CheckCircle2, ArrowUpDown, FileText, CalendarDays, SlidersHorizontal } from 'lucide-react';
import {
  format, formatDistanceToNow, addDays, addMonths,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameDay, isSameMonth,
} from 'date-fns';
import toast from 'react-hot-toast';
import { bookingsApi } from '../../api/bookings.js';
import { serviceBookingsApi } from '../../api/serviceBookings.js';
import { destinationsApi, querySourcesApi, usersApi } from '../../api/masterData.js';
import { hotelsApi } from '../../api/services.js';
import { optionsApi } from '../../api/options.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { stayCheckInOut, markRepeatStays } from '../../lib/stayFormat.js';
import { cn } from '../../lib/cn.js';
import Modal from '../../components/ui/Modal.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import FilterDrawer, { countFilters } from '../../components/ui/FilterDrawer.jsx';
import UpdateBookingStatusModal from '../../components/trips/UpdateBookingStatusModal.jsx';
import TagCommentModal, { BOOKING_TAGS } from '../../components/trips/TagCommentModal.jsx';
import GenerateVoucherModal from '../../components/trips/GenerateVoucherModal.jsx';
import { ShareHotelBookingModal } from '../../components/trips/ServiceBookingsTab.jsx';

const PAGE_SIZE = 15;

const EMPTY_FILTERS = { destinations: [], sources: [], tags: [], team: [], stayFrom: '', stayTo: '', hotels: [], hotelGroups: [] };
const FILTER_FIELDS = [
  { key: 'destinations', label: 'Destinations', type: 'async', isMulti: true, loadOptions: (s) => destinationsApi.search(s) },
  { key: 'sources', label: 'Trip Sources', type: 'async', isMulti: true, loadOptions: (s) => querySourcesApi.search(s) },
  { key: 'tags', label: 'Booking Tags', type: 'async', isMulti: true, loadOptions: async (s) => BOOKING_TAGS.filter((t) => t.toLowerCase().includes((s || '').toLowerCase())).map((t) => ({ _id: t, name: t })) },
  { key: 'team', label: 'Team', type: 'async', isMulti: true, loadOptions: (s) => usersApi.search(s) },
  { fromKey: 'stayFrom', toKey: 'stayTo', label: 'Stay During', type: 'dateRange' },
  { key: 'hotels', label: 'Hotels', type: 'async', isMulti: true, loadOptions: (s) => hotelsApi.list({ search: s }).then((r) => r.data) },
  { key: 'hotelGroups', label: 'Hotel Groups', type: 'async', isMulti: true, loadOptions: (s) => optionsApi.search('hotelGroup', s).then((l) => l.map((o) => ({ _id: o.value, name: o.value }))) },
];

// Multi-selects hold objects; the API takes comma-joined ids/values.
const ids = (arr) => (arr || []).map((x) => x?._id ?? x).filter(Boolean).join(',');
const filterParams = (f) => {
  const p = {};
  if (f.destinations?.length) p.destinations = ids(f.destinations);
  if (f.sources?.length) p.sources = ids(f.sources);
  if (f.tags?.length) p.tags = ids(f.tags);
  if (f.team?.length) p.team = ids(f.team);
  if (f.hotels?.length) p.hotels = ids(f.hotels);
  if (f.hotelGroups?.length) p.hotelGroups = ids(f.hotelGroups);
  if (f.stayFrom) p.stayFrom = f.stayFrom;
  if (f.stayTo) p.stayTo = f.stayTo;
  return p;
};

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

// Plain coloured text (not pills) here — the reference table keeps rows to a
// single line so the columns stay visually aligned down the page.
const STATUS = {
  initialized: { label: 'Initialized', cls: 'text-slate-700' },
  in_progress: { label: 'In Progress', cls: 'text-blue-700' },
  booked:      { label: 'Booked',      cls: 'text-green-700' },
  changed:     { label: 'Changed',     cls: 'text-orange-700' },
  cancelled:   { label: 'Dropped',     cls: 'text-red-600' },
};
const fmtD = (d) => (d ? format(new Date(d), 'd MMM') : '—');
const ago  = (d) => (d ? `${formatDistanceToNow(new Date(d))} ago` : '');
const paxLabel = (pax) => {
  if (!pax) return '';
  const a = pax.adults || 0;
  const c = (pax.children || []).length;
  return `${a}A${c ? `, ${c}C` : ''}`;
};

// Status only moves forward (Initialized -> Booked -> Confirmed, Dropped from
// anywhere) — clicking the badge opens the Update Booking Status modal
// instead of an inline dropdown that could revert to an earlier stage.
function StatusSelect({ row, onChange, saving }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('group inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium', STATUS[row.status]?.cls)}
        title="Update booking status"
      >
        {row.status === 'booked' && <CheckCircle2 size={13} />}
        {STATUS[row.status]?.label || row.status}
        <Pencil size={11} className="opacity-40 group-hover:opacity-100" />
      </button>
      {open && (
        <UpdateBookingStatusModal
          row={row}
          saving={saving}
          onClose={() => setOpen(false)}
          onSave={(patch) => { onChange(patch); setOpen(false); }}
        />
      )}
    </>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

// The spanning left-hand "Basic Details" cell: guest, trip id/source/value,
// dates & pax, who created it, and the assigned team.
function BasicDetailsCell({ b, rowSpan }) {
  const destinationLabel = (b.destinations || []).map((d) => d?.name).filter(Boolean).join(', ');
  return (
    <td rowSpan={rowSpan} className="w-72 border-r border-slate-100 px-4 py-3 align-top">
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <Link to={`/bookings/${b._id}`} className="font-semibold text-brand-700 hover:underline">
          {b.guest?.name || b.title || 'Guest'}
        </Link>
        {destinationLabel && <span className="text-sm font-medium text-slate-600">• {destinationLabel}</span>}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        #{b.bookingNumber}
        {b.query?.source?.name ? ` • ${b.query.source.name}` : ''}
        {' • '}<span className="text-[10px] font-semibold uppercase text-slate-400">{b.currency || 'INR'}</span>{' '}
        <span className="text-slate-700">{new Intl.NumberFormat('en-IN').format(Math.round(b.totalAmount || 0))}</span>
      </div>
      <div className="mt-1 text-xs text-slate-600">
        {b.startDate ? format(new Date(b.startDate), 'd MMM, yyyy') : '—'}
        {b.nights ? ` • ${b.nights + 1}D` : ''}
        {b.pax ? ` • ${paxLabel(b.pax)}` : ''}
      </div>
      {b.createdAt && (
        <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
          <ChevronRight size={12} /> {ago(b.createdAt)}{b.owner?.name ? ` by ${b.owner.name}` : ''}
        </div>
      )}
      <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
        <Users size={13} className="text-slate-400" /> {b.owner?.name || 'Not Set'}
        <Pencil size={11} className="text-slate-300" />
      </div>
    </td>
  );
}

function HotelCells({ h, isRepeat, onEdit, onShare, onVoucher, onTag, onStatusChange }) {
  return (
    <>
      <td className="border-r border-slate-100 px-4 py-2.5 align-middle">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 truncate">
            <span className="font-medium text-brand-700">{h.name}</span>
            <span className="ml-1.5 text-[11px] text-slate-400">
              {h.city || ''}{h.stars ? `, ${h.stars} Star` : ''}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-slate-300">
            <button onClick={onEdit} className="hover:text-brand-600" title="Edit"><Pencil size={13} /></button>
            <button onClick={onShare} className="hover:text-emerald-600" title="Share booking request with the hotel"><Share2 size={13} /></button>
            {h.status === 'booked' && (
              <button onClick={onVoucher} className="hover:text-amber-600" title={h.voucherGeneratedAt ? 'Regenerate Voucher' : 'Create Voucher'}>
                <FileText size={13} />
              </button>
            )}
          </div>
        </div>
      </td>
      <td className={cn('whitespace-nowrap border-r border-slate-100 px-4 py-2.5 align-middle text-xs', isRepeat ? 'text-amber-700' : 'text-slate-600')}>
        {stayCheckInOut(h, isRepeat)}
      </td>
      <td className="border-r border-slate-100 px-4 py-2.5 align-middle">
        <StatusSelect row={h} onChange={onStatusChange} />
      </td>
      <td className="border-r border-slate-100 px-4 py-2.5 align-middle">
        <button onClick={onTag} className="group flex items-center gap-1.5" title="Edit tag / comments">
          {h.tag && <span className="inline-block rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">{h.tag}</span>}
          <Pencil size={12} className="text-slate-300 group-hover:text-brand-600" />
        </button>
      </td>
      <td className="px-4 py-2.5 align-middle text-xs text-slate-500">{h.comment}</td>
    </>
  );
}

// Mobile (<md) rendering: one card per booking so the guest/trip identity and
// its hotel stays read together — the desktop table's rowSpan band layout
// can't be linearized into coherent standalone row-cards.
function MobileBookingCard({ b, onEditRow, onShareRow, onVoucherRow, onTagRow, onStatusChange, onGenerate, generating }) {
  const queryId = b.query?._id || b.query;
  const hotels = b.hotels || [];
  const generated = b.hasServiceBookings;
  const destinationLabel = (b.destinations || []).map((d) => d?.name).filter(Boolean).join(', ');
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <Link to={`/bookings/${b._id}`} className="font-semibold text-brand-700 hover:underline">
          {b.guest?.name || b.title || 'Guest'}
        </Link>
        {destinationLabel && <span className="text-sm font-medium text-slate-600">• {destinationLabel}</span>}
      </div>
      <div className="mt-0.5 text-xs text-slate-500">
        #{b.bookingNumber}
        {b.query?.source?.name ? ` • ${b.query.source.name}` : ''}
        {' • '}<span className="text-[10px] font-semibold uppercase text-slate-400">{b.currency || 'INR'}</span>{' '}
        <span className="text-slate-700">{new Intl.NumberFormat('en-IN').format(Math.round(b.totalAmount || 0))}</span>
      </div>
      <div className="mt-0.5 text-xs text-slate-600">
        {b.startDate ? format(new Date(b.startDate), 'd MMM, yyyy') : '—'}
        {b.nights ? ` • ${b.nights + 1}D` : ''}
        {b.pax ? ` • ${paxLabel(b.pax)}` : ''}
        {b.owner?.name ? ` • ${b.owner.name}` : ''}
      </div>

      {generated ? (
        <>
          <div className="mt-2 text-xs font-medium text-slate-500">
            <span className="font-bold text-slate-900">{b.bookedCount}</span> / {hotels.length} Booked
            {' • '}
            <span className="font-bold text-slate-900">{b.voucherCount}</span> / {hotels.length} Voucher Sent
          </div>
          <div className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
            {markRepeatStays(hotels).map(({ row: h, isRepeat }) => (
              <div key={h._id} className="py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-brand-700">{h.name}</div>
                    <div className="text-[11px] text-slate-400">{h.city || ''}{h.stars ? `, ${h.stars} Star` : ''}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5 text-slate-300">
                    <button onClick={() => onEditRow(h)} className="hover:text-brand-600" title="Edit"><Pencil size={14} /></button>
                    <button onClick={() => onShareRow({ row: h, booking: b })} className="hover:text-emerald-600" title="Share booking request with the hotel"><Share2 size={14} /></button>
                    {h.status === 'booked' && (
                      <button onClick={() => onVoucherRow(h)} className="hover:text-amber-600" title={h.voucherGeneratedAt ? 'Regenerate Voucher' : 'Create Voucher'}>
                        <FileText size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className={cn('mt-1 text-xs', isRepeat ? 'text-amber-700' : 'text-slate-600')}>{stayCheckInOut(h, isRepeat)}</div>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <StatusSelect row={h} onChange={(patch) => onStatusChange(h._id, patch)} />
                  <button onClick={() => onTagRow(h)} className="group flex items-center gap-1.5" title="Edit tag / comments">
                    {h.tag && <span className="inline-block rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">{h.tag}</span>}
                    <Pencil size={12} className="text-slate-300 group-hover:text-brand-600" />
                  </button>
                </div>
                {h.comment && <div className="mt-1 text-xs text-slate-500">{h.comment}</div>}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
          <span className="text-xs italic text-slate-400">
            {hotels.length ? 'Hotel bookings not generated yet' : 'No hotel bookings yet.'}
          </span>
          {b.quoteId && (
            <button onClick={() => onGenerate(queryId, b.quoteId)} disabled={generating} className="btn-secondary text-xs">
              <Sparkles size={12} /> Generate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Month grid of hotel check-ins across all listed bookings.
function CalendarView({ items, month, onMonthChange, onEditRow }) {
  const stays = items.flatMap((b) =>
    (b.hasServiceBookings ? b.hotels : []).map((h) => ({ ...h, guest: b.guest?.name || b.title || 'Guest' }))
  );
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const days = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  const today = new Date();

  return (
    <div className="card card-flush overflow-x-auto">
      <div className="flex min-w-[640px] items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="font-semibold text-slate-800">{format(month, 'MMMM yyyy')}</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => onMonthChange(new Date())} className="btn-secondary text-xs">Today</button>
          <button onClick={() => onMonthChange(addMonths(month, -1))} className="btn-secondary px-2"><ChevronLeft size={15} /></button>
          <button onClick={() => onMonthChange(addMonths(month, 1))} className="btn-secondary px-2"><ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="grid min-w-[640px] grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-[11px] font-semibold uppercase text-slate-500">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid min-w-[640px] grid-cols-7">
        {days.map((day) => {
          const dayStays = stays.filter((s) => s.checkIn && isSameDay(new Date(s.checkIn), day));
          const inMonth = isSameMonth(day, month);
          return (
            <div key={day.toISOString()} className={cn('min-h-24 border-b border-r border-slate-100 p-1.5', !inMonth && 'bg-slate-50/60')}>
              <div className={cn(
                'mb-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold',
                isSameDay(day, today) ? 'bg-brand-600 text-white' : inMonth ? 'text-slate-600' : 'text-slate-300'
              )}>
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {dayStays.map((s) => (
                  <button
                    key={s._id}
                    onClick={() => onEditRow(s)}
                    className={cn(
                      'block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-medium hover:ring-1 hover:ring-brand-300',
                      s.status === 'booked' ? 'bg-green-50 text-green-800' : s.status === 'cancelled' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'
                    )}
                    title={`${s.name} — ${s.guest} (${s.nights?.length || 1}N)`}
                  >
                    {s.name} <span className="text-slate-400">· {s.nights?.length || 1}N</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// One booking = a band row carrying the spanning Basic Details cell, then one
// row per hotel stay, so every column stays aligned across all bookings.
function BookingRows({ b, onEditRow, onShareRow, onVoucherRow, onTagRow, onStatusChange, onGenerate, generating }) {
  const queryId = b.query?._id || b.query;
  const hotels = b.hotels || [];
  const generated = b.hasServiceBookings;

  return (
    <>
      <tr className="border-t-4 border-slate-100 bg-slate-50/60">
        <BasicDetailsCell b={b} rowSpan={(generated ? hotels.length : 0) + 1} />
        <td colSpan={5} className="px-4 py-2.5">
          {generated ? (
            <span className="text-xs font-medium text-slate-500">
              <span className="text-lg font-bold text-slate-900">{b.bookedCount}</span> / {hotels.length} Booked
              {'  •  '}
              <span className="text-lg font-bold text-slate-900">{b.voucherCount}</span> / {hotels.length} Voucher Sent
            </span>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs italic text-slate-400">
                {hotels.length ? 'Hotel bookings not generated yet' : 'No hotel bookings yet.'}
              </span>
              {b.quoteId && (
                <button onClick={() => onGenerate(queryId, b.quoteId)} disabled={generating} className="btn-secondary text-xs">
                  <Sparkles size={12} /> Generate
                </button>
              )}
            </div>
          )}
        </td>
      </tr>

      {generated && markRepeatStays(hotels).map(({ row: h, isRepeat }) => (
        <tr key={h._id} className="hover:bg-slate-50">
          <HotelCells
            h={h}
            isRepeat={isRepeat}
            onEdit={() => onEditRow(h)}
            onShare={() => onShareRow({ row: h, booking: b })}
            onVoucher={() => onVoucherRow(h)}
            onTag={() => onTagRow(h)}
            onStatusChange={(patch) => onStatusChange(h._id, patch)}
          />
        </tr>
      ))}
    </>
  );
}

export default function HotelBookingsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('newest');
  const [view, setView] = useState('list'); // 'list' | 'calendar'
  const [month, setMonth] = useState(new Date());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [editRow, setEditRow] = useState(null);
  const [shareRow, setShareRow] = useState(null); // { row, booking }
  const [voucherRow, setVoucherRow] = useState(null);
  const [tagRow, setTagRow] = useState(null);
  const debounced = useDebounced(search);

  // "In Progress" / "Booked" aren't stored booking statuses — they're derived
  // from ServiceBooking completion, so they're filtered client-side over a
  // larger fetched batch instead of a real paginated server query.
  const isClientTab = CLIENT_SIDE_TABS.has(tab);
  const serverTab = isClientTab ? 'all' : tab;
  useEffect(() => setPage(1), [tab, debounced, sort, filters]);

  // Calendar mode needs the whole filtered set, not a single page.
  const wantsAll = isClientTab || view === 'calendar';
  const { data, isLoading } = useQuery({
    queryKey: ['hotel-bookings', serverTab, debounced, sort, filters, wantsAll ? 'batch' : page],
    queryFn: () => bookingsApi.hotels({
      tab: serverTab, search: debounced, sort, ...filterParams(filters),
      ...(wantsAll ? { limit: 100 } : { page, limit: PAGE_SIZE }),
    }),
  });
  const allItems = data?.data || [];
  const items = isClientTab
    ? allItems.filter((b) => (tab === 'in_progress'
        ? b.hasServiceBookings && b.bookedCount < b.hotels.length
        : b.hasServiceBookings && b.hotels.length > 0 && b.bookedCount >= b.hotels.length))
    : allItems;
  const meta = data?.meta;
  const refresh = () => qc.invalidateQueries({ queryKey: ['hotel-bookings'] });

  const updMut = useMutation({
    mutationFn: ({ id, patch }) => serviceBookingsApi.update(id, patch),
    onSuccess: () => { setEditRow(null); setTagRow(null); refresh(); },
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
    <div className="px-4 py-4 sm:px-6 sm:py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Hotel Bookings</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-full items-center sm:w-72 gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <Search size={15} className="text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by id, destination…"
              className="w-full text-sm outline-none"
            />
            <button onClick={() => setShowFilters(true)} className="relative shrink-0 text-slate-400 hover:text-brand-600" title="Advanced Filters">
              <SlidersHorizontal size={15} />
              {countFilters(filters) > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                  {countFilters(filters)}
                </span>
              )}
            </button>
          </div>
          <button
            onClick={() => setView((v) => (v === 'calendar' ? 'list' : 'calendar'))}
            className={cn('btn-secondary text-sm', view === 'calendar' && 'border-brand-300 bg-brand-50 text-brand-700')}
          >
            <CalendarDays size={15} /> {view === 'calendar' ? 'List' : 'Calendar'}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        <aside className="-mx-1 flex w-full gap-1 no-scrollbar overflow-x-auto px-1 pb-1 lg:mx-0 lg:w-36 lg:shrink-0 lg:flex-col lg:gap-0 lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'block shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm lg:w-full',
                tab === t.key ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50',
              )}
            >
              {t.label}
            </button>
          ))}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            {wantsAll || !meta
              ? `Showing ${items.length} Items`
              : `Showing ${items.length ? (meta.page - 1) * meta.limit + 1 : 0} - ${(meta.page - 1) * meta.limit + items.length} of ${meta.total} Items`}
            <button onClick={refresh} className="text-slate-400 hover:text-slate-700">
              <RefreshCw size={14} />
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <ArrowUpDown size={13} className="text-slate-400" />
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="cursor-pointer border-0 bg-transparent text-sm font-medium text-slate-600 outline-none">
                <option value="newest">Sort By: Newest</option>
                <option value="oldest">Sort By: Oldest</option>
                <option value="start_asc">Sort By: Trip Start ↑</option>
                <option value="start_desc">Sort By: Trip Start ↓</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-slate-400">Loading…</div>
          ) : !items.length ? (
            <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400">
              No bookings found.
            </div>
          ) : view === 'calendar' ? (
            <CalendarView items={items} month={month} onMonthChange={setMonth} onEditRow={setEditRow} />
          ) : (
            <>
            {/* Mobile: one card per booking (desktop table below is hidden < md) */}
            <div className="space-y-3 md:hidden">
              {items.map((b) => (
                <MobileBookingCard
                  key={b._id}
                  b={b}
                  onEditRow={setEditRow}
                  onShareRow={setShareRow}
                  onVoucherRow={setVoucherRow}
                  onTagRow={setTagRow}
                  onStatusChange={(id, patch) => updMut.mutate({ id, patch })}
                  onGenerate={(queryId, quoteId) => genMut.mutate({ queryId, quoteId })}
                  generating={genMut.isPending}
                />
              ))}
            </div>
            <div className="card card-flush hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-white text-left text-sm font-semibold text-slate-700">
                  <tr className="border-b border-slate-200">
                    <th className="w-72 border-r border-slate-100 px-4 py-3">Basic Details</th>
                    <th className="border-r border-slate-100 px-4 py-3">Hotel</th>
                    <th className="border-r border-slate-100 px-4 py-3">Duration</th>
                    <th className="border-r border-slate-100 px-4 py-3">Status</th>
                    <th className="w-28 border-r border-slate-100 px-4 py-3">Tag</th>
                    <th className="w-40 px-4 py-3">Comments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((b) => (
                    <BookingRows
                      key={b._id}
                      b={b}
                      onEditRow={setEditRow}
                      onShareRow={setShareRow}
                      onVoucherRow={setVoucherRow}
                      onTagRow={setTagRow}
                      onStatusChange={(id, patch) => updMut.mutate({ id, patch })}
                      onGenerate={(queryId, quoteId) => genMut.mutate({ queryId, quoteId })}
                      generating={genMut.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}

          {!wantsAll && meta && <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />}
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

      {tagRow && (
        <TagCommentModal
          row={tagRow}
          saving={updMut.isPending}
          onClose={() => setTagRow(null)}
          onSave={(patch) => updMut.mutate({ id: tagRow._id, patch })}
        />
      )}

      {voucherRow && <GenerateVoucherModal row={voucherRow} onClose={() => { setVoucherRow(null); refresh(); }} />}

      <FilterDrawer
        open={showFilters}
        onClose={() => setShowFilters(false)}
        fields={FILTER_FIELDS}
        initial={filters}
        empty={EMPTY_FILTERS}
        onApply={setFilters}
      />

      {shareRow && (
        <ShareHotelBookingModal
          row={shareRow.row}
          guest={shareRow.booking?.guest}
          pax={shareRow.booking?.pax}
          queryNumber={shareRow.booking?.query?.queryNumber}
          onClose={() => setShareRow(null)}
          onEdit={setEditRow}
        />
      )}
    </div>
  );
}
