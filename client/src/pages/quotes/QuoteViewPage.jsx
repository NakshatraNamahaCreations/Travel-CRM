import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, Pencil, CalendarCheck, FileText, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { quotesApi } from '../../api/quotes.js';
import { bookingsApi } from '../../api/bookings.js';
import { money } from '../../lib/pricing.js';
import { cn } from '../../lib/cn.js';
import { tripNo } from '../../lib/format.js';
import SharePackageModal from '../../components/quotes/SharePackageModal.jsx';

const STATUS_BADGE = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-50 text-blue-700',
  accepted: 'bg-green-50 text-green-700',
  rejected: 'bg-red-50 text-red-700',
};

export default function QuoteViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);

  const { data: q, isLoading } = useQuery({ queryKey: ['quote', id], queryFn: () => quotesApi.get(id) });

  const bookingMut = useMutation({
    mutationFn: () => bookingsApi.fromQuote(id),
    onSuccess: (booking) => { toast.success(`Booking #${booking.bookingNumber} created`); navigate(`/bookings/${booking._id}`); },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-20 text-center text-gray-400">Loading…</div>;
  if (!q) return <div className="py-20 text-center text-gray-500">Quote not found.</div>;

  const cur = q.currency;
  const guest = q.query?.guest;

  return (
    <div>
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-3 text-sm print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900"><ArrowLeft size={18} /></button>
          <span className="font-semibold text-gray-900">Quote #{q.quoteNumber}</span>
          {q.query && <><span className="text-gray-400">/</span><Link to={`/trips/${q.query._id}`} className="text-gray-500 hover:text-gray-800">Query #{tripNo(q.query.queryNumber)}</Link></>}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('rounded px-2 py-1 text-xs font-medium', STATUS_BADGE[q.status])}>{q.status}</span>
          <Link to={`/quotes/${id}/edit`} className="btn-secondary text-sm"><Pencil size={14} /> Edit</Link>
          <button onClick={() => setShareOpen(true)} className="btn-secondary text-sm"><Share2 size={14} /> Share</button>
          <Link to={`/quotes/${id}/quotation`} className="btn-primary text-sm"><FileText size={14} /> Quotation PDF</Link>
          <button onClick={() => bookingMut.mutate()} className="btn-primary text-sm" disabled={bookingMut.isPending}><CalendarCheck size={14} /> {bookingMut.isPending ? 'Converting…' : 'Convert to Booking'}</button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Letterhead */}
        <div className="flex items-start justify-between border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{q.title || 'Travel Quote'}</h1>
            <p className="text-sm text-gray-500">Quote #{q.quoteNumber} · {format(new Date(q.createdAt), 'd MMM yyyy')}</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-gray-900">Andaman Travel Care</p>
            <p className="text-gray-500">info@andamantravelcare.com</p>
            <p className="text-gray-500">+91 89009 12121</p>
          </div>
        </div>

        {/* Guest + trip */}
        <div className="grid gap-6 border-b border-gray-200 py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Prepared for</p>
            <p className="font-medium text-gray-900">{[guest?.salutation, guest?.name].filter(Boolean).join(' ') || '—'}</p>
            {guest?.phones?.[0] && <p className="text-sm text-gray-500">+{guest.phones[0].countryCode} {guest.phones[0].number}</p>}
            {guest?.email && <p className="text-sm text-gray-500">{guest.email}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-xs uppercase tracking-wide text-gray-400">Trip</p>
            <p className="font-medium text-gray-900">{(q.query?.destinations || []).map((d) => d.name).join(', ')}</p>
            <p className="text-sm text-gray-500">
              {q.startDate ? format(new Date(q.startDate), 'd MMM yyyy') : 'Flexible'} · {q.nights}N / {q.nights + 1}D · {q.pax?.adults} Adults{q.pax?.children?.length ? `, ${q.pax.children.length} Child` : ''}
            </p>
          </div>
        </div>

        {/* Package options */}
        {q.packages?.length > 0 && (
          <div className="border-b border-gray-200 py-6">
            <h2 className="mb-3 font-semibold text-gray-900">Package Options</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {q.packages.map((p, i) => (
                <div key={p._id || i} className={cn('rounded-lg border p-4', q.selectedPackageIndex === i ? 'border-brand-300 bg-brand-50/40' : 'border-gray-200')}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{p.name}</h3>
                    {q.selectedPackageIndex === i && <span className="rounded bg-brand-600 px-2 py-0.5 text-xs text-white">Selected</span>}
                  </div>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{money(p.sellingPrice, cur)}</p>
                  <p className="text-xs text-gray-400">{p.taxApplied ? `incl. ${p.taxName} ${p.taxPercent}%` : `${p.taxName || 'GST'}: Excluded`} · {p.hotels?.length || 0} hotel(s), {p.transports?.length || 0} day transfers</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Itinerary — day-wise grid */}
        {q.days?.length > 0 && (
          <div className="border-b border-gray-200 py-6">
            <h2 className="mb-3 font-semibold text-gray-900">Itinerary</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {q.days.map((d) => (
                <div key={d._id || d.dayNumber} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="h-6 shrink-0 rounded-full bg-brand-600 px-2 text-xs font-semibold leading-6 text-white">Day {d.dayNumber}</span>
                    <p className="truncate font-medium text-gray-900">{d.title || `Day ${d.dayNumber}`}</p>
                  </div>
                  {d.description ? (
                    <div className="space-y-0.5 text-sm text-gray-600">
                      {String(d.description).split('\n').filter(Boolean).map((line, li) => (
                        <p key={li}>- {line}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">Leisure day</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Costing */}
        <div className="py-6">
          <h2 className="mb-3 font-semibold text-gray-900">Cost Breakup</h2>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 text-left text-xs uppercase text-gray-400">
              <tr><th className="py-2">Item</th><th className="text-center">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr>
            </thead>
            <tbody>
              {q.costItems.map((it) => (
                <tr key={it._id} className="border-b border-gray-100">
                  <td className="py-2"><span className="font-medium text-gray-900">{it.label}</span>{it.meta && <span className="ml-1 text-xs text-gray-400">({it.meta})</span>}</td>
                  <td className="text-center text-gray-600">{it.qty}</td>
                  <td className="text-right text-gray-600">{money(it.rate, cur)}</td>
                  <td className="text-right font-medium">{money(it.amount, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{money(q.pricing.subtotal, cur)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Markup</span><span>{money(q.pricing.markup, cur)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{money(q.pricing.tax, cur)}</span></div>
            <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-bold text-gray-900"><span>Total</span><span>{money(q.pricing.total, cur)}</span></div>
          </div>
        </div>
      </div>

      <SharePackageModal quoteId={id} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
