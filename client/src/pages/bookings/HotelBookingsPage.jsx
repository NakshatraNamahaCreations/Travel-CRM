import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, RefreshCw, Hotel, User } from 'lucide-react';
import { format } from 'date-fns';
import { bookingsApi } from '../../api/bookings.js';
import { money } from '../../lib/pricing.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { cn } from '../../lib/cn.js';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'on_trip', label: 'On Trip' },
  { key: 'past', label: 'Past' },
  { key: 'dropped', label: 'Dropped' },
];

const paxLabel = (pax) => {
  if (!pax) return '';
  const a = pax.adults || 0;
  const c = (pax.children || []).length;
  return `${a}A${c ? `, ${c}C` : ''}`;
};

export default function HotelBookingsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['hotel-bookings', tab, debounced],
    queryFn: () => bookingsApi.hotels({ tab, search: debounced, limit: 50 }),
  });
  const items = data?.data || [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['hotel-bookings'] });
  const dt = (d) => (d ? format(new Date(d), 'd MMM') : '—');

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Hotel Bookings</h1>
        <div className="flex w-72 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Search size={15} className="text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by id, guest…" className="w-full text-sm outline-none" />
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

          {isLoading ? (
            <div className="py-16 text-center text-slate-400">Loading…</div>
          ) : !items.length ? (
            <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-400">No bookings yet.</div>
          ) : (
            <div className="space-y-3">
              {items.map((b) => (
                <div key={b._id} className="card overflow-hidden p-0">
                  <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
                    {/* Basic details */}
                    <div className="border-b border-slate-100 p-4 lg:border-b-0 lg:border-r">
                      <Link to={`/bookings/${b._id}`} className="font-semibold text-brand-700 hover:underline">{b.guest?.name || b.title || 'Guest'}</Link>
                      <div className="mt-1 text-xs text-slate-500">
                        #{b.bookingNumber} · {b.totalAmount ? money(b.totalAmount, b.currency) : '—'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {dt(b.startDate)} · {b.nights ? `${b.nights + 1}D` : ''} · {paxLabel(b.pax)}
                      </div>
                      {b.owner?.name && <div className="mt-2 flex items-center gap-1 text-xs text-slate-500"><User size={12} /> {b.owner.name}</div>}
                    </div>

                    {/* Hotels */}
                    <div className="p-4">
                      <div className="mb-2 text-sm font-semibold text-slate-700">
                        {b.bookedCount}/{b.hotels.length} Booked · {b.voucherCount}/{b.hotels.length} Voucher Sent
                      </div>
                      {!b.hotels.length ? (
                        <p className="text-sm text-slate-400">No hotels in this booking.</p>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {b.hotels.map((h, i) => (
                            <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                              <div className="flex items-center gap-2">
                                <Hotel size={14} className="text-brand-400" />
                                <span className="font-medium text-slate-800">{h.hotelName}</span>
                                {h.city && <span className="text-xs text-slate-400">{h.city}</span>}
                                {h.roomType && <span className="text-xs text-slate-400">· {h.roomType}</span>}
                              </div>
                              <div className="text-xs text-slate-500">{dt(h.checkIn)} · {h.nights}N</div>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{h.reservationStatus}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
