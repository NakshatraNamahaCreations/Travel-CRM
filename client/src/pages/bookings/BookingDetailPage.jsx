import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Printer, Wallet, User, Pencil, Bed, ChevronRight, Phone, Mail,
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import { bookingsApi } from '../../api/bookings.js';
import { quotesApi } from '../../api/quotes.js';
import { queriesApi } from '../../api/queries.js';
import { money } from '../../lib/pricing.js';
import { cn } from '../../lib/cn.js';
import { tripNo } from '../../lib/format.js';
import ServiceBookingsTab from '../../components/trips/ServiceBookingsTab.jsx';
import SharePackageModal from '../../components/quotes/SharePackageModal.jsx';
import { QuotesTab, AccountingTab, DocsTab, ActivitiesTab } from '../trips/QueryDetailPage.jsx';

const STATUSES = [
  { value: 'confirmed',  label: 'Confirmed' },
  { value: 'on_trip',    label: 'On Trip' },
  { value: 'completed',  label: 'Completed' },
  { value: 'cancelled',  label: 'Cancelled' },
];
const BADGE = {
  confirmed:  'bg-blue-50 text-blue-700',
  on_trip:    'bg-purple-50 text-purple-700',
  completed:  'bg-green-50 text-green-700',
  cancelled:  'bg-red-50 text-red-700',
};
const TABS = [
  { key: 'basic',      label: 'Basic Details' },
  { key: 'quotes',     label: 'All Quotes' },
  { key: 'services',   label: 'Services Bookings' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'docs',       label: 'Docs' },
  { key: 'activities', label: 'Activities' },
];

