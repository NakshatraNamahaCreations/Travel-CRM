import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, Phone,
  RefreshCw, Search, SlidersHorizontal, Trophy, X,
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, addMonths,
  startOfWeek, endOfWeek, addWeeks, startOfYear, endOfYear, addYears,
} from 'date-fns';
import { reportsApi } from '../../api/reports.js';
import { usersApi, teamsApi, querySourcesApi, destinationsApi } from '../../api/masterData.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import FilterDrawer, { countFilters } from '../../components/ui/FilterDrawer.jsx';
import { money } from '../../lib/pricing.js';
import { cn } from '../../lib/cn.js';
import { tripNo } from '../../lib/format.js';

const INTERVALS = {
  Week: { start: startOfWeek, end: endOfWeek, add: addWeeks, label: (d) => `Week of ${format(startOfWeek(d), 'd MMM yyyy')}` },
  Month: { start: startOfMonth, end: endOfMonth, add: addMonths, label: (d) => format(d, 'MMMM yyyy') },
  Year: { start: startOfYear, end: endOfYear, add: addYears, label: (d) => format(d, 'yyyy') },
};

// Report tabs. 'trips' lists the individual trips; every other key is a
// breakdown dimension understood by /reports/sales/breakdown.
const TABS = [
  { key: 'trips', label: 'Trips' },
  { key: 'owner', label: 'Sales Team' },
  { key: 'salesTeam', label: 'Teams' },
  { key: 'destinations', label: 'Destinations' },
  { key: 'source', label: 'Trip Sources' },
  { key: 'tags', label: 'Tags' },
];
// A trip can carry several of these, so it is counted once under each.
const MULTI_VALUED = new Set(['destinations', 'tags']);

const STATUS_OPTIONS = [
  { value: 'won', label: 'Won (converted / on trip / past)' },
  { value: 'new_query', label: 'New Query' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'converted', label: 'Converted' },
  { value: 'on_trip', label: 'On Trip' },
  { value: 'past', label: 'Past Trips' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'dropped', label: 'Dropped' },
];

const EMPTY_FILTERS = { owner: null, salesTeam: null, source: null, destination: null, status: '' };
const FILTER_FIELDS = [
  { key: 'owner', label: 'Sales Person', type: 'async', loadOptions: (s) => usersApi.search(s) },
  { key: 'salesTeam', label: 'Sales Team', type: 'async', loadOptions: (s) => teamsApi.search(s) },
  { key: 'source', label: 'Trip Source', type: 'async', loadOptions: (s) => querySourcesApi.search(s) },
  { key: 'destination', label: 'Destination', type: 'async', loadOptions: (s) => destinationsApi.search(s) },
  { key: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
];
const FILTER_LABELS = { owner: 'Sales Person', salesTeam: 'Sales Team', source: 'Trip Source', destination: 'Destination', status: 'Status' };

const STATUS_BADGE = {
  new_query: 'bg-blue-50 text-blue-700', in_progress: 'bg-amber-50 text-amber-700',
  converted: 'bg-green-50 text-green-700', on_trip: 'bg-purple-50 text-purple-700',
  past: 'bg-gray-100 text-gray-600', canceled: 'bg-red-50 text-red-700', dropped: 'bg-red-50 text-red-700',
};

// Numeric columns of the breakdown table (all sortable).
const COLS = [
  { key: 'leads', label: 'Leads' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'conversion', label: 'Conversions' },
  { key: 'dropped', label: 'Dropped' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'profit', label: 'Profit' },
  { key: 'profitPct', label: 'Profit %' },
  { key: 'avgDeal', label: 'Avg. Sale' },
];

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

function Stat({ label, value, sub }) {
  return (
    <div className="min-w-[96px]">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="stat text-xl">{value}{sub && <span className="ml-1 text-sm font-medium text-slate-400">{sub}</span>}</p>
    </div>
  );
}

function SortHeader({ k, sort, onSort, children, className }) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === 'desc' ? ArrowDown : ArrowUp;
  return (
    <th className={cn('px-4 py-3', className)}>
      <button type="button" onClick={() => onSort(k)} className={cn('inline-flex items-center gap-1 hover:text-slate-900', active && 'text-brand-700')}>
        {children}<Icon size={12} className={cn(!active && 'opacity-40')} />
      </button>
    </th>
  );
}

