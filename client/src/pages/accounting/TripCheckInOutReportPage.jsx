import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { reportsApi } from '../../api/reports.js';
import { money } from '../../lib/pricing.js';
import { cn } from '../../lib/cn.js';

export default function TripCheckInOutReportPage() {
  const [direction, setDirection] = useState('checkout'); // checkout | checkin
  const [monthDate, setMonthDate] = useState(startOfMonth(new Date()));
  const after = startOfMonth(monthDate);
  const before = endOfMonth(monthDate);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['trip-cico', direction, after.toISOString()],
    queryFn: () => reportsApi.tripCheckInOut({ direction, after: after.toISOString(), before: before.toISOString() }),
  });
  const items = data?.items || [];
  const totals = data?.totals || { packages: 0, bookings: 0 };

  const downloadCsv = () => {
    const head = ['Id', 'Guest', 'Start', 'End', 'Package', 'Tax', 'Bookings', 'Profit', 'Profit %'];
    const rows = items.map((r) => [r.bookingNumber, r.guest?.name, fmtD(r.startDate), fmtD(r.endDate), r.package, r.tax, r.bookings, r.profit, r.profitPct]);
    const csv = [head, ...rows].map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `trip-${direction}-report.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-bold text-slate-900">Trip Check In/Out Report</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonthDate((d) => addMonths(d, -1))} className="btn-secondary px-2"><ChevronLeft size={16} /></button>
          <span className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium">{format(monthDate, 'MMMM yyyy')}</span>
          <button onClick={() => setMonthDate((d) => addMonths(d, 1))} className="btn-secondary px-2"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="flex">
        <aside className="w-44 shrink-0 border-r border-slate-200 bg-white py-4">
          {[{ k: 'checkout', l: 'Check Outs' }, { k: 'checkin', l: 'Check Ins' }].map((t) => (
            <button key={t.k} onClick={() => setDirection(t.k)} className={cn('block w-full px-5 py-2.5 text-left text-sm', direction === t.k ? 'border-l-2 border-brand-600 bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50')}>
              {t.l}
            </button>
          ))}
        </aside>

        <div className="min-w-0 flex-1 px-6 py-5">
          <p className="mb-3 text-base font-semibold text-slate-800">{format(after, 'EEE d MMM')} – {format(before, 'EEE d MMM')}</p>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border-l-4 border-brand-400 bg-white px-5 py-4 shadow-sm">
            <Stat label={direction === 'checkout' ? 'Total Check-Outs' : 'Total Check-Ins'} value={data?.count ?? 0} big />
            <Stat label="Total Packages" value={money(totals.packages)} />
            <Stat label="Total Bookings" value={money(totals.bookings)} />
            <button onClick={downloadCsv} className="btn-primary"><Download size={15} /> Download Report</button>
          </div>

          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            Showing {items.length} Items
            <button onClick={() => refetch()} className="text-slate-400 hover:text-slate-700"><RefreshCw size={14} /></button>
          </div>

          <div className="card card-flush overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Id</th>
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Start</th>
                  <th className="px-4 py-3">End</th>
                  <th className="px-4 py-3 text-right">Package</th>
                  <th className="px-4 py-3 text-right">Tax (Estm.)</th>
                  <th className="px-4 py-3 text-right">Bookings</th>
                  <th className="px-4 py-3 text-right">Profit (Estm.)</th>
                  <th className="px-4 py-3 text-right">Profit %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={9} className="py-12 text-center text-slate-400">Loading…</td></tr>
                ) : !items.length ? (
                  <tr><td colSpan={9} className="py-12 text-center text-slate-400">No trips in this period.</td></tr>
                ) : items.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><Link to={`/bookings/${r._id}`} className="font-medium text-brand-700 hover:underline">{r.bookingNumber}</Link></td>
                    <td className="px-4 py-3 text-slate-700">{r.guest?.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtD(r.startDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmtD(r.endDate)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(r.package, r.currency)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{r.tax ? money(r.tax, r.currency) : 'exc'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.bookings ? money(r.bookings, r.currency) : 'N/A'}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(r.profit, r.currency)}</td>
                    <td className={cn('px-4 py-3 text-right tabular-nums', r.profitPct < 0 ? 'text-rose-600' : 'text-slate-700')}>{r.profitPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const fmtD = (d) => (d ? format(new Date(d), 'd MMM') : '—');

function Stat({ label, value, big }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn('mt-0.5 font-bold text-slate-900', big ? 'text-2xl' : 'text-lg')}>{value}</p>
    </div>
  );
}
