import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, SlidersHorizontal, Plus, RefreshCw, Info, Phone, X } from 'lucide-react';
import { format } from 'date-fns';
import { queriesApi } from '../../api/queries.js';
import { destinationsApi, querySourcesApi, tagsApi, teamsApi, usersApi } from '../../api/masterData.js';
import { useAuth } from '../../store/AuthContext.jsx';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import { cn } from '../../lib/cn.js';
import { tripNo } from '../../lib/format.js';

const EMPTY_FILTERS = { destinations: [], sources: [], tags: [], salesTeam: null, owners: [], createdAfter: '', createdBefore: '', startAfter: '', startBefore: '' };

function countActive(f) {
  if (!f) return 0;
  return (f.destinations?.length ? 1 : 0) + (f.sources?.length ? 1 : 0) + (f.tags?.length ? 1 : 0) +
    (f.salesTeam ? 1 : 0) + (f.owners?.length ? 1 : 0) +
    (f.createdAfter || f.createdBefore ? 1 : 0) + (f.startAfter || f.startBefore ? 1 : 0);
}

const TABS = [
  { value: 'new_query', label: 'New Query' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'converted', label: 'Converted' },
  { value: 'on_trip', label: 'On Trip' },
  { value: 'past', label: 'Past Trips' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'dropped', label: 'Dropped' },
  { value: 'all', label: 'All' },
];

const STATUS_BADGE = {
  new_query: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  converted: 'bg-green-50 text-green-700',
  on_trip: 'bg-purple-50 text-purple-700',
  past: 'bg-gray-100 text-gray-600',
  canceled: 'bg-red-50 text-red-700',
  dropped: 'bg-red-50 text-red-700',
};

