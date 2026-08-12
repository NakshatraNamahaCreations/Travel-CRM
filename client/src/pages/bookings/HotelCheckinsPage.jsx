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
import RichTextEditor from '../../components/form/RichTextEditor.jsx';
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
  booked: { label: 'Booked', cls: 'bg-amber-50 text-amber-700' },
  confirmed: { label: 'Confirmed', cls: 'bg-green-50 text-green-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-600' },
};
const STATUS_KEYS = Object.keys(STATUS);
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

// "Please BOOK & CONFIRM" voucher for a single hotel stay — mirrors the trip's
// Docs/Vouchers options (Price Bifurcation = prices, Remove Branding) but
// scoped to one row, with a confirmation number / contact / notes attached.
function GenerateVoucherModal({ row, onClose }) {
  const [confirmationNumber, setConfirmationNumber] = useState(row.confirmationNumber || '');
  const [voucherContact, setVoucherContact] = useState('');
  const [voucherNotes, setVoucherNotes] = useState('');
  const [prices, setPrices] = useState(false);
  const [removeBranding, setRemoveBranding] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: info } = useQuery({
    queryKey: ['service-booking-hotel-info', row._id],
    queryFn: () => serviceBookingsApi.hotelInfo(row._id),
  });

  const generate = async () => {
    setBusy(true);
    try {
      const blob = await serviceBookingsApi.voucherPdf(row._id, { confirmationNumber, voucherContact, voucherNotes, prices, removeBranding });
      window.open(URL.createObjectURL(blob), '_blank');
      toast.success('Voucher generated');
      onClose();
    } catch {
      toast.error('Could not generate the voucher');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Generate Voucher for ${row.hotelName || 'Hotel'}`} width="max-w-xl">
      <div className="space-y-4">
        <div>
          <label className="label">Hotel Confirmation Details</label>
          <input className="input" value={confirmationNumber} onChange={(e) => setConfirmationNumber(e.target.value)} placeholder="e.g. No. TSK123 by Contact Person" />
        </div>

        <div>
          <label className="label">Booking Confirmed by Hotel's Contact Person <span className="font-normal text-gray-400">(optional)</span></label>
          <input className="input" value={voucherContact} onChange={(e) => setVoucherContact(e.target.value)} placeholder="Type contact name…" />
          <p className="mt-1 text-xs text-gray-400">Contact details will be included in the Voucher PDF</p>
        </div>

        <div>
          <label className="label">Voucher Notes <span className="font-normal text-gray-400">(optional)</span></label>
          <RichTextEditor value={voucherNotes} onChange={setVoucherNotes} placeholder="Example: Please pay 50% at the time of checkin" minHeight="80px" />
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-3">
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" checked={prices} onChange={(e) => setPrices(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
            <span>
              <span className="font-medium text-slate-800">Include Price Bifurcation</span>
              <span className="block text-xs text-gray-400">Select the checkbox to include the booking price bifurcation in the generated pdf</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" checked={removeBranding} onChange={(e) => setRemoveBranding(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
            <span>
              <span className="font-medium text-slate-800">Remove Branding</span>
              <span className="block text-xs text-gray-400">Select the checkbox to remove the branding from the generated pdf and booking price bifurcation will not be included</span>
            </span>
          </label>
        </div>

        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs text-gray-500">Please verify hotel details that will be used in voucher. Edit if required.</p>
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-sm">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Hotel Address</div>
              <div className="text-slate-700">{info?.address || row.city || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Checkin Time</div>
              <div className="text-slate-700">{info?.checkIn || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Checkout Time</div>
              <div className="text-slate-700">{info?.checkOut || '—'}</div>
            </div>
          </div>
          {info?.hotelId && (
            <Link to={`/services/hotels/${info.hotelId}/edit`} className="btn-secondary mt-2 text-xs">Edit Hotel details</Link>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button onClick={generate} disabled={busy} className="btn-primary">{busy ? 'Generating…' : 'Generate Voucher'}</button>
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </Modal>
  );
}

function TagCommentModal({ row, onClose, onSave, saving }) {
  const [tag, setTag] = useState(row.tag || '');
  const [comment, setComment] = useState(row.comment || '');
  return (
    <Modal open onClose={onClose} title={`Tag / Comments — ${row.hotelName || 'Hotel'}`} width="max-w-sm">
      <div className="space-y-3">
        <div><label className="label">Tag</label><input className="input" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. Paid" /></div>
        <div><label className="label">Comment</label><textarea rows={3} className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Notes / follow-up…" /></div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => onSave({ tag, comment })} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </Modal>
  );
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
    onSuccess: () => { setTagRow(null); qc.invalidateQueries({ queryKey: ['hotel-checkins'] }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-bold text-slate-900">Hotel Check-Ins <span className="ml-1 text-sm font-normal text-slate-400">({rangeLabel(intervalType, after, before)})</span></h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-56 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6">
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

      <div className="px-6 py-5">
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
                        <select
                          value={s.status}
                          onChange={(e) => updMut.mutate({ id: s._id, patch: { status: e.target.value } })}
                          className={cn('cursor-pointer rounded-md border-0 px-2 py-1 text-xs font-semibold focus:ring-2 focus:ring-brand-300', STATUS[s.status]?.cls)}
                        >
                          {STATUS_KEYS.map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
                        </select>
                        <div className="mt-1 text-[11px] text-gray-400">{s.bookedBy?.name || '—'}{s.updatedAt ? ` • ${ago(s.updatedAt)}` : ''}</div>
                        <button onClick={() => setVoucherRow(s)} className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-700">
                          <FileText size={11} /> {s.voucherGeneratedAt ? 'Regenerate' : 'Generate'}
                        </button>
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
    </div>
  );
}
