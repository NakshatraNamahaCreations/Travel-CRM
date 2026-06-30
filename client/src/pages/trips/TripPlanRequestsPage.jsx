import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, MapPin, Calendar, Users, ArrowRight, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { queriesApi } from '../../api/queries.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { cn } from '../../lib/cn.js';

const ONLINE_SOURCES = ['Website', 'Google Ads', 'Instagram'];

const STATUS_MAP = {
  new_query:   { label: 'New',         cls: 'bg-blue-50 text-blue-700' },
  in_progress: { label: 'In Progress', cls: 'bg-amber-50 text-amber-700' },
  converted:   { label: 'Converted',   cls: 'bg-green-50 text-green-700' },
  dropped:     { label: 'Dropped',     cls: 'bg-red-50 text-red-600' },
};

const TABS = [
  { key: 'all',         label: 'All Requests' },
  { key: 'new_query',   label: 'New' },
  { key: 'in_progress', label: 'In Progress' },
];

const fmtD = (d) => (d ? format(new Date(d), 'd MMM yyyy') : '—');

function paxLabel(pax) {
  if (!pax) return '';
  const a = pax.adults || 0;
  const c = (pax.children || []).length;
  return `${a} Adult${a !== 1 ? 's' : ''}${c ? `, ${c} Child${c !== 1 ? 'ren' : ''}` : ''}`;
}

function RequestCard({ q }) {
  const source = typeof q.source === 'string' ? q.source : q.source?.name;
  const destinations = (q.destinations || []).map((d) => d?.name).filter(Boolean).join(', ');
  const status = STATUS_MAP[q.status] || { label: q.status, cls: 'bg-slate-100 text-slate-600' };

  return (
    <div className="card flex items-start gap-4 p-4 hover:border-brand-200 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-900">{q.guest?.name || 'Unknown Guest'}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', status.cls)}>{status.label}</span>
          {source && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{source}</span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
          {destinations && (
            <span className="flex items-center gap-1">
              <MapPin size={13} className="text-slate-400" /> {destinations}
            </span>
          )}
          {q.startDate && (
            <span className="flex items-center gap-1">
              <Calendar size={13} className="text-slate-400" /> {fmtD(q.startDate)}
              {q.nights ? ` · ${q.nights + 1}D/${q.nights}N` : ''}
            </span>
          )}
          {q.pax && (
            <span className="flex items-center gap-1">
              <Users size={13} className="text-slate-400" /> {paxLabel(q.pax)}
            </span>
          )}
        </div>

        {q.comments && (
          <p className="mt-1.5 text-xs text-slate-400 italic line-clamp-2">{q.comments}</p>
        )}

        <div className="mt-1.5 text-xs text-slate-400">
          #{q.queryNumber}
          {q.owner?.name ? ` · Assigned to ${q.owner.name}` : ' · Unassigned'}
          {q.createdAt ? ` · ${fmtD(q.createdAt)}` : ''}
        </div>
      </div>

      <Link
        to={`/trips/${q._id}`}
        className="shrink-0 flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition-colors"
      >
        View <ArrowRight size={13} />
      </Link>
    </div>
  );
}

export default function TripPlanRequestsPage() {
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);

  const params = { limit: 100 };
  if (tab !== 'all') params.status = tab;
  if (debounced) params.search = debounced;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['trip-plan-requests', tab, debounced],
    queryFn: () => queriesApi.list(params),
  });

  const all = data?.data || [];
  const items = all.filter((q) => {
    const srcName = typeof q.source === 'string' ? q.source : q.source?.name;
    return ONLINE_SOURCES.includes(srcName);
  });

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Trip Plan Requests</h1>
          <p className="text-sm text-slate-500">Incoming requests from Website, Google Ads &amp; Instagram</p>
        </div>
        <div className="flex w-72 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Search size={15} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guest or phone…"
            className="w-full text-sm outline-none"
          />
        </div>
      </div>

      <div className="mb-4 flex items-center gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t.key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            {t.label}
          </button>
        ))}
        <button onClick={() => refetch()} className="ml-auto text-slate-400 hover:text-slate-600 pb-2">
          <RefreshCw size={14} />
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-slate-400">Loading…</div>
      ) : !items.length ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <p className="text-slate-400">No trip plan requests found.</p>
          <p className="mt-1 text-xs text-slate-300">Requests from Website, Google Ads, and Instagram will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">{items.length} request{items.length !== 1 ? 's' : ''}</p>
          {items.map((q) => (
            <RequestCard key={q._id} q={q} />
          ))}
        </div>
      )}
    </div>
  );
}
