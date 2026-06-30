import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Ban, MapPin, ImageOff, Image, Phone } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { hotelsApi } from '../../api/services.js';
import StarRating from '../../components/ui/StarRating.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { cn } from '../../lib/cn.js';
import { money } from '../../lib/pricing.js';
import { tripNo } from '../../lib/format.js';

const TABS = ['Details', 'Hotel Notes', 'Bookings', 'Payments', 'Accounting', 'Activities'];

const STATUS_STYLES = {
  confirmed: 'bg-blue-50 text-blue-700',
  on_trip: 'bg-green-50 text-green-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-50 text-red-600',
};

const INST_STATUS = {
  paid: 'bg-green-50 text-green-700',
  unverified: 'bg-blue-50 text-blue-700',
  overdue: 'bg-amber-50 text-amber-700',
  upcoming: 'bg-slate-100 text-slate-600',
};

const PAY_TABS = [
  ['upcoming', 'Upcoming'], ['past7', 'Past 7 Days'], ['unverified', 'Unverified'],
  ['paid', 'Paid'], ['overdue', 'Overdue'], ['all', 'All'],
];

function Info({ label, children }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-gray-900">{children || '—'}</div>
    </div>
  );
}

function InstRow({ inst }) {
  const status = inst.paid && inst.verified ? 'paid' : inst.paid ? 'unverified'
    : inst.dueDate && new Date(inst.dueDate) < new Date() ? 'overdue' : 'upcoming';
  const guest = [inst.guest?.salutation, inst.guest?.name].filter(Boolean).join(' ') || 'Guest';
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0">
      <div className="flex-1 min-w-0">
        <Link to={inst.query ? `/trips/${inst.query}` : '#'} className="font-medium text-brand-700 hover:underline text-sm">
          {inst.tripId ? `#${inst.tripId}` : '—'} · {guest}
        </Link>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
          {inst.startDate && <span>{format(new Date(inst.startDate), 'd MMM yyyy')}</span>}
          {inst.dueDate && <span>· Due {format(new Date(inst.dueDate), 'd MMM yyyy')}</span>}
          {inst.guest?.phones?.[0] && (
            <span className="flex items-center gap-0.5"><Phone size={10} /> {inst.guest.phones[0].number}</span>
          )}
        </div>
        {inst.reference && <p className="mt-0.5 text-xs text-gray-400">Ref: {inst.reference}</p>}
      </div>
      <div className="ml-4 text-right shrink-0">
        <p className="font-semibold text-gray-900 text-sm">{money(inst.amount, inst.currency)}</p>
        <span className={cn('mt-0.5 inline-block rounded px-2 py-0.5 text-xs font-medium', INST_STATUS[status] || INST_STATUS.upcoming)}>
          {status === 'paid' ? `Paid ${inst.paidOn ? formatDistanceToNow(new Date(inst.paidOn), { addSuffix: true }) : ''}` : status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
    </div>
  );
}