const ordinal = (n) => {
  if (!n) return '—';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const paxSummary = (pax) => {
  if (!pax) return '';
  const a = pax.adults || 0;
  const c = (pax.children || []).length;
  return `${a} Adult${a !== 1 ? 's' : ''}${c ? `, ${c} Child` : ''}`;
};

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('basic');
  const [shareQuoteId, setShareQuoteId] = useState(null);

  const { data: b, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingsApi.get(id),
  });

  const queryId = b?.query?._id || null;

  // Parent query for source / tags meta
  const { data: tripQ } = useQuery({
    queryKey: ['query-basic', queryId],
    queryFn: () => queriesApi.get(queryId),
    enabled: !!queryId,
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ['quotes', queryId],
    queryFn: () => quotesApi.listForQuery(queryId),
    enabled: !!queryId,
  });
  const selQuoteId = (quotes.find((x) => x.status === 'accepted') || quotes[0])?._id;
  const { data: fullQuote } = useQuery({
    queryKey: ['quote-full', selQuoteId],
    queryFn: () => quotesApi.get(selQuoteId),
    enabled: !!selQuoteId,
  });

  const statusMut = useMutation({
    mutationFn: (status) => bookingsApi.setStatus(id, status),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['booking', id] });
      qc.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!b) return <div className="py-20 text-center text-gray-500">Booking not found.</div>;

  const cur = b.currency || 'INR';
  const guestName = [b.guest?.salutation, b.guest?.name].filter(Boolean).join(' ') || 'Guest';
  const phone = b.guest?.phones?.find((p) => p.isPrimary)?.number || b.guest?.phones?.[0]?.number;
  const phoneCC = b.guest?.phones?.find((p) => p.isPrimary)?.countryCode || b.guest?.phones?.[0]?.countryCode || '';
  const email = b.guest?.email;
  const destLabel = (b.destinations || []).map((d) => d?.name).filter(Boolean).join(', ');
  // source can be a populated QuerySource object or a plain string
  const sourceLabel = tripQ?.source
    ? (typeof tripQ.source === 'string' ? tripQ.source : tripQ.source?.name)
    : null;

  // Accepted quote package
  const selPkg = fullQuote?.packages?.[fullQuote?.selectedPackageIndex ?? 0] || fullQuote?.packages?.[0];
  const costPrice = fullQuote?.pricing?.cost || 0;

  // Derive hotel stays with dates
  const hotelStays = (selPkg?.hotels || []).filter((h) => !h.isAlternative).map((h) => {
    const nights = (h.nights || []).slice().sort((a, c) => a - c);
    const firstNight = nights[0] || 1;
    const checkIn = b.startDate ? addDays(new Date(b.startDate), firstNight - 1) : null;
    return { ...h, firstNight, checkIn };
  });

  const visibleTabs = queryId ? TABS : TABS.filter((t) => t.key === 'basic');
  const activeTab = visibleTabs.some((t) => t.key === tab) ? tab : 'basic';

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-white print:hidden">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 px-6 pt-3 text-xs text-gray-400">
          <button onClick={() => navigate(-1)} className="hover:text-gray-600"><ArrowLeft size={14} /></button>
          <span>Trip Details</span>
          <ChevronRight size={12} />
          <span>Bookings</span>
          <ChevronRight size={12} />
          <span className="text-gray-600">Current</span>
        </div>

        {/* Title + actions */}
        <div className="flex items-start justify-between px-6 pt-2 pb-1">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              #{b.bookingNumber}
              {guestName ? ` · ${guestName}` : ''}
              {destLabel ? ` · ${destLabel}` : ''}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {sourceLabel && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{sourceLabel}</span>
              )}
              <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', BADGE[b.status])}>
                Converted → {STATUSES.find((s) => s.value === b.status)?.label || b.status}
              </span>
              {b.query && (
                <Link to={`/trips/${queryId}`} className="text-xs text-brand-600 hover:underline">
                  Query #{tripNo(b.query.queryNumber)}
                </Link>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <select
              className="input w-36 text-sm"
              value={b.status}
              onChange={(e) => statusMut.mutate(e.target.value)}
              disabled={statusMut.isPending}
            >
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button onClick={() => window.print()} className="btn-secondary text-sm">
              <Printer size={14} /> Voucher
            </button>
          </div>
        </div>

        {/* Meta row: date · nights · pax · package price · owner */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-6 py-1.5 text-sm text-gray-600">
          {b.startDate && (
            <span>📅 {format(new Date(b.startDate), 'd MMM yyyy')} · {b.nights}N, {(b.nights || 0) + 1}D</span>
          )}
          {b.pax && <span>👥 {paxSummary(b.pax)}</span>}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Package (INR)</span>
            <span className="text-base font-bold text-gray-900">
              {new Intl.NumberFormat('en-IN').format(b.totalAmount || 0)}
            </span>
            <span className="text-xs text-gray-400">5% GST</span>
          </div>
          {b.owner?.name && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <User size={12} /> {b.owner.name}
            </span>
          )}
        </div>

        {/* Guest row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 pb-3 text-sm">
          <span className="font-medium text-gray-800">{guestName}</span>
          {phone && (
            <span className="flex items-center gap-1 text-gray-500">
              <Phone size={12} /> {phoneCC ? `+${phoneCC} ` : ''}{phone}
            </span>
          )}
          {email && (
            <span className="flex items-center gap-1 text-gray-500">
              <Mail size={12} /> {email}
            </span>
          )}
          {b.pax?.adults != null && (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
              {b.pax.adults}A{(b.pax.children || []).length ? ` + ${b.pax.children.length}C` : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Sticky Tab Bar ─────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center gap-6 overflow-x-auto border-b border-gray-200 bg-white px-6 shadow-sm print:hidden">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap border-b-2 py-3 text-sm font-medium',
              activeTab === t.key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-800',
            )}
          >
            {t.label}
            {t.key === 'quotes' && quotes.length ? (
              <span className="rounded-full bg-gray-100 px-1.5 text-xs">{quotes.length}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── Basic Details (two-column) ──────────────────────── */}
      {activeTab === 'basic' && (
        <div className="flex gap-5 px-6 py-5">
          {/* Main column */}
          <div className="min-w-0 flex-1">
            {/* Latest Quote card */}
            <div className="card mb-4 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Latest Quote</p>
              <p className="mt-1 text-xs text-gray-500">Package Quote Price</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <span className="text-2xl font-bold text-brand-700">{money(b.totalAmount, cur)}</span>
                <span className="text-xs text-gray-400">(inc. 5% GST)</span>
                {costPrice > 0 && (
                  <>
                    <span className="text-gray-200">/</span>
                    <span className="text-sm text-gray-500">{money(costPrice, cur)}</span>
                    <span className="text-xs text-gray-400">(cost price)</span>
                  </>
                )}
              </div>
              {b.createdAt && (
                <p className="mt-1 text-xs text-gray-400">
                  {format(new Date(b.createdAt), 'd MMM yyyy')}
                  {b.owner?.name ? ` by ${b.owner.name}` : ''}
                </p>
              )}
              {queryId && (
                <div className="mt-3">
                  <Link to={`/trips/${queryId}`} className="btn-secondary text-xs">View Trip</Link>
                </div>
              )}
            </div>

            {/* Trip summary line */}
            {b.startDate && (
              <p className="mb-3 text-sm text-gray-600">
                {format(new Date(b.startDate), 'd MMM, yyyy')} for {(b.nights || 0) + 1} Days · {paxSummary(b.pax)}
              </p>
            )}

            {/* Accommodation table */}
            {hotelStays.length > 0 && (
              <div className="mb-5">
                <h2 className="mb-2 font-semibold text-gray-900">Services</h2>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Bed size={16} className="text-brand-400" />
                  Accommodation
                </div>
                <div className="card card-flush overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                      <tr>
                        <th className="px-4 py-2">Night</th>
                        <th className="px-4 py-2">Hotel</th>
                        <th className="px-4 py-2">Meal</th>
                        <th className="px-4 py-2">Rooms</th>
                        <th className="px-4 py-2 text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {hotelStays.map((h, i) => (
                        <tr key={i} className="align-top">
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-gray-800">{ordinal(h.firstNight)}</div>
                            {h.checkIn && (
                              <div className="text-xs text-gray-400">{format(h.checkIn, 'd MMM')}</div>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-brand-700">{h.hotelName}</div>
                            <div className="text-xs text-gray-400">
                              {h.city}{h.stars ? `, ${h.stars} Star` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-gray-600">{h.mealPlan || '—'}</td>
                          <td className="px-4 py-2.5">
                            <div className="text-gray-800">
                              {h.rooms ? `${h.rooms} ` : ''}{h.roomType || '—'}
                            </div>
                            {(h.aweb > 0 || h.cweb > 0) && (
                              <div className="text-xs text-gray-400">
                                {h.aweb > 0 ? `+ ${h.aweb} AWEB` : ''}
                                {h.cweb > 0 ? ` + ${h.cweb} CWEB` : ''}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="font-medium text-gray-900">{money(h.amount, cur)}</div>
                            <div className="text-xs text-gray-400">/ N/A</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Itinerary */}
            {b.days?.length > 0 && (
              <div>
                <h2 className="mb-3 font-semibold text-gray-900">Itinerary</h2>
                <div className="space-y-3">
                  {b.days.map((d) => (
                    <div key={d._id || d.dayNumber} className="flex gap-3">
                      <span className="mt-0.5 h-6 shrink-0 rounded-full bg-brand-600 px-2 text-xs font-semibold leading-6 text-white">
                        Day {d.dayNumber}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{d.title || `Day ${d.dayNumber}`}</p>
                        {d.description && <p className="text-sm text-gray-600">{d.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Included Services (cost items snapshot) */}
            {!hotelStays.length && b.costItems?.length > 0 && (
              <div>
                <h2 className="mb-3 font-semibold text-gray-900">Included Services</h2>
                <ul className="space-y-1 text-sm text-gray-700">
                  {b.costItems.map((it) => (
                    <li key={it._id} className="flex justify-between border-b border-gray-50 py-1">
                      <span>{it.label}{it.meta && <span className="ml-1 text-xs text-gray-400">({it.meta})</span>}</span>
                      <span className="text-gray-500">{it.qty} × {money(it.rate, cur)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="w-56 shrink-0 space-y-3">
            {/* Arrival Details */}
            <div className="card p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Arrival Details</h3>
                <button className="text-gray-300 hover:text-gray-500"><Pencil size={13} /></button>
              </div>
              <p className="mt-1.5 text-sm text-gray-400">Not Set</p>
            </div>

            {/* Departure Details */}
            <div className="card p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Departure Details</h3>
                <button className="text-gray-300 hover:text-gray-500"><Pencil size={13} /></button>
              </div>
              <p className="mt-1.5 text-sm text-gray-400">Not Set</p>
            </div>

            {/* Financial summary */}
            <div className="card overflow-hidden p-0">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs font-semibold uppercase text-gray-400">Total</span>
                <span className="text-sm font-bold text-gray-900">{money(b.totalAmount, cur)}</span>
              </div>
              <div className="flex items-center justify-between bg-green-50 px-3 py-2">
                <span className="text-xs font-semibold uppercase text-green-600">Paid</span>
                <span className="text-sm font-bold text-green-700">{money(b.paidAmount, cur)}</span>
              </div>
              <div className="flex items-center justify-between bg-red-50 px-3 py-2">
                <span className="text-xs font-semibold uppercase text-red-500">Balance Due</span>
                <span className="text-sm font-bold text-red-600">{money(b.balanceDue, cur)}</span>
              </div>
            </div>
            <Link
              to={`/accounting/payments?booking=${b._id}`}
              className="btn-secondary block w-full text-center text-xs"
            >
              <Wallet size={12} className="mr-1 inline" /> Record / View Payments
            </Link>
          </div>
        </div>
      )}

      {/* ── Other tabs ─────────────────────────────────────── */}
      {activeTab !== 'basic' && (
        <div className="px-6 py-5">
          {activeTab === 'quotes'     && <QuotesTab id={queryId} quotes={quotes} onShare={setShareQuoteId} />}
          {activeTab === 'services'   && <ServiceBookingsTab queryId={queryId} quote={fullQuote} startDate={b.startDate} />}
          {activeTab === 'accounting' && <AccountingTab id={queryId} bookingId={id} totalAmount={b.totalAmount} />}
          {activeTab === 'docs'       && <DocsTab quotes={quotes} queryId={queryId} />}
          {activeTab === 'activities' && <ActivitiesTab id={queryId} />}
        </div>
      )}

      <SharePackageModal quoteId={shareQuoteId} open={!!shareQuoteId} onClose={() => setShareQuoteId(null)} />
    </div>
  );
}
