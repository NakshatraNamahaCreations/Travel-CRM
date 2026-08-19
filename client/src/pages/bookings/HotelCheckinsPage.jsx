import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RefreshCw, Hotel, FileText, User, Search, ArrowLeftRight } from 'lucide-react';
import {
  format, formatDistanceToNow,
  startOfWeek, endOfWeek, addWeeks,
  startOfMonth, endOfMonth, addMonths,
  startOfDay, endOfDay, addDays,
} from 'date-fns';
import toast from 'react-hot-toast';
import { bookingsApi } from '../../api/bookings.js';
import { serviceBookingsApi } from '../../api/serviceBookings.js';
import { tripNo } from '../../lib/format.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import Modal from '../../components/ui/Modal.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import GenerateVoucherModal from '../../components/trips/GenerateVoucherModal.jsx';
import UpdateBookingStatusModal from '../../components/trips/UpdateBookingStatusModal.jsx';
import TagCommentModal from '../../components/trips/TagCommentModal.jsx';
import { cn } from '../../lib/cn.js';

const PAGE_SIZE = 15;

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All' },
];
const INTERVALS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

const STATUS = {
  initialized: { label: 'Initialized', cls: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-50 text-blue-700' },
  booked: { label: 'Booked', cls: 'bg-green-50 text-green-700' },
  changed: { label: 'Changed', cls: 'bg-orange-50 text-orange-700' },
  cancelled: { label: 'Dropped', cls: 'bg-red-50 text-red-600' },
};
const money = (n, c = 'INR') => `${c} ${new Intl.NumberFormat('en-IN').format(Math.round(n || 0))}`;
const dt = (d) => (d ? format(new Date(d), 'd MMM') : '—');
const ago = (d) => (d ? `${formatDistanceToNow(new Date(d))} ago` : '');

function rangeFor(interval, anchor) {
  if (interval === 'day') return { after: startOfDay(anchor), before: endOfDay(anchor) };
  if (interval === 'month') return { after: startOfMonth(anchor), before: endOfMonth(anchor) };
  return { after: startOfWeek(anchor, { weekStartsOn: 0 }), before: endOfWeek(anchor, { weekStartsOn: 0 }) };
}
function shiftAnchor(interval, anchor, dir) {
  if (interval === 'day') return addDays(anchor, dir);
  if (interval === 'month') return addMonths(anchor, dir);
  return addWeeks(anchor, dir);
}
function rangeLabel(interval, after, before) {
  if (interval === 'month') return format(after, 'MMMM yyyy');
  if (interval === 'day') return format(after, 'EEE, d MMM yyyy');
  return `${format(after, 'EEE d MMM')} – ${format(before, 'EEE d MMM')}`;
}


export default function HotelCheckinsPage() {
  const [tab, setTab] = useState('upcoming');
  const [intervalType, setIntervalType] = useState('month');
  const [anchor, setAnchor] = useState(new Date());
  const [dateField, setDateField] = useState('checkIn'); // 'checkIn' | 'checkOut' — the "Check-Outs" toggle
  const [includeDropped, setIncludeDropped] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [voucherRow, setVoucherRow] = useState(null);
  const [tagRow, setTagRow] = useState(null);
  const [statusRow, setStatusRow] = useState(null);
  const qc = useQueryClient();
  const debouncedSearch = useDebounced(search);

  const { after, before } = useMemo(() => rangeFor(intervalType, anchor), [intervalType, anchor]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['hotel-checkins', tab, intervalType, after.toISOString(), dateField, includeDropped],
    queryFn: () => bookingsApi.hotelCheckins({
      tab, after: after.toISOString(), before: before.toISOString(), dateField,
      includeDropped: includeDropped ? 1 : 0,
    }),
  });
  const allStays = data?.data || [];
  const stays = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return allStays;
    return allStays.filter((s) => {
      const guest = s.query?.guest;
      const guestName = [guest?.salutation, guest?.name].filter(Boolean).join(' ');
      return [s.hotelName, s.city, guestName, tripNo(s.query?.queryNumber)].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [allStays, debouncedSearch]);

  useEffect(() => setPage(1), [tab, intervalType, after, dateField, includeDropped, debouncedSearch]);
  const totalPages = Math.max(1, Math.ceil(stays.length / PAGE_SIZE));
  const pageStays = stays.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updMut = useMutation({
    mutationFn: ({ id, patch }) => serviceBookingsApi.update(id, patch),
    onSuccess: () => { setTagRow(null); setStatusRow(null); qc.invalidateQueries({ queryKey: ['hotel-checkins'] }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <h1 className="text-lg font-bold text-slate-900">Hotel Check-Ins <span className="ml-1 text-sm font-normal text-slate-400">({rangeLabel(intervalType, after, before)})</span></h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-full items-center sm:w-56 gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
            <Search size={14} className="text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full text-sm outline-none" />
          </div>
          <button onClick={() => setAnchor(new Date())} className="btn-secondary text-sm">Today</button>
          <button onClick={() => setAnchor((d) => shiftAnchor(intervalType, d, -1))} className="btn-secondary px-2"><ChevronLeft size={16} /></button>
          <button onClick={() => setAnchor((d) => shiftAnchor(intervalType, d, 1))} className="btn-secondary px-2"><ChevronRight size={16} /></button>
          <select value={intervalType} onChange={(e) => setIntervalType(e.target.value)} className="input w-auto py-1.5 text-sm">
            {INTERVALS.map((iv) => <option key={iv.key} value={iv.key}>{iv.label}</option>)}
          </select>
          <button
            onClick={() => setDateField((d) => (d === 'checkIn' ? 'checkOut' : 'checkIn'))}
            className={cn('btn-secondary text-sm', dateField === 'checkOut' && 'border-brand-300 bg-brand-50 text-brand-700')}
            title="Filter the date range by check-in or check-out date"
          >
            <ArrowLeftRight size={13} /> {dateField === 'checkOut' ? 'Check-Outs' : 'Check-Ins'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
        <div className="flex items-center gap-6">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={cn('border-b-2 py-3 text-sm font-medium', tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>
              {t.label}
            </button>
          ))}
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
          <span className="text-slate-400">Quick Filters:</span>
          <input type="checkbox" checked={includeDropped} onChange={(e) => setIncludeDropped(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600" />
          Include Dropped
        </label>
      </div>

      <div className="px-4 py-4 sm:px-6 sm:py-5">
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
          Showing {stays.length ? (page - 1) * PAGE_SIZE + 1 : 0}-{Math.min(page * PAGE_SIZE, stays.length)} of {stays.length} Item{stays.length === 1 ? '' : 's'}
          <button onClick={() => refetch()} className="text-slate-400 hover:text-slate-700"><RefreshCw size={14} /></button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400">Loading…</div>
        ) : !stays.length ? (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400">No check-ins in this {intervalType}.</div>
        ) : (
          <div className="card card-flush overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Check In - Out</th>
                  <th className="px-4 py-3">Hotels</th>
                  <th className="px-4 py-3">Trip Info</th>
                  <th className="px-4 py-3">Room/Services</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tag/Comments</th>
                  <th className="px-4 py-3 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageStays.map((s) => {
                  const guest = s.query?.guest;
                  const guestName = [guest?.salutation, guest?.name].filter(Boolean).join(' ') || 'Guest';
                  return (
                    <tr key={s._id} className="align-top hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{dt(s.checkIn)} – {dt(s.checkOut)} <span className="text-xs font-normal text-slate-400">({s.nights}N)</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2"><Hotel size={14} className="shrink-0 text-brand-400" /><span className="font-medium text-brand-700">{s.hotelName}</span></div>
                        {s.city && <div className="text-xs text-slate-400">{s.city}{s.stars ? ` • ${s.stars}★` : ''}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/trips/${s.query?._id}`} className="flex items-center gap-1 text-brand-600 hover:underline"><User size={11} />{guestName}</Link>
                        <div className="text-xs text-slate-400">#{tripNo(s.query?.queryNumber)}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{s.rooms || 1} {s.roomType || 'Room'}{s.mealPlan ? <div className="text-xs text-slate-400">{s.mealPlan}</div> : null}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setStatusRow(s)}
                          className={cn('cursor-pointer rounded-md border-0 px-2 py-1 text-xs font-semibold', STATUS[s.status]?.cls)}
                        >
                          {STATUS[s.status]?.label || s.status}
                        </button>
                        <div className="mt-1 text-[11px] text-gray-400">{s.bookedBy?.name || '—'}{s.updatedAt ? ` • ${ago(s.updatedAt)}` : ''}</div>
                        {s.status === 'booked' && (
                          <button onClick={() => setVoucherRow(s)} className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-700">
                            <FileText size={11} /> {s.voucherGeneratedAt ? 'Regenerate' : 'Generate'}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setTagRow(s)} className="text-left">
                          {s.tag && <span className="mb-1 inline-block rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">{s.tag}</span>}
                          {s.comment ? <div className="text-xs text-slate-500">{s.comment}</div> : (!s.tag && <span className="text-xs text-brand-500 hover:underline">+ Tag</span>)}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-[11px] uppercase text-gray-400">Booking</div>
                        <div className="font-semibold text-gray-900">{money(s.price, s.currency)}</div>
                        <div className="mt-1 text-[11px] uppercase text-gray-400">Amount Paid</div>
                        <div className="text-xs text-gray-600">{money(s.amountPaid, s.currency)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {stays.length > 0 && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
      </div>

      {voucherRow && <GenerateVoucherModal row={voucherRow} onClose={() => setVoucherRow(null)} />}
      {tagRow && (
        <TagCommentModal
          row={tagRow}
          saving={updMut.isPending}
          onClose={() => setTagRow(null)}
          onSave={(patch) => updMut.mutate({ id: tagRow._id, patch })}
        />
      )}
      {statusRow && (
        <UpdateBookingStatusModal
          row={statusRow}
          saving={updMut.isPending}
          onClose={() => setStatusRow(null)}
          onSave={(patch) => updMut.mutate({ id: statusRow._id, patch })}
        />
      )}
    </div>
  );
}