export default function TripsListPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || 'new_query';
  const urlQ = params.get('q') || '';
  const [search, setSearch] = useState(urlQ);
  const [debounced, setDebounced] = useState(urlQ);
  const [showFilters, setShowFilters] = useState(false);
  const [applied, setApplied] = useState(null);
  const qc = useQueryClient();

  // Translate applied advanced filters into list query params.
  const filterParams = () => {
    const p = {};
    const f = applied;
    if (!f) return p;
    if (f.destinations?.length) p.destination = f.destinations.map((d) => d._id).join(',');
    if (f.sources?.length) p.source = f.sources.map((s) => s._id).join(',');
    if (f.tags?.length) p.tags = f.tags.map((t) => t._id).join(',');
    if (f.salesTeam) p.salesTeam = f.salesTeam._id;
    if (f.owners?.length) p.owner = f.owners.map((o) => o._id).join(',');
    if (f.createdAfter) p.createdAfter = f.createdAfter;
    if (f.createdBefore) p.createdBefore = f.createdBefore;
    if (f.startAfter) p.startAfter = f.startAfter;
    if (f.startBefore) p.startBefore = f.startBefore;
    return p;
  };
  const activeCount = countActive(applied);

  // Sync when the global navbar search drives a new ?q=
  useEffect(() => {
    setSearch(urlQ);
    setDebounced(urlQ);
  }, [urlQ]);

  // Debounce the search box.
  const onSearch = (v) => {
    setSearch(v);
    clearTimeout(window.__tripSearch);
    window.__tripSearch = setTimeout(() => setDebounced(v), 350);
  };

  const statsQ = useQuery({ queryKey: ['query-stats'], queryFn: queriesApi.stats });
  const listQ = useQuery({
    queryKey: ['queries', status, debounced, applied],
    queryFn: () => queriesApi.list({ status, search: debounced, limit: 50, ...filterParams() }),
  });

  const counts = Object.fromEntries((statsQ.data?.counts || []).map((c) => [c.value, c.count]));
  const items = listQ.data?.data || [];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['queries'] });
    qc.invalidateQueries({ queryKey: ['query-stats'] });
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {/* Sidebar tabs */}
      <aside className="w-48 shrink-0 border-r border-gray-200 bg-white py-4">
        <h2 className="px-4 pb-3 text-lg font-bold text-gray-900">Trips</h2>
        <nav>
          {TABS.map((tab) => {
            const active = status === tab.value;
            const count = tab.value === 'all' ? statsQ.data?.all : counts[tab.value];
            return (
              <button
                key={tab.value}
                onClick={() => setParams({ status: tab.value })}
                className={cn(
                  'flex w-full items-center justify-between px-4 py-2.5 text-sm',
                  active
                    ? 'border-l-2 border-brand-600 bg-brand-50 font-semibold text-brand-700'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <span>{tab.label}</span>
                {count != null && count > 0 && (
                  <span className={cn('rounded-full px-2 text-xs', active ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500')}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <section className="flex-1 bg-gray-50">
        <div className="flex items-center justify-end gap-3 border-b border-gray-200 bg-white px-6 py-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search by id, guest, phone numbers..."
              className="w-full text-sm outline-none"
            />
            <button onClick={() => setShowFilters(true)} className="relative text-gray-400 hover:text-brand-600" title="Advanced Filters">
              <SlidersHorizontal size={16} />
              {activeCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-600 text-[9px] font-bold text-white">{activeCount}</span>
              )}
            </button>
          </div>
          {can('trips.create') && <Link to="/trips/upload" className="btn-secondary whitespace-nowrap">Upload CSV</Link>}
          {can('trips.create') && (
            <Link to="/trips/new" className="btn-primary whitespace-nowrap">
              <Plus size={16} /> Add New Query
            </Link>
          )}
        </div>

        <div className="p-6">
          {listQ.isLoading ? (
            <div className="py-20 text-center text-gray-400">Loading…</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Info className="mb-3 text-gray-300" size={40} />
              <p className="text-lg text-gray-600">No results matched your search.</p>
              <button onClick={refresh} className="btn-secondary mt-4">
                <RefreshCw size={15} /> Refresh Results
              </button>
            </div>
          ) : (
            <div className="card card-flush overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left text-xs font-semibold tracking-normal text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Id</th>
                    <th className="px-4 py-3">Guest</th>
                    <th className="px-4 py-3">Basic Details</th>
                    <th className="px-4 py-3">Sales Person</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((q) => (
                    <tr key={q._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link to={`/trips/${q._id}`} className="font-semibold text-brand-600 hover:underline">
                          {tripNo(q.queryNumber)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {[q.guest?.salutation, q.guest?.name].filter(Boolean).join(' ') || '—'}
                        </div>
                        {q.guest?.phones?.[0] && (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Phone size={11} /> +{q.guest.phones[0].countryCode} {q.guest.phones[0].number}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {(q.destinations || []).map((d) => d.name).join(', ') || '—'}
                        <span className="text-gray-400">
                          {' '}• {q.nights}N{q.startDate ? ` • ${format(new Date(q.startDate), 'd MMM')}` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{q.owner?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn('rounded px-2 py-0.5 text-xs font-medium', STATUS_BADGE[q.status])}>
                          {TABS.find((t) => t.value === q.status)?.label || q.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {format(new Date(q.createdAt), 'd MMM yyyy')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <FiltersPanel
        open={showFilters}
        initial={applied}
        onClose={() => setShowFilters(false)}
        onApply={(f) => { setApplied(countActive(f) ? f : null); setShowFilters(false); }}
        onReset={() => { setApplied(null); setShowFilters(false); }}
      />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  );
}

function DateRange({ label, a, b, onA, onB }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="date" className="input" value={a} onChange={(e) => onA(e.target.value)} />
        <span className="text-slate-400">→</span>
        <input type="date" className="input" value={b} onChange={(e) => onB(e.target.value)} />
      </div>
    </Field>
  );
}

// Right-side Advanced Filters drawer for the trips list.
function FiltersPanel({ open, initial, onClose, onApply, onReset }) {
  const [f, setF] = useState(initial || EMPTY_FILTERS);
  useEffect(() => { setF(initial || EMPTY_FILTERS); }, [initial, open]);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-[340px] flex-col bg-white shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="font-semibold text-slate-900">Advanced Filters</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <Field label="Destinations">
            <AsyncSelect isMulti loadOptions={destinationsApi.search} value={f.destinations} onChange={set('destinations')} placeholder="Select destination(s)…" />
          </Field>
          <Field label="Trip Sources">
            <AsyncSelect isMulti loadOptions={querySourcesApi.search} value={f.sources} onChange={set('sources')} placeholder="Select source(s)…" />
          </Field>
          <Field label="Tags">
            <AsyncSelect isMulti loadOptions={tagsApi.search} value={f.tags} onChange={set('tags')} placeholder="Search & select tag(s)…" />
          </Field>
          <Field label="Sales Team">
            <AsyncSelect loadOptions={teamsApi.search} value={f.salesTeam} onChange={set('salesTeam')} placeholder="Type to search…" />
          </Field>
          <Field label="Resv/Ops Owners">
            <AsyncSelect isMulti loadOptions={usersApi.search} value={f.owners} onChange={set('owners')} placeholder="Search & select member(s)…" />
          </Field>
          <DateRange label="Created Between" a={f.createdAfter} b={f.createdBefore} onA={set('createdAfter')} onB={set('createdBefore')} />
          <DateRange label="Start-Date Between" a={f.startAfter} b={f.startBefore} onA={set('startAfter')} onB={set('startBefore')} />
        </div>

        <div className="flex items-center gap-3 border-t border-slate-200 px-4 py-3">
          <button onClick={() => onApply(f)} className="btn-primary flex-1">Apply Filters</button>
          <button onClick={onReset} className="text-sm font-medium text-slate-600 hover:text-slate-900">Reset Filters</button>
        </div>
      </aside>
    </>
  );
}
