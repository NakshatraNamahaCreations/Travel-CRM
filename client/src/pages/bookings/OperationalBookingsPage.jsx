import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RefreshCw, Search, CalendarDays, List as ListIcon } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, addDays, isSameDay } from 'date-fns';
import { bookingsApi } from '../../api/bookings.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { cn } from '../../lib/cn.js';

export default function OperationalBookingsPage() {
  const [weekDate, setWeekDate] = useState(new Date());
  const [view, setView] = useState('calendar');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const start = startOfWeek(weekDate, { weekStartsOn: 0 });
  const end = endOfWeek(weekDate, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['operational', start.toISOString()],
    queryFn: () => bookingsApi.operational({ after: start.toISOString(), before: end.toISOString() }),
  });
  const allSchedules = data?.data || [];
  const schedules = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return allSchedules;
    return allSchedules.filter((s) => [s.serviceLocation, s.serviceType, s.guest?.name].some((v) => (v || '').toLowerCase().includes(q)));
  }, [allSchedules, debounced]);
  const today = new Date();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-bold text-slate-900">Operational Bookings</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-56 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
            <Search size={14} className="text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full text-sm outline-none" />
          </div>
          <button onClick={() => setWeekDate(new Date())} className="btn-secondary text-sm">Today</button>
          <button onClick={() => setWeekDate((d) => addWeeks(d, -1))} className="btn-secondary px-2"><ChevronLeft size={16} /></button>
          <button onClick={() => setWeekDate((d) => addWeeks(d, 1))} className="btn-secondary px-2"><ChevronRight size={16} /></button>
          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            <button onClick={() => setView('calendar')} className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold', view === 'calendar' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}>
              <CalendarDays size={14} /> Calendar
            </button>
            <button onClick={() => setView('list')} className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold', view === 'list' ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}>
              <ListIcon size={14} /> List
            </button>
          </div>
          <button onClick={() => refetch()} className="text-slate-400 hover:text-slate-700"><RefreshCw size={16} /></button>
        </div>
      </div>

      <div className="px-6 py-5">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400">Loading…</div>
        ) : view === 'list' ? (
          <div className="card card-flush overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Day</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Trip</th>
                  <th className="px-4 py-3">Vehicle / Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!schedules.length ? (
                  <tr><td colSpan={4} className="py-12 text-center text-slate-400">No operational services this week.</td></tr>
                ) : [...schedules].sort((a, b) => new Date(a.date) - new Date(b.date)).map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{format(new Date(s.date), 'EEE, d MMM')}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700">{s.serviceLocation || 'Service'}</div>
                      {s.serviceType && <div className="text-xs text-brand-600">{s.serviceType}</div>}
                    </td>
                    <td className="px-4 py-3"><Link to={`/bookings/${s.booking}`} className="text-brand-600 hover:underline">{s.guest?.name || 'Guest'}</Link></td>
                    <td className="px-4 py-3 text-slate-500">{s.items.map((it) => `${it.qty} ${it.type}`).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2 overflow-x-auto">
            {days.map((day) => {
              const items = schedules.filter((s) => isSameDay(new Date(s.date), day));
              return (
                <div key={day.toISOString()} className="min-w-[150px]">
                  <div className={cn('mb-2 rounded-lg px-2 py-1 text-center', isSameDay(day, today) ? 'bg-brand-600 text-white' : 'text-slate-500')}>
                    <div className="text-xs font-medium">{format(day, 'EEE')}</div>
                    <div className="text-lg font-bold">{format(day, 'd')}</div>
                    <div className="text-[10px] uppercase">{format(day, 'MMM, yyyy')}</div>
                  </div>
                  <div className="space-y-2">
                    {items.map((s, i) => (
                      <Link key={i} to={`/bookings/${s.booking}`} className="block rounded-lg border border-slate-200 bg-brand-50/40 p-2 text-xs hover:border-brand-300">
                        <div className="font-semibold text-slate-700">{s.serviceLocation || 'Service'}</div>
                        <div className="truncate text-slate-500">{s.guest?.name || 'Guest'}</div>
                        {s.items.map((it, j) => <div key={j} className="text-slate-400">{it.qty} {it.type}</div>)}
                        {s.serviceType && <div className="mt-1 text-[10px] text-brand-600">{s.serviceType}</div>}
                      </Link>
                    ))}
                    {!items.length && <div className="rounded-lg border border-dashed border-slate-100 py-3 text-center text-[10px] text-slate-300">—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
