import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Copy as CopyIcon, FileText, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { quotesApi } from '../../api/quotes.js';
import { serviceBookingsApi } from '../../api/serviceBookings.js';
import { cn } from '../../lib/cn.js';

/* Docs tab (Sembark-style): Trip / Hotels / Activity confirmation vouchers.
   The document itself is rendered server-side (same HTML as the PDF) and
   previewed in an iframe, so preview and PDF always match. */

const VOUCHERS = [
  { key: 'trip', label: 'Trip Voucher' },
  { key: 'hotels', label: 'Hotels Voucher' },
  { key: 'activity', label: 'Activity Voucher' },
];

export default function DocsVouchers({ queryId, quotes }) {
  const accepted = quotes.find((x) => x.status === 'accepted') || quotes[0];
  const [type, setType] = useState('trip');
  const [opts, setOpts] = useState({ prices: false, removeBranding: false, removeItinerary: false, bankAccount: false, tnc: true });
  const toggle = (k) => setOpts((o) => ({ ...o, [k]: !o[k] }));

  const params = {
    type,
    prices: opts.prices ? 1 : 0,
    removeBranding: opts.removeBranding ? 1 : 0,
    removeItinerary: opts.removeItinerary ? 1 : 0,
    bankAccount: opts.bankAccount ? 1 : 0,
    tnc: opts.tnc ? 1 : 0,
  };

  const { data: html, isFetching, refetch } = useQuery({
    queryKey: ['voucher', accepted?._id, type, params],
    queryFn: () => quotesApi.voucherHtml(accepted._id, params),
    enabled: !!accepted,
  });
  const { data: sbs = [] } = useQuery({
    queryKey: ['service-bookings', queryId],
    queryFn: () => serviceBookingsApi.list(queryId),
    enabled: !!queryId,
  });

  const pendingOf = (kinds) => sbs.filter((s) => kinds.includes(s.kind) && s.status === 'initialized').length;
  const warning =
    type === 'hotels' && pendingOf(['hotel'])
      ? `There are pending hotel bookings for this Trip. Please book all hotels before sharing.`
      : type === 'activity' && pendingOf(['operational'])
        ? `There are pending activity bookings for this Trip. Please book all activities before sharing.`
        : type === 'trip' && pendingOf(['hotel', 'operational', 'flight'])
          ? `There are pending bookings for this Trip. Please book all services before sharing.`
          : null;

  const fileBase = `TRIP-ID-${accepted?.quoteNumber || ''}-${type.toUpperCase()}-VOUCHER`;

  const doCopy = async () => {
    if (!html) return;
    const dom = new DOMParser().parseFromString(html, 'text/html');
    dom.querySelectorAll('.wm, .pghead, .footbanner').forEach((el) => el.remove());
    await navigator.clipboard.writeText((dom.body.innerText || dom.body.textContent || '').trim());
    toast.success('Voucher copied to clipboard');
  };

  const doPdf = async () => {
    const t = toast.loading('Preparing PDF…');
    try {
      const blob = await quotesApi.voucherPdf(accepted._id, params);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      toast.error('Could not generate the PDF');
    } finally {
      toast.dismiss(t);
    }
  };

  const doWord = () => {
    if (!html) return;
    const blob = new Blob([html], { type: 'application/msword' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileBase}.doc`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!accepted) {
    return <div className="card p-8 text-center text-sm text-gray-400">No quote to generate documents from yet.</div>;
  }

  return (
    <div className="flex gap-6">
      <aside className="w-44 shrink-0 space-y-1">
        {VOUCHERS.map((v) => (
          <button
            key={v.key}
            onClick={() => setType(v.key)}
            className={cn(
              'block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold',
              type === v.key ? 'border-l-2 border-brand-600 bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            {v.label}
          </button>
        ))}
      </aside>

      <div className="min-w-0 flex-1">
        {warning && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">
            ⚠ {warning}
          </div>
        )}

        {/* Options toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm">
          {[
            ['prices', 'Prices'],
            ['removeBranding', 'Remove Branding'],
            ...(type === 'trip' ? [['removeItinerary', 'Remove Full Itinerary'], ['tnc', 'TnC']] : []),
            ['bankAccount', 'Bank Account'],
          ].map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center gap-1.5 font-medium text-gray-700">
              <input type="checkbox" checked={!!opts[k]} onChange={() => toggle(k)} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
              {label}
            </label>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => refetch()} title="Refresh" className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:text-gray-800">
              <RefreshCw size={14} className={cn(isFetching && 'animate-spin')} />
            </button>
            <button onClick={doCopy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"><CopyIcon size={13} /> Copy</button>
            <button onClick={doPdf} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-brand-700"><FileText size={13} /> PDF</button>
            <button onClick={doWord} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:text-brand-700"><FileDown size={13} /> Word</button>
          </div>
        </div>

        {/* Server-rendered preview — identical HTML to the PDF */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {html ? (
            <iframe title="Voucher preview" srcDoc={html} className="h-[78vh] w-full" />
          ) : (
            <div className="py-24 text-center text-gray-400">{isFetching ? 'Generating voucher…' : 'No preview available.'}</div>
          )}
        </div>
      </div>
    </div>
  );
}
