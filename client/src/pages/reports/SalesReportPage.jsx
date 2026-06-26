import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Download, Phone, RefreshCw } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, addMonths,
  startOfWeek, endOfWeek, addWeeks, startOfYear, endOfYear, addYears,
} from 'date-fns';
import { reportsApi } from '../../api/reports.js';
import { money } from '../../lib/pricing.js';
import { cn } from '../../lib/cn.js';
import { tripNo } from '../../lib/format.js';

const INTERVALS = {
  Week: { start: startOfWeek, end: endOfWeek, add: addWeeks, label: (d) => `Week of ${format(startOfWeek(d), 'd MMM yyyy')}` },
  Month: { start: startOfMonth, end: endOfMonth, add: addMonths, label: (d) => format(d, 'MMMM yyyy') },
  Year: { start: startOfYear, end: endOfYear, add: addYears, label: (d) => format(d, 'yyyy') },
};

const STATUS_BADGE = {
  new_query: 'bg-blue-50 text-blue-700', in_progress: 'bg-amber-50 text-amber-700',
  converted: 'bg-green-50 text-green-700', on_trip: 'bg-purple-50 text-purple-700',
  past: 'bg-gray-100 text-gray-600', canceled: 'bg-red-50 text-red-700', dropped: 'bg-red-50 text-red-700',
};

function StatCard({ label, value, accent }) {
  return (
    <div className="flex-1 border-l-2 px-5 py-1 first:border-l-0" style={{ borderColor: accent || 'transparent' }}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export default function SalesReportPage() {
  const [interval, setInterval] = useState('Month');
  const [cursor, setCursor] = useState(new Date());
  const cfg = INTERVALS[interval];
  const after = cfg.start(cursor);
  const before = cfg.end(cursor);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sales-report', interval, after.toISOString()],
    queryFn: () => reportsApi.sales({
      after: format(after, 'yyyy-MM-dd'), before: format(before, 'yyyy-MM-dd'),
      intervalType: interval.toLowerCase(), type: 'all',
    }),
  });

  const s = data?.summary || {};
  const items = data?.items || [];

  const download = () => {
    const headers = ['Id', 'Guest', 'Destinations', 'Nights', 'Start', 'Sales Person', 'Created', 'Amount', 'Profit', 'Profit %', 'Status'];
    const rows = items.map((i) => [
      tripNo(i.queryNumber),
      [i.guest?.salutation, i.guest?.name].filter(Boolean).join(' '),
      (i.destinations || []).map((d) => d.name).join('; '),
      i.nights, i.startDate ? format(new Date(i.startDate), 'yyyy-MM-dd') : '',
      i.owner?.name || '', format(new Date(i.createdAt), 'yyyy-MM-dd'),
      i.amount, i.profit, i.profitPercent, i.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c ?? '')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${format(after, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="px-6 py-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Sales Report</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(cfg.add(cursor, -1))} className="btn-secondary px-2"><ChevronLeft size={16} /></button>
          <select className="input w-32" value={interval} onChange={(e) => setInterval(e.target.value)}>
            {Object.keys(INTERVALS).map((k) => <option key={k}>{k}</option>)}
          </select>
          <button onClick={() => setCursor(cfg.add(cursor, 1))} className="btn-secondary px-2"><ChevronRight size={16} /></button>
        </div>
      </div>

      <h2 className="mb-4 text-2xl font-bold text-gray-900">{cfg.label(cursor)}</h2>

      {/* Summary */}
      <div className="card mb-5 flex flex-wrap divide-x divide-gray-100">
        <StatCard label="Revenue" value={money(s.revenue || 0)} accent="#2563eb" />
        <StatCard label="Profit" value={money(s.profit || 0)} />
        <StatCard label="Leads" value={s.leads ?? 0} />
        <StatCard label="Quotes" value={s.quotes ?? 0} />
        <StatCard label="Conversion" value={`${s.conversion ?? 0}${s.conversionPct != null ? ` (${s.conversionPct}%)` : ''}`} />
        <StatCard label="Dropped" value={s.dropped ?? 0} />
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-gray-500">
          Showing {items.length} Items
          <button onClick={() => refetch()} className="text-gray-400 hover:text-gray-700"><RefreshCw size={14} className={cn(isFetching && 'animate-spin')} /></button>
        </span>
        <button onClick={download} disabled={!items.length} className="btn-primary text-sm"><Download size={15} /> Download Report</button>
      </div>

      <div className="card card-flush overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs font-semibold tracking-normal text-slate-600">
            <tr>
              <th className="px-4 py-3">Id</th><th className="px-4 py-3">Guest</th><th className="px-4 py-3">Basic Details</th>
              <th className="px-4 py-3">Sales Person</th><th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Profit</th><th className="px-4 py-3 text-right">Profit %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={8} className="py-12 text-center text-gray-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="py-12 text-center text-gray-400">No results for this period.</td></tr>
            ) : (
              items.map((i) => (
                <tr key={i._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3"><Link to={`/trips/${i._id}`} className="font-semibold text-brand-600 hover:underline">{tripNo(i.queryNumber)}</Link></td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{[i.guest?.salutation, i.guest?.name].filter(Boolean).join(' ') || '—'}</div>
                    {i.guest?.phones?.[0] && <div className="flex items-center gap-1 text-xs text-gray-400"><Phone size={10} /> +{i.guest.phones[0].countryCode} {i.guest.phones[0].number}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {(i.destinations || []).map((d) => d.name).join(', ') || '—'}
                    <span className="text-gray-400"> • {i.nights}N{i.startDate ? ` • ${format(new Date(i.startDate), 'd MMM')}` : ''}</span>
                    <span className={cn('ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium', STATUS_BADGE[i.status])}>{i.status.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{i.owner?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{format(new Date(i.createdAt), 'd MMM')}</td>
                  <td className="px-4 py-3 text-right font-medium">{money(i.amount, i.currency)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{money(i.profit, i.currency)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{i.profitPercent}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