export default function SalesReportPage() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam : 'trips';
  const setTab = (key) => setParams((p) => {
    const next = new URLSearchParams(p);
    if (key === 'trips') next.delete('tab'); else next.set('tab', key);
    return next;
  });

  const [period, setPeriod] = useState('Month');
  const [cursor, setCursor] = useState(new Date());
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState({ key: 'revenue', dir: 'desc' });

  const cfg = INTERVALS[period];
  const after = cfg.start(cursor);
  const before = cfg.end(cursor);

  const apiParams = {
    after: format(after, 'yyyy-MM-dd'),
    before: format(before, 'yyyy-MM-dd'),
    search: debouncedSearch.trim() || undefined,
    owner: filters.owner?._id || undefined,
    salesTeam: filters.salesTeam?._id || undefined,
    source: filters.source?._id || undefined,
    destination: filters.destination?._id || undefined,
    status: filters.status || undefined,
  };

  const salesQ = useQuery({
    queryKey: ['sales-report', apiParams],
    queryFn: () => reportsApi.sales(apiParams),
  });
  const breakdownQ = useQuery({
    queryKey: ['sales-breakdown', tab, apiParams],
    queryFn: () => reportsApi.salesBreakdown({ ...apiParams, by: tab }),
    enabled: tab !== 'trips',
  });

  const s = salesQ.data?.summary || {};
  const items = salesQ.data?.items || [];
  const groupLabel = breakdownQ.data?.label || TABS.find((t) => t.key === tab)?.label || '';

  const rows = useMemo(() => {
    const list = [...(breakdownQ.data?.rows || [])];
    const { key, dir } = sort;
    list.sort((a, b) => {
      const c = key === 'name' ? a.name.localeCompare(b.name) : (a[key] || 0) - (b[key] || 0);
      return (dir === 'asc' ? c : -c) || b.revenue - a.revenue;
    });
    return list;
  }, [breakdownQ.data, sort]);

  // Highest revenue in the current tab (the "top performer" marker).
  const topId = useMemo(() => {
    const best = (breakdownQ.data?.rows || []).reduce((m, r) => (r.revenue > (m?.revenue || 0) ? r : m), null);
    return best ? String(best._id) : null;
  }, [breakdownQ.data]);

  const totals = useMemo(() => {
    const t = rows.reduce(
      (a, r) => ({ leads: a.leads + r.leads, quotes: a.quotes + r.quotes, conversion: a.conversion + r.conversion, dropped: a.dropped + r.dropped, revenue: a.revenue + r.revenue, profit: a.profit + r.profit }),
      { leads: 0, quotes: 0, conversion: 0, dropped: 0, revenue: 0, profit: 0 }
    );
    t.conversionPct = t.leads ? Math.round((t.conversion / t.leads) * 100) : 0;
    t.profitPct = t.revenue ? Math.round((t.profit / t.revenue) * 1000) / 10 : 0;
    t.avgDeal = t.conversion ? Math.round(t.revenue / t.conversion) : 0;
    return t;
  }, [rows]);

  const onSort = (k) => setSort((cur) => (cur.key === k
    ? { key: k, dir: cur.dir === 'desc' ? 'asc' : 'desc' }
    : { key: k, dir: k === 'name' ? 'asc' : 'desc' }));

  const activeChips = Object.entries(filters)
    .filter(([, v]) => (typeof v === 'string' ? v : !!v))
    .map(([k, v]) => ({ key: k, text: `${FILTER_LABELS[k]}: ${k === 'status' ? STATUS_OPTIONS.find((o) => o.value === v)?.label || v : v.name}` }));
  const clearFilter = (k) => setFilters((f) => ({ ...f, [k]: EMPTY_FILTERS[k] }));

  const isTrips = tab === 'trips';
  const summaryLoading = salesQ.isLoading;
  const loading = isTrips ? salesQ.isLoading : breakdownQ.isLoading;
  const fetching = salesQ.isFetching || breakdownQ.isFetching;
  const refetch = () => { salesQ.refetch(); if (!isTrips) breakdownQ.refetch(); };
  const count = isTrips ? items.length : rows.length;

  const download = () => {
    const stamp = format(after, 'yyyy-MM-dd');
    if (isTrips) {
      const header = ['Id', 'Guest', 'Phone', 'Destinations', 'Nights', 'Start', 'Sales Person', 'Team', 'Trip Source', 'Created', 'Amount', 'Profit', 'Profit %', 'Status'];
      const body = items.map((i) => [
        tripNo(i.queryNumber), guestName(i.guest),
        i.guest?.phones?.[0] ? `+${i.guest.phones[0].countryCode} ${i.guest.phones[0].number}` : '',
        (i.destinations || []).map((d) => d.name).join('; '),
        i.nights, i.startDate ? format(new Date(i.startDate), 'yyyy-MM-dd') : '',
        i.owner?.name || '', i.salesTeam?.name || '', i.source?.name || '',
        format(new Date(i.createdAt), 'yyyy-MM-dd'),
        i.amount, i.profit, i.profitPercent, i.status,
      ]);
      downloadCsv([header, ...body], `sales-report-trips-${stamp}.csv`);
    } else {
      const header = [groupLabel, 'Leads', 'Quotes', 'Conversions', 'Conversion %', 'Dropped', 'Revenue', 'Profit', 'Profit %', 'Avg. Sale'];
      const body = rows.map((r) => [r.name, r.leads, r.quotes, r.conversion, r.conversionPct, r.dropped, r.revenue, r.profit, r.profitPct, r.avgDeal]);
      downloadCsv([header, ...body], `sales-report-${tab}-${stamp}.csv`);
    }
  };

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-5">
      {/* Title + search */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Sales Report</h1>
        <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200 sm:w-80">
          <Search size={15} className="text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search guest, phone, trip id…"
            className="w-full text-sm outline-none"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-700" title="Clear"><X size={14} /></button>
          )}
          <button
            type="button"
            onClick={() => setShowFilters(true)}
            title="Advanced Filters"
            className="relative -mr-1 rounded-md p-1 text-gray-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
          >
            <SlidersHorizontal size={15} />
            {countFilters(filters) > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[9px] font-bold text-white">
                {countFilters(filters)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Period navigation */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setCursor(cfg.add(cursor, -1))} className="btn-secondary px-2" title="Previous"><ChevronLeft size={16} /></button>
        <select className="input w-32" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {Object.keys(INTERVALS).map((k) => <option key={k}>{k}</option>)}
        </select>
        <button onClick={() => setCursor(cfg.add(cursor, 1))} className="btn-secondary px-2" title="Next"><ChevronRight size={16} /></button>
        {format(cursor, 'yyyy-MM-dd') !== format(new Date(), 'yyyy-MM-dd') && (
          <button onClick={() => setCursor(new Date())} className="text-sm font-medium text-brand-600 hover:underline">Current {period.toLowerCase()}</button>
        )}
      </div>

      <h2 className="mb-3 text-2xl font-bold text-gray-900">{cfg.label(cursor)}</h2>

      {activeChips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {activeChips.map((c) => (
            <span key={c.key} className="pill-brand">
              {c.text}
              <button type="button" onClick={() => clearFilter(c.key)} title="Remove filter"><X size={12} /></button>
            </span>
          ))}
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-xs font-medium text-slate-500 hover:text-slate-800">Clear all</button>
        </div>
      )}

      {/* Summary */}
      <div className="card mb-5 border-l-4 border-l-brand-500">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <p className="text-sm text-slate-500">Revenue</p>
            <p className="stat text-3xl">
              <span className="mr-1.5 text-base font-semibold text-slate-400">INR</span>
              {summaryLoading ? '…' : Math.round(s.revenue || 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <Stat label="Profit" value={summaryLoading ? '…' : money(s.profit || 0)} />
            <Stat label="Leads" value={summaryLoading ? '…' : s.leads ?? 0} />
            <Stat label="Quotes" value={summaryLoading ? '…' : s.quotes ?? 0} />
            <Stat label="Conversion" value={summaryLoading ? '…' : s.conversion ?? 0} sub={!summaryLoading && s.leads ? `${s.conversionPct}%` : undefined} />
            <Stat label="Dropped" value={summaryLoading ? '…' : s.dropped ?? 0} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-3 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              '-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm text-gray-500">
          Showing {count} {count === 1 ? 'Item' : 'Items'}
          {isTrips && salesQ.data?.truncated && <span className="text-amber-600">(first {items.length} of {salesQ.data.total} — narrow the period or add a filter)</span>}
          <button onClick={refetch} className="text-gray-400 hover:text-gray-700" title="Refresh"><RefreshCw size={14} className={cn(fetching && 'animate-spin')} /></button>
        </span>
        <button onClick={download} disabled={!count} className="btn-primary text-sm"><Download size={15} /> Download Report</button>
      </div>

      <div className="card card-flush overflow-x-auto rt-wrap">
        {isTrips ? (
          <table className="rt w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold tracking-normal text-slate-600">
              <tr>
                <th className="px-4 py-3">Id</th><th className="px-4 py-3">Guest</th><th className="px-4 py-3">Basic Details</th>
                <th className="px-4 py-3">Sales Person</th><th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Profit</th><th className="px-4 py-3 text-right">Profit %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">No results for this period.</td></tr>
              ) : (
                items.map((i) => (
                  <tr key={i._id} className="hover:bg-gray-50">
                    <td data-th="Id" className="px-4 py-3"><Link to={`/trips/${i._id}`} className="font-semibold text-brand-600 hover:underline">{tripNo(i.queryNumber)}</Link></td>
                    <td data-card="title" className="px-4 py-3">
                      <div className="font-medium text-gray-900">{guestName(i.guest)}</div>
                      {i.guest?.phones?.[0] && <div className="flex items-center gap-1 text-xs text-gray-400"><Phone size={10} /> +{i.guest.phones[0].countryCode} {i.guest.phones[0].number}</div>}
                    </td>
                    <td data-th="Basic Details" className="px-4 py-3 text-gray-600">
                      {(i.destinations || []).map((d) => d.name).join(', ') || '—'}
                      <span className="text-gray-400"> • {i.nights}N{i.startDate ? ` • ${format(new Date(i.startDate), 'd MMM')}` : ''}</span>
                      <span className={cn('ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium', STATUS_BADGE[i.status])}>{i.status.replace('_', ' ')}</span>
                      {i.source?.name && <div className="text-xs text-gray-400">via {i.source.name}</div>}
                    </td>
                    <td data-th="Sales Person" className="px-4 py-3 text-gray-600">
                      {i.owner?.name || '—'}
                      {i.salesTeam?.name && <div className="text-xs text-gray-400">{i.salesTeam.name}</div>}
                    </td>
                    <td data-th="Date" className="px-4 py-3 text-gray-500">{format(new Date(i.createdAt), 'd MMM')}</td>
                    <td data-th="Amount" className="px-4 py-3 text-right font-medium">{money(i.amount, i.currency)}</td>
                    <td data-th="Profit" className="px-4 py-3 text-right text-gray-700">{money(i.profit, i.currency)}</td>
                    <td data-th="Profit %" className="px-4 py-3 text-right text-gray-700">{i.profitPercent}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="rt w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold tracking-normal text-slate-600">
              <tr>
                <th className="w-10 px-4 py-3">#</th>
                <SortHeader k="name" sort={sort} onSort={onSort}>{groupLabel}</SortHeader>
                {COLS.map((c) => (
                  <SortHeader key={c.key} k={c.key} sort={sort} onSort={onSort} className="text-right">{c.label}</SortHeader>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={COLS.length + 2} className="py-12 text-center text-gray-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={COLS.length + 2} className="py-12 text-center text-gray-400">No sales data for this period.</td></tr>
              ) : (
                rows.map((r, idx) => {
                  const isTop = topId && String(r._id) === topId;
                  return (
                    <tr key={r._id || 'none'} className={cn('hover:bg-gray-50', isTop && 'bg-amber-50/40')}>
                      <td className="rt-desktop px-4 py-3 text-gray-400">{idx + 1}</td>
                      <td data-card="title" className="px-4 py-3">
                        <div className="flex items-center gap-2 font-medium text-gray-900">
                          <span className="text-gray-400 md:hidden">{idx + 1}.</span>
                          {r.color && <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />}
                          {r.name}
                          {isTop && <span className="pill-warning" title="Highest revenue"><Trophy size={11} /> Top</span>}
                        </div>
                        {r.email && <div className="text-xs text-gray-400">{r.email}</div>}
                      </td>
                      <td data-th="Leads" className="px-4 py-3 text-right tabular-nums text-gray-700">{r.leads}</td>
                      <td data-th="Quotes" className="px-4 py-3 text-right tabular-nums text-gray-700">{r.quotes}</td>
                      <td data-th="Conversions" className="px-4 py-3 text-right tabular-nums text-gray-700">
                        <span className="font-medium text-gray-900">{r.conversion}</span>
                        <span className={cn('ml-1.5', r.conversionPct >= 50 ? 'pill-success' : r.conversionPct >= 20 ? 'pill-info' : 'pill-neutral')}>{r.conversionPct}%</span>
                      </td>
                      <td data-th="Dropped" className="px-4 py-3 text-right tabular-nums text-gray-700">{r.dropped}</td>
                      <td data-th="Revenue" className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">{money(r.revenue)}</td>
                      <td data-th="Profit" className="px-4 py-3 text-right tabular-nums text-gray-700">{money(r.profit)}</td>
                      <td data-th="Profit %" className="px-4 py-3 text-right tabular-nums text-gray-700">{r.profitPct}%</td>
                      <td data-th="Avg. Sale" className="px-4 py-3 text-right tabular-nums text-gray-500">{money(r.avgDeal)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {rows.length > 1 && !MULTI_VALUED.has(tab) && (
              <tfoot className="border-t border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                <tr>
                  <th className="rt-desktop px-4 py-3" />
                  <th className="px-4 py-3 text-left text-sm">Total</th>
                  <th data-th="Leads" className="px-4 py-3 text-right tabular-nums">{totals.leads}</th>
                  <th data-th="Quotes" className="px-4 py-3 text-right tabular-nums">{totals.quotes}</th>
                  <th data-th="Conversions" className="px-4 py-3 text-right tabular-nums">{totals.conversion} ({totals.conversionPct}%)</th>
                  <th data-th="Dropped" className="px-4 py-3 text-right tabular-nums">{totals.dropped}</th>
                  <th data-th="Revenue" className="px-4 py-3 text-right tabular-nums">{money(totals.revenue)}</th>
                  <th data-th="Profit" className="px-4 py-3 text-right tabular-nums">{money(totals.profit)}</th>
                  <th data-th="Profit %" className="px-4 py-3 text-right tabular-nums">{totals.profitPct}%</th>
                  <th data-th="Avg. Sale" className="px-4 py-3 text-right tabular-nums">{money(totals.avgDeal)}</th>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {!isTrips && MULTI_VALUED.has(tab) && rows.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">A trip with more than one {groupLabel.toLowerCase()} is counted under each of them, so these rows can add up to more than the summary.</p>
      )}

      <FilterDrawer open={showFilters} onClose={() => setShowFilters(false)} fields={FILTER_FIELDS} initial={filters} empty={EMPTY_FILTERS} onApply={setFilters} />
    </div>
  );
}