function PaymentsTab({ id, direction }) {
  const [payTab, setPayTab] = useState('upcoming');
  const { data, isLoading } = useQuery({
    queryKey: ['hotel-payments', id, direction, payTab],
    queryFn: () => hotelsApi.getPayments(id, { direction, filter: payTab }),
  });
  const rows = data?.data || [];
  const total = data?.meta?.total ?? rows.length;

  return (
    <div className="mt-6 flex gap-0">
      {/* Left sidebar */}
      <div className="w-40 shrink-0 border-r border-gray-200 pr-4">
        {PAY_TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPayTab(key)}
            className={cn(
              'block w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
              payTab === key ? 'bg-brand-50 text-brand-700 border-l-2 border-brand-600' : 'text-gray-500 hover:text-gray-800'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Right content */}
      <div className="flex-1 pl-6 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-gray-700">
            {direction === 'incoming' ? 'Incoming Payments' : 'Outgoing Payments'}
            <span className="ml-2 text-xs text-gray-400">({total} record{total !== 1 ? 's' : ''})</span>
          </p>
        </div>
        {isLoading && <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>}
        {!isLoading && !rows.length && (
          <div className="py-12 text-center text-gray-400 text-sm">No payments found.</div>
        )}
        {rows.map((inst) => <InstRow key={inst._id} inst={inst} />)}
      </div>
    </div>
  );
}

function BookingsTab({ id }) {
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['hotel-bookings', id],
    queryFn: () => hotelsApi.getBookings(id),
  });

  if (isLoading) return <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>;
  if (!bookings.length) return <div className="py-12 text-center text-gray-400 text-sm">No bookings found for this hotel yet.</div>;

  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
            <th className="pb-2 text-left font-medium">Booking #</th>
            <th className="pb-2 text-left font-medium">Guest</th>
            <th className="pb-2 text-left font-medium">Dates</th>
            <th className="pb-2 text-left font-medium">Stay Details</th>
            <th className="pb-2 text-left font-medium">Status</th>
            <th className="pb-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b._id} className="border-b border-gray-100 last:border-0">
              <td className="py-3 pr-4">
                <Link to={`/bookings/${b._id}`} className="font-medium text-brand-700 hover:underline">
                  #{b.bookingNumber}
                </Link>
              </td>
              <td className="py-3 pr-4">
                <p className="font-medium text-gray-900">{b.guest?.name || '—'}</p>
                {b.guest?.phones?.[0] && (
                  <p className="text-xs text-gray-400">{b.guest.phones[0].number}</p>
                )}
              </td>
              <td className="py-3 pr-4 whitespace-nowrap">
                {b.startDate ? format(new Date(b.startDate), 'd MMM yyyy') : '—'}
                {b.endDate ? ` → ${format(new Date(b.endDate), 'd MMM yyyy')}` : ''}
              </td>
              <td className="py-3 pr-4">
                {(b.stays || []).map((s, i) => (
                  <div key={i} className="text-xs text-gray-600">
                    {[s.roomType, s.mealPlan].filter(Boolean).join(' · ')}
                    {s.rooms > 0 && ` × ${s.rooms} room${s.rooms > 1 ? 's' : ''}`}
                    {s.nights?.length > 0 && ` · ${s.nights.length} night${s.nights.length > 1 ? 's' : ''}`}
                  </div>
                ))}
              </td>
              <td className="py-3 pr-4">
                <span className={cn('rounded px-2 py-0.5 text-xs font-medium capitalize', STATUS_STYLES[b.status] || '')}>
                  {b.status?.replace('_', ' ')}
                </span>
              </td>
              <td className="py-3 text-right font-medium text-gray-900">
                {money(b.totalAmount, b.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountingTab({ id }) {
  const [direction, setDirection] = useState('incoming');
  const { data: inData } = useQuery({
    queryKey: ['hotel-payments', id, 'incoming', 'all'],
    queryFn: () => hotelsApi.getPayments(id, { direction: 'incoming', filter: 'all' }),
  });
  const { data: outData } = useQuery({
    queryKey: ['hotel-payments', id, 'outgoing', 'all'],
    queryFn: () => hotelsApi.getPayments(id, { direction: 'outgoing', filter: 'all' }),
  });

  const inRows = inData?.data || [];
  const outRows = outData?.data || [];
  const totalIn = inRows.reduce((s, r) => s + (r.amount || 0), 0);
  const paidIn = inRows.filter((r) => r.paid).reduce((s, r) => s + (r.paidAmount || 0), 0);
  const totalOut = outRows.reduce((s, r) => s + (r.amount || 0), 0);
  const paidOut = outRows.filter((r) => r.paid).reduce((s, r) => s + (r.paidAmount || 0), 0);

  const cur = inRows[0]?.currency || outRows[0]?.currency || 'INR';

  return (
    <div className="mt-6 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SumCard label="Total Incoming" value={money(totalIn, cur)} cls="border-green-200 bg-green-50 text-green-700" />
        <SumCard label="Paid In" value={money(paidIn, cur)} cls="border-green-200 bg-green-50 text-green-600" />
        <SumCard label="Total Outgoing" value={money(totalOut, cur)} cls="border-red-200 bg-red-50 text-red-700" />
        <SumCard label="Paid Out" value={money(paidOut, cur)} cls="border-red-200 bg-red-50 text-red-600" />
      </div>

      {/* Direction tabs */}
      <div className="flex gap-3 border-b border-gray-200">
        {[['incoming', 'Incoming'], ['outgoing', 'Outgoing']].map(([k, l]) => (
          <button key={k} onClick={() => setDirection(k)}
            className={cn('border-b-2 pb-2 text-sm font-medium transition-colors',
              direction === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {l}
          </button>
        ))}
      </div>

      <div>
        {(direction === 'incoming' ? inRows : outRows).map((inst) => <InstRow key={inst._id} inst={inst} />)}
        {(direction === 'incoming' ? inRows : outRows).length === 0 && (
          <div className="py-8 text-center text-sm text-gray-400">No {direction} payments found.</div>
        )}
      </div>
    </div>
  );
}

function SumCard({ label, value, cls }) {
  return (
    <div className={cn('rounded-lg border p-4', cls)}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

export default function HotelDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('Details');
  const [imgModal, setImgModal] = useState(false);
  const [imgUrl, setImgUrl] = useState('');
  const [imgBroken, setImgBroken] = useState(false);

  const { data: h, isLoading } = useQuery({
    queryKey: ['hotel', id],
    queryFn: () => hotelsApi.get(id),
  });

  const toggle = useMutation({
    mutationFn: () => hotelsApi.update(id, { isActive: !h.isActive }),
    onSuccess: () => {
      toast.success(h.isActive ? 'Hotel disabled' : 'Hotel enabled');
      qc.invalidateQueries({ queryKey: ['hotel', id] });
      qc.invalidateQueries({ queryKey: ['hotels'] });
    },
  });

  const saveImage = useMutation({
    mutationFn: (url) => hotelsApi.update(id, { imageUrl: url }),
    onSuccess: () => {
      toast.success('Image updated');
      qc.invalidateQueries({ queryKey: ['hotel', id] });
      setImgModal(false);
      setImgUrl('');
      setImgBroken(false);
    },
    onError: () => toast.error('Failed to save image'),
  });

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!h) return <div className="py-20 text-center text-gray-500">Hotel not found.</div>;

  return (
    <div>
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-3">
        <div className="flex items-center gap-3 text-sm">
          <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft size={18} />
          </button>
          <span className="font-semibold text-gray-900">Hotel Details</span>
          <span className="text-gray-400">/</span>
          <Link to="/services/hotels" className="text-gray-500 hover:text-gray-800">Hotels</Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-500">{h.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/services/hotels/${id}/edit`} className="btn-secondary text-sm">
            <Pencil size={14} /> Edit
          </Link>
          <button onClick={() => toggle.mutate()} className="btn-secondary text-sm" disabled={toggle.isPending}>
            <Ban size={14} /> {h.isActive ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="grid gap-6 md:grid-cols-[1fr_280px]">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{h.name}</h1>
              {!h.isActive && <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600">Disabled</span>}
            </div>
            <div className="mt-3 grid max-w-xl gap-3">
              <Info label="Location">{h.locationLabel}</Info>
              <Info label="Category"><StarRating value={h.stars} /></Info>
              <Info label="Address">
                {(() => {
                  const loc = h.location || {};
                  const lines = [
                    [loc.street, loc.locality].filter(Boolean).join(', '),
                    loc.landmark ? `Near: ${loc.landmark}` : '',
                    [loc.city, loc.pin].filter(Boolean).join(' - '),
                    [loc.state, loc.country].filter(Boolean).join(', '),
                  ].filter(Boolean);
                  return lines.length ? lines.map((l, i) => <div key={i}>{l}</div>) : null;
                })()}
              </Info>
            </div>
          </div>

          <div>
            <div className="flex h-44 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {h.imageUrl && !imgBroken ? (
                <img
                  key={h.imageUrl}
                  src={h.imageUrl}
                  alt={h.name}
                  className="h-full w-full object-cover"
                  onError={() => setImgBroken(true)}
                />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <ImageOff className="text-gray-300" size={40} />
                  {imgBroken && <p className="text-xs text-gray-400">Image URL not accessible</p>}
                </div>
              )}
            </div>
            <button
              onClick={() => { setImgUrl(h.imageUrl || ''); setImgBroken(false); setImgModal(true); }}
              className="btn-secondary mt-2 w-full text-sm"
            >
              <Image size={14} /> {h.imageUrl ? 'Change Image' : 'Add Image URL'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 border-b border-gray-200">
          <div className="flex gap-6 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'whitespace-nowrap border-b-2 pb-2 text-sm font-medium',
                  tab === t ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {tab === 'Details' && (
          <div className="mt-6 grid gap-x-10 gap-y-6 md:grid-cols-2 lg:grid-cols-4">
            <Info label="Available Meal Plans">{(h.mealPlans || []).join(' • ') || '—'}</Info>
            <Info label="Check-In / Check-Out">{h.checkIn} hrs / {h.checkOut} hrs</Info>
            <Info label="Extra bed child ages">From {h.childEbAge?.from} to {h.childEbAge?.to} years</Info>
            <Info label="Payment Preference">{h.paymentPreference || 'Not Set'}</Info>
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-gray-400">Available Room Types</p>
              <div className="mt-1 space-y-1">
                {(h.roomTypes || []).map((r) => (
                  <div key={r.name} className="text-sm font-medium text-gray-900">
                    {r.name}{' '}
                    <span className="text-xs font-normal text-gray-400">
                      ({r.eb} EBs • {r.aweb} AWEBs • {r.cweb} CWEBs)
                    </span>
                  </div>
                ))}
                {!h.roomTypes?.length && <span className="text-sm text-gray-400">—</span>}
              </div>
            </div>
            <Info label="Trip Destinations">
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} className="text-gray-400" />
                {(h.destinations || []).map((d) => d.name).join(', ') || '—'}
              </span>
            </Info>
            <div className="md:col-span-4">
              <Link to={`/services/hotel-prices?hotel=${h._id}`} className="btn-primary text-sm">
                View / Add Prices
              </Link>
            </div>
          </div>
        )}

        {tab === 'Hotel Notes' && (
          <div className="mt-6 text-sm text-gray-700 whitespace-pre-wrap">{h.notes || 'No notes added.'}</div>
        )}

        {tab === 'Bookings' && <BookingsTab id={id} />}

        {tab === 'Payments' && <PaymentsTab id={id} direction="incoming" />}

        {tab === 'Accounting' && <AccountingTab id={id} />}

        {tab === 'Activities' && (
          <div className="mt-6 text-sm text-gray-400">Linked activities coming with the itinerary module.</div>
        )}

        <p className="mt-8 text-xs text-gray-400">
          Created on {format(new Date(h.createdAt), 'd MMM, yyyy')}
        </p>
      </div>

      {imgModal && (
        <Modal open onClose={() => setImgModal(false)} title="Hotel Image">
          <div className="space-y-4">
            {imgUrl && (
              <img src={imgUrl} alt="Preview" className="h-40 w-full rounded-lg border border-gray-200 object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            )}
            <div>
              <label className="label">Image URL</label>
              <input className="input" placeholder="https://example.com/hotel.jpg" value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} autoFocus />
              <p className="mt-1 text-xs text-gray-400">Paste any public image link (JPG, PNG, WebP).</p>
            </div>
            <div className="flex justify-end gap-2">
              {h.imageUrl && (
                <button onClick={() => saveImage.mutate('')} disabled={saveImage.isPending} className="btn-secondary text-sm text-red-600">Remove</button>
              )}
              <button onClick={() => saveImage.mutate(imgUrl.trim())} disabled={!imgUrl.trim() || saveImage.isPending} className="btn-primary text-sm">
                {saveImage.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
