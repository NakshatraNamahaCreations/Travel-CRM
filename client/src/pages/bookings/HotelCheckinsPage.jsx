import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RefreshCw, Hotel } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { bookingsApi } from '../../api/bookings.js';
import { cn } from '../../lib/cn.js';

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'all', label: 'All' },
];

export default function HotelCheckinsPage() {
  const [tab, setTab] = useState('upcoming');
  const [weekDate, setWeekDate] = useState(new Date());
  const after = startOfWeek(weekDate, { weekStartsOn: 0 });
  const before = endOfWeek(weekDate, { weekStartsOn: 0 });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['hotel-checkins', tab, after.toISOString()],
    queryFn: () => bookingsApi.hotelCheckins({ tab, after: after.toISOString(), before: before.toISOString() }),
  });
  const stays = data?.data || [];
  const dt = (d) => (d ? format(new Date(d), 'd MMM') : '—');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-bold text-slate-900">Hotel Check-Ins <span className="ml-1 text-sm font-normal text-slate-400">({format(after, 'EEE d MMM')} – {format(before, 'EEE d MMM')})</span></h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekDate(new Date())} className="btn-secondary text-sm">Today</button>
          <button onClick={() => setWeekDate((d) => addWeeks(d, -1))} className="btn-secondary px-2"><ChevronLeft size={16} /></button>
          <button onClick={() => setWeekDate((d) => addWeeks(d, 1))} className="btn-secondary px-2"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-slate-200 bg-white px-6">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn('border-b-2 py-3 text-sm font-medium', tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-6 py-5">
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
          Showing {stays.length} Items
          <button onClick={() => refetch()} className="text-slate-400 hover:text-slate-700"><RefreshCw size={14} /></button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400">Loading…</div>
        ) : !stays.length ? (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400">No check-ins this week.</div>
        ) : (
          <div className="card card-flush overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Check In - Out</th>
                  <th className="px-4 py-3">Hotel</th>
                  <th className="px-4 py-3">Trip Info</th>
                  <th className="px-4 py-3">Room / Services</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stays.map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{dt(s.checkIn)} – {dt(s.checkOut)} <span className="text-xs font-normal text-slate-400">({s.nights}N)</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2"><Hotel size={14} className="text-brand-400" /><span className="font-medium text-brand-700">{s.hotelName}</span></div>
                      {s.city && <div className="text-xs text-slate-400">{s.city}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/bookings/${s.booking}`} className="text-brand-600 hover:underline">{s.guest?.name || 'Guest'}</Link>
                      <div className="text-xs text-slate-400">#{s.bookingNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{s.rooms} {s.roomType || 'Room'}{s.mealPlan ? <div className="text-xs text-slate-400">{s.mealPlan}</div> : null}</td>
                    <td className="px-4 py-3"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{s.reservationStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
