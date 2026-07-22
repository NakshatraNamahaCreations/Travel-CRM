import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bed, Star, Calendar, Users, Plus, X, AlertTriangle, Share2 } from 'lucide-react';
import { format, formatDistanceToNow, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import { quotesApi } from '../../api/quotes.js';
import { queriesApi } from '../../api/queries.js';
import { bookingsApi } from '../../api/bookings.js';
import { tripNo } from '../../lib/format.js';
import { groupHotelOptions } from '../../lib/pricing.js';
import { cn } from '../../lib/cn.js';

const pkgOf = (quote) => quote?.packages?.[quote.selectedPackageIndex || 0] || quote?.packages?.[0] || null;
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const ord = (n) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);

// Two-column section: sticky explainer rail on the left, content card on the right.
function Section({ title, hint, children }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div>
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{hint}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export default function ConversionPage() {
  const { queryId, quoteId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: quote } = useQuery({ queryKey: ['quote', quoteId], queryFn: () => quotesApi.get(quoteId), enabled: !!quoteId });
  const { data: q } = useQuery({ queryKey: ['query', queryId], queryFn: () => queriesApi.get(queryId), enabled: !!queryId });

  const total = quote?.pricing?.total || 0;
  const [rows, setRows] = useState([]);
  const [comment, setComment] = useState('');
  const [verified, setVerified] = useState(false);

  // Default schedule: one full-amount instalment due today.
  useEffect(() => {
    if (total > 0 && !rows.length) {
      setRows([{ amount: total, percent: 100, dueDate: format(new Date(), 'yyyy-MM-dd') }]);
    }
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  const pct = (amount) => (total ? +((Number(amount) / total) * 100).toFixed(1) : 0);
  const setRow = (i, patch) => setRows((prev) => {
    const next = prev.map((r, idx) => {
      if (idx !== i) return r;
      const n = { ...r, ...patch };
      if (patch.amount !== undefined) n.percent = pct(patch.amount);
      if (patch.percent !== undefined) n.amount = Math.round((total * Number(patch.percent)) / 100);
      return n;
    });
    // Auto-balance: after editing an amount, the following instalment absorbs
    // the remaining balance and its due date lands 3 days after this one.
    if ((patch.amount !== undefined || patch.percent !== undefined) && i + 1 < next.length) {
      const othersSum = next.reduce((s, r, idx) => (idx === i + 1 ? s : s + (Number(r.amount) || 0)), 0);
      const remain = Math.max(0, total - othersSum);
      const baseDate = next[i].dueDate ? new Date(next[i].dueDate) : new Date();
      next[i + 1] = { ...next[i + 1], amount: remain, percent: pct(remain), dueDate: format(addDays(baseDate, 3), 'yyyy-MM-dd') };
    }
    return next;
  });
  // New instalments start prefilled with the remaining balance, due 3 days
  // after the previous instalment.
  const addRow = () => setRows((prev) => {
    const sum = prev.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const remain = Math.max(0, total - sum);
    const last = prev[prev.length - 1];
    const baseDate = last?.dueDate ? new Date(last.dueDate) : new Date();
    return [...prev, { amount: remain, percent: pct(remain), dueDate: format(addDays(baseDate, 3), 'yyyy-MM-dd') }];
  });
  const rmRow = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const convertMut = useMutation({
    mutationFn: () => bookingsApi.fromQuote(quoteId, {
      instalments: rows.map((r) => ({ amount: Number(r.amount) || 0, dueDate: r.dueDate || undefined })),
      comment,
    }),
    onSuccess: (b) => {
      toast.success(`Trip converted — booking #${b.bookingNumber || ''} created`);
      qc.invalidateQueries({ queryKey: ['query', queryId] });
      qc.invalidateQueries({ queryKey: ['quotes', queryId] });
      navigate(`/trips/${queryId}`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (!quote || !q) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const pkg = pkgOf(quote);
  const startDate = quote.startDate ? new Date(quote.startDate) : (q.startDate ? new Date(q.startDate) : null);
  const rowsSum = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const diff = total - rowsSum;
  const lastDue = rows.map((r) => r.dueDate).filter(Boolean).sort().slice(-1)[0];
  const lastDueAfterStart = lastDue && startDate && new Date(lastDue) > startDate;
  const warnings = [];
  if (Math.abs(diff) > 0) warnings.push(`Instalments total ${inr(rowsSum)} — ${diff > 0 ? `₹${diff.toLocaleString('en-IN')} less than` : `₹${Math.abs(diff).toLocaleString('en-IN')} more than`} the package price ${inr(total)}.`);
  if (lastDueAfterStart) warnings.push("The last instalment's due date is after the trip's start date. Generally, the full payment should be received before the trip starts to avoid payment issues during trip.");

  const gstNote = quote.taxPercent ? `(inc.${quote.taxPercent}% GST)` : '(exc. GST)';

  return (
    <div className="min-h-full bg-slate-50/70 pb-12">
      {/* Breadcrumb */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-6 py-3 text-sm backdrop-blur">
        <button onClick={() => navigate(-1)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><ArrowLeft size={17} /></button>
        <span className="font-bold text-slate-900">Conversion</span>
        <span className="text-slate-300">/</span>
        <Link to="/trips" className="text-slate-500 hover:text-slate-800">Trips</Link>
        <span className="text-slate-300">/</span>
        <Link to={`/trips/${queryId}`} className="text-slate-500 hover:text-slate-800">#{tripNo(q.queryNumber)}</Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-500">Quote #{quote.quoteNumber}</span>
      </div>

      <div className="space-y-8 px-6 py-6">
        {/* ---- Quote Used ---- */}
        <Section title="Quote Used" hint="Here are the quote details used in the process.">
          <div className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500">Package Quote Price</p>
                <p className="mt-1">
                  <span className="text-xs font-semibold text-slate-400">{quote.currency || 'INR'} </span>
                  <span className="text-xl font-bold text-brand-700">{(total).toLocaleString('en-IN')}</span>
                  <span className="text-xs text-slate-500"> {gstNote}</span>
                  <span className="text-slate-300"> / </span>
                  <span className="text-xs font-semibold text-slate-400">{quote.currency || 'INR'} </span>
                  <span className="text-sm font-semibold text-slate-700">{(quote.pricing?.subtotal || 0).toLocaleString('en-IN')}</span>
                  <span className="text-xs text-slate-400"> (cost price)</span>
                </p>
                <p className="mt-1.5 text-xs text-slate-400">
                  Created {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}{quote.createdBy?.name ? ` by ${quote.createdBy.name}` : ''}
                </p>
              </div>
              <Link to={`/quotes/${quoteId}`} className="btn-secondary text-sm"><Share2 size={14} /> View Quote</Link>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-2 text-sm text-slate-700">
              <span className="flex items-center gap-1.5"><Calendar size={14} className="text-slate-400" /> {startDate ? format(startDate, 'd MMM, yyyy') : 'Flexible'} for {(quote.nights || 0) + 1} Days</span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5"><Users size={14} className="text-slate-400" /> {quote.pax?.adults || 0} Adult{(quote.pax?.adults || 0) !== 1 ? 's' : ''}</span>
            </div>

            <h4 className="mt-5 font-bold text-slate-900">Services</h4>

            {/* Accommodation */}
            {pkg?.hotels?.length > 0 && (
              <div className="mt-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50"><Bed size={14} className="text-brand-600" /></span>
                  <p className="text-sm font-semibold text-slate-800">Accommodation</p>
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-slate-400"><tr><th className="px-3 py-2 font-medium">Night</th><th className="px-3 py-2 font-medium">Hotel</th><th className="px-3 py-2 font-medium">Meal</th><th className="px-3 py-2 text-right font-medium">Price</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupHotelOptions(pkg.hotels).map(({ base, opts }, i) => {
                        const billed = Math.max(...opts.map((o) => o.amount || 0));
                        return (
                          <tr key={i}>
                            <td className="px-3 py-2 text-slate-600">{(base.nights || []).map(ord).join(', ') || '—'}</td>
                            <td className="px-3 py-2">
                              {opts.map((o, k) => (
                                <span key={k}>
                                  {k > 0 && <span className="mx-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">OR</span>}
                                  <span className="font-medium text-slate-900">{o.hotelName}</span>
                                </span>
                              ))}
                              <span className="text-xs text-slate-400"> · {[...new Set(opts.map((o) => o.city).filter(Boolean))].join(' / ')}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{[...new Set(opts.map((o) => o.mealPlan).filter(Boolean))].join(' / ') || '—'}</td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-800">{billed ? inr(billed) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Hotel special inclusions */}
            {pkg?.inclusions?.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50"><Bed size={14} className="text-brand-600" /></span>
                  <p className="text-sm font-semibold text-slate-800">Hotel Special Inclusions</p>
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-slate-400"><tr><th className="px-3 py-2 font-medium">Night</th><th className="px-3 py-2 font-medium">Hotel</th><th className="px-3 py-2 font-medium">Service</th><th className="px-3 py-2 text-right font-medium">Price</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {pkg.inclusions.map((inc, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-slate-600">{inc.night ? ord(inc.night) : '—'}</td>
                          <td className="px-3 py-2 font-medium text-slate-900">{inc.hotelName || '—'}</td>
                          <td className="px-3 py-2 text-slate-700">{inc.service}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800">{inr(inc.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Other special services */}
            {pkg?.extras?.length > 0 && (
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50"><Star size={14} className="text-brand-600" /></span>
                  <p className="text-sm font-semibold text-slate-800">Other Special Inclusions</p>
                </div>
                <div className="overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-slate-400"><tr><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Service</th><th className="px-3 py-2 text-right font-medium">Price</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {pkg.extras.map((e, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-slate-600">{e.date ? format(new Date(e.date), 'd MMM') : '—'}</td>
                          <td className="px-3 py-2 font-medium text-slate-900">{e.label}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800">{inr(e.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!(quote.inclusions?.length || quote.exclusions?.length) && (
              <p className="mt-4 text-xs font-medium text-rose-500">Inclusions/Exclusions and Daywise Schedule not provided!</p>
            )}
          </div>
        </Section>

        <hr className="border-slate-200" />

        {/* ---- Instalments ---- */}
        <Section title="Instalments" hint="Please provide tentative instalments for this trip. Basic configuration has been created based on payment schedules.">
          <div className="card p-5">
            {/* Trip facts */}
            <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3 sm:grid-cols-5">
              <div><p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Trip Source</p><p className="text-sm font-bold text-slate-900">{q.source?.name || '—'}</p></div>
              <div><p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Start Date</p><p className="text-sm font-bold text-slate-900">{startDate ? format(startDate, 'd MMM, yyyy') : '—'}</p></div>
              <div><p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Duration</p><p className="text-sm font-bold text-slate-900">{quote.nights || 0} Nights, {(quote.nights || 0) + 1} Days</p></div>
              <div><p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Pax</p><p className="text-sm font-bold text-slate-900">{quote.pax?.adults || 0} Adult{(quote.pax?.adults || 0) !== 1 ? 's' : ''}</p></div>
              <div><p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Package</p><p className="text-sm font-bold text-slate-900">{inr(total)}</p></div>
            </div>

            {/* Instalment rows */}
            <p className="mt-4 text-sm font-semibold text-slate-800">Instalments</p>
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                  <tr><th className="px-3 py-2 w-12">#</th><th className="px-3 py-2">Amount (INR)</th><th className="px-3 py-2 w-28">%</th><th className="px-3 py-2">Due Date</th><th className="w-8" /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2.5 text-xs font-semibold text-slate-500">{ord(i + 1)}</td>
                      <td className="px-3 py-2.5"><input type="number" className="input w-36" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} /></td>
                      <td className="px-3 py-2.5"><div className="flex items-center gap-1"><input type="number" step="0.1" className="input w-20" value={r.percent} onChange={(e) => setRow(i, { percent: e.target.value })} /><span className="text-slate-400">%</span></div></td>
                      <td className="px-3 py-2.5"><input type="date" className="input w-44" value={r.dueDate} onChange={(e) => setRow(i, { dueDate: e.target.value })} /></td>
                      <td className="px-2 py-2.5 text-center">
                        {rows.length > 1 && <button onClick={() => rmRow(i)} className="text-slate-300 hover:text-red-500"><X size={14} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-slate-100 px-3 py-2">
                <button onClick={addRow} className="btn-secondary text-xs"><Plus size={12} /> Add Another Instalment</button>
              </div>
            </div>

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800"><AlertTriangle size={14} /> Please review following points regarding the instalments</p>
                <ul className="ml-6 mt-1.5 list-disc space-y-1 text-xs text-amber-700">
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {/* Comments */}
            <div className="mt-4">
              <label className="label">Comments</label>
              <textarea rows={3} className="input" placeholder="Any comments regarding verification or prices etc.." value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>

            {/* Verification */}
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800"><AlertTriangle size={14} /> Please make sure the above details are correct and have been verified with the client.</p>
              <p className="ml-6 mt-0.5 text-xs text-amber-700">If verified, please confirm by selecting the checkbox below</p>
              <label className="ml-6 mt-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                Yes. I have verified the details
              </label>
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
              <button
                onClick={() => convertMut.mutate()}
                disabled={!verified || convertMut.isPending || !rows.length}
                className={cn('btn-primary px-6', (!verified || !rows.length) && 'cursor-not-allowed opacity-50')}
              >
                {convertMut.isPending ? 'Converting…' : 'Convert Trip'}
              </button>
              <button onClick={() => navigate(-1)} disabled={convertMut.isPending} className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
