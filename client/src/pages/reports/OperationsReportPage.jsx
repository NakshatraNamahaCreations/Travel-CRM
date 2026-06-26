import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, RefreshCw, Search, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { reportsApi } from '../../api/reports.js';
import { money } from '../../lib/pricing.js';
import { cn } from '../../lib/cn.js';
import { tripNo } from '../../lib/format.js';

const VIEWS = {
  followups: { title: 'Pending Follow-ups', kind: 'followups', buckets: [['all', 'All Pending'], ['today', 'Due Today'], ['yesterday', 'Overdue'], ['next7', 'Next 7 Days']] },
  starting: { title: 'Trips Starting', kind: 'trips', buckets: [['all', 'All'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['next7', 'Next 7 Days']] },
  ending: { title: 'Trips Ending', kind: 'trips', buckets: [['all', 'All'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['prev7', 'Previous 7 Days']] },
  'due-incoming': { title: 'Payments — Due Incoming', kind: 'trips', buckets: [['all', 'All Due'], ['today', 'Today'], ['yesterday', 'Yesterday']] },
  'live-due': { title: 'Live Trips with Due Payments', kind: 'trips', buckets: [['all', 'All'], ['live', 'Live'], ['endedYesterday', 'Ended Yesterday'], ['starts7', 'Starts in 7 Days']] },
};

const fdate = (d) => (d ? format(new Date(d), 'd MMM yyyy') : '—');
const guestName = (g) => [g?.salutation, g?.name].filter(Boolean).join(' ') || '—';
const csvCell = (c) => `"${String(c ?? '').replace(/"/g, '""')}"`;

function downloadCsv(rows, name) {
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function OperationsReportPage() {
  const { view } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const bucket = params.get('bucket') || 'all';
  const [search, setSearch] = useState('');

  const cfg = VIEWS[view];

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['ops-report', view, bucket],
    queryFn: () => reportsApi.trips({ view, bucket }),
    enabled: !!cfg,
  });

  const items = useMemo(() => {
    const list = data?.items || [];
    const t = search.trim().toLowerCase();
    if (!t) return list;
    return list.filter((i) => {
      const hay = cfg.kind === 'followups'
        ? `${i.body} ${guestName(i.query?.guest)} ${i.query?.queryNumber}`
        : `${guestName(i.guest)} ${i.bookingNumber} ${(i.destinations || []).map((d) => d.name).join(' ')}`;
      return hay.toLowerCase().includes(t);
    });
  }, [data, search, cfg]);

  if (!cfg) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-slate-500">Unknown report.</p>
        <Link to="/" className="btn-secondary mt-3 text-sm">Back to Dashboard</Link>
      </div>
    );
  }

  const setBucket = (b) => setParams(b === 'all' ? {} : { bucket: b });

  const exportCsv = () => {
    const stamp = format(new Date(), 'yyyy-MM-dd');
    if (cfg.kind === 'followups') {
      const header = ['Due Date', 'Task', 'Trip #', 'Guest', 'Assigned To', 'Created By'];
      const rows = items.map((i) => [fdate(i.dueDate), i.body, tripNo(i.query?.queryNumber), guestName(i.query?.guest), i.assignedTo?.name, i.createdBy?.name]);
      downloadCsv([header, ...rows], `${view}-${bucket}-${stamp}.csv`);
    } else {
      const header = ['Booking #', 'Guest', 'Destinations', 'Start', 'End', 'Nights', 'Owner', 'Status', 'Total', 'Paid', 'Balance Due'];
      const rows = items.map((i) => [
        i.bookingNumber, guestName(i.guest), (i.destinations || []).map((d) => d.name).join('; '),
        fdate(i.startDate), fdate(i.endDate), i.nights, i.owner?.name, i.status,
        i.totalAmount, i.paidAmount, i.balanceDue,
      ]);
      downloadCsv([header, ...rows], `${view}-${bucket}-${stamp}.csv`);
    }
  };

  const showMoney = cfg.kind === 'trips' && (view === 'due-incoming' || view === 'live-due');

  return (
    <div className="px-6 py-5">
      <div className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <button onClick={() => navigate('/')} className="hover:text-slate-700"><ArrowLeft size={16} /></button>
        <Link to="/" className="hover:text-slate-700">Dashboard</Link>
        <span>/</span>
        <span className="text-slate-600">{cfg.title}</span>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">{cfg.title}</h1>
        <div className="flex items-center gap-2">
          <select className="input w-44" value={bucket} onChange={(e) => setBucket(e.target.value)}>
            {cfg.buckets.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Search size={15} className="text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-40 bg-transparent text-sm outline-none" />
          </div>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-slate-500">
          Showing {items.length} {items.length === 1 ? 'item' : 'items'}
          <button onClick={() => refetch()} className="text-slate-400 hover:text-slate-700"><RefreshCw size={14} className={cn(isFetching && 'animate-spin')} /></button>
        </span>
        <button onClick={exportCsv} disabled={!items.length} className="btn-primary text-sm"><Download size={15} /> Export CSV</button>
      </div>

      <div className="card card-flush overflow-x-auto">
        {cfg.kind === 'followups' ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
              <tr><th className="px-4 py-3">Due</th><th className="px-4 py-3">Task</th><th className="px-4 py-3">Trip</th><th className="px-4 py-3">Assigned To</th><th className="px-4 py-3">Created By</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-400">No follow-ups for this period.</td></tr>
              ) : items.map((i) => (
                <tr key={i._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{i.dueDate ? format(new Date(i.dueDate), 'd MMM, h:mm a') : '—'}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{i.body}</td>
                  <td className="px-4 py-3">
                    {i.query ? <Link to={`/trips/${i.query._id}`} className="text-brand-600 hover:underline">#{tripNo(i.query.queryNumber)} · {guestName(i.query.guest)}</Link> : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{i.assignedTo?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{i.createdBy?.name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-4 py-3">Id</th><th className="px-4 py-3">Guest</th><th className="px-4 py-3">Basic Details</th>
                <th className="px-4 py-3">Sales Person</th><th className="px-4 py-3">Start</th><th className="px-4 py-3">End</th>
                {showMoney && <th className="px-4 py-3 text-right">Total</th>}
                {showMoney && <th className="px-4 py-3 text-right">Paid</th>}
                <th className="px-4 py-3 text-right">{showMoney ? 'Balance Due' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={9} className="py-12 text-center text-slate-400">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-slate-400">No trips for this period.</td></tr>
              ) : items.map((i) => (
                <tr key={i._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><Link to={`/bookings/${i._id}`} className="font-semibold text-brand-600 hover:underline">{i.bookingNumber}</Link></td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{guestName(i.guest)}</div>
                    {i.guest?.phones?.[0] && <div className="flex items-center gap-1 text-xs text-slate-400"><Phone size={10} /> +{i.guest.phones[0].countryCode} {i.guest.phones[0].number}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {(i.destinations || []).map((d) => d.name).join(', ') || '—'}
                    <span className="text-slate-400"> • {i.nights}N</span>
                    <span className={cn('ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium', i.status === 'on_trip' ? 'bg-purple-50 text-purple-700' : i.status === 'completed' ? 'bg-gray-100 text-gray-600' : 'bg-green-50 text-green-700')}>{i.status?.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{i.owner?.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{fdate(i.startDate)}</td>
                  <td className="px-4 py-3 text-slate-500">{fdate(i.endDate)}</td>
                  {showMoney && <td className="px-4 py-3 text-right text-slate-700">{money(i.totalAmount, i.currency)}</td>}
                  {showMoney && <td className="px-4 py-3 text-right text-slate-700">{money(i.paidAmount, i.currency)}</td>}
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{money(showMoney ? i.balanceDue : i.totalAmount, i.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
