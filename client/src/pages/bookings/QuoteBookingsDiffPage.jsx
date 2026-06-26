import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { bookingsApi } from '../../api/bookings.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { cn } from '../../lib/cn.js';

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'on_trip', label: 'On Trip' },
  { key: 'past', label: 'Past' },
  { key: 'all', label: 'All' },
];

const paxLabel = (pax) => {
  if (!pax) return '';
  const a = pax.adults || 0;
  const c = (pax.children || []).length;
  return `${a}A${c ? `, ${c}C` : ''}`;
};

export default function QuoteBookingsDiffPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['quote-diff', tab, debounced],
    queryFn: () => bookingsApi.quoteDiff({ tab, search: debounced, limit: 50 }),
  });
  const items = data?.data || [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['quote-diff'] });
  const dt = (d) => (d ? format(new Date(d), 'd MMM') : '—');

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Trip Quote &amp; Booking Diffs</h1>
        <div className="flex w-72 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Search size={15} className="text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full text-sm outline-none" />
        </div>
      </div>

      <div className="flex gap-6">
        <aside className="w-36 shrink-0 space-y-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={cn('block w-full rounded-lg px-3 py-2 text-left text-sm', tab === t.key ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50')}>
              {t.label}
            </button>
          ))}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            Showing {data?.meta?.total ?? items.length} Items
            <button onClick={refresh} className="text-slate-400 hover:text-slate-700"><RefreshCw size={14} /></button>
          </div>
          <div className="card card-flush overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Trip ID</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">Reservations</th>
                  <th className="px-4 py-3">Last Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={4} className="py-12 text-center text-slate-400">Loading…</td></tr>
                ) : !items.length ? (
                  <tr><td colSpan={4} className="py-12 text-center text-slate-400">No bookings with quotes.</td></tr>
                ) : items.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3"><Link to={`/bookings/${b._id}`} className="font-medium text-brand-700 hover:underline">{b.bookingNumber}</Link></td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{b.title || b.guest?.name || '—'}</div>
                      <div className="text-xs text-slate-400">{dt(b.startDate)} · {b.nights ? `${b.nights}N` : ''} · {paxLabel(b.pax)}</div>
                    </td>
                    <td className="px-4 py-3">
                      {b.hasDiff
                        ? <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Diff</span>
                        : <span className="rounded border border-green-300 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">In sync</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{b.lastChange ? `on ${format(new Date(b.lastChange), 'd MMM, yyyy')}` : '—'}</td>
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
