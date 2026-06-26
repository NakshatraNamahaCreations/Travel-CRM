import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, SlidersHorizontal, RefreshCw, Info, MoreVertical, Check, X, Phone } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { tasksApi } from '../api/tasks.js';
import { usersApi, destinationsApi } from '../api/masterData.js';
import AsyncSelect from '../components/form/AsyncSelect.jsx';
import { cn } from '../lib/cn.js';
import { tripNo } from '../lib/format.js';

const TABS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'all', label: 'All' },
];

const STATUS_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'done', label: 'Done' },
];

const EMPTY = { assignedTo: [], destinations: [], createdBy: [], status: [] };
const countActive = (f) => !f ? 0 : (f.assignedTo?.length ? 1 : 0) + (f.destinations?.length ? 1 : 0) + (f.createdBy?.length ? 1 : 0) + (f.status?.length ? 1 : 0);

export default function TasksPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('today');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [applied, setApplied] = useState(null);

  const onSearch = (v) => {
    setSearch(v);
    clearTimeout(window.__taskSearch);
    window.__taskSearch = setTimeout(() => setDebounced(v), 350);
  };

  const filterParams = () => {
    const p = {};
    const f = applied;
    if (!f) return p;
    if (f.assignedTo?.length) p.assignedTo = f.assignedTo.map((u) => u._id).join(',');
    if (f.createdBy?.length) p.createdBy = f.createdBy.map((u) => u._id).join(',');
    if (f.destinations?.length) p.destination = f.destinations.map((d) => d._id).join(',');
    if (f.status?.length) p.status = f.status.join(',');
    return p;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', tab, debounced, applied],
    queryFn: () => tasksApi.list({ tab, search: debounced, limit: 30, ...filterParams() }),
  });
  const items = data?.data || [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['tasks'] });

  const resolveMut = useMutation({
    mutationFn: (id) => tasksApi.resolve(id),
    onSuccess: () => { toast.success('Marked as resolved'); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const dt = (d) => (d ? format(new Date(d), 'd MMM yyyy') : '—');
  const paxLabel = (g) => {
    if (!g) return '';
    const a = g.adults || 0;
    return a ? `${a}A` : '';
  };

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <aside className="w-44 shrink-0 border-r border-gray-200 bg-white py-4">
        <h2 className="px-4 pb-3 text-base font-bold text-gray-900">All Tasks</h2>
        <nav>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={cn('block w-full px-4 py-2.5 text-left text-sm', tab === t.key ? 'border-l-2 border-brand-600 bg-brand-50 font-semibold text-brand-700' : 'text-gray-600 hover:bg-gray-50')}>
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="flex-1 bg-gray-50">
        <div className="flex items-center justify-end gap-3 border-b border-gray-200 bg-white px-6 py-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search…" className="w-full text-sm outline-none" />
            <button onClick={() => setShowFilters(true)} className="relative text-gray-400 hover:text-brand-600" title="Advanced Filters">
              <SlidersHorizontal size={16} />
              {countActive(applied) > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-600 text-[9px] font-bold text-white">{countActive(applied)}</span>}
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
            Showing {data?.meta?.total ?? items.length} Items
            <button onClick={refresh} className="text-gray-400 hover:text-gray-700"><RefreshCw size={14} /></button>
          </div>

          {isLoading ? (
            <div className="py-20 text-center text-gray-400">Loading…</div>
          ) : !items.length ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Info className="mb-3 text-gray-300" size={40} />
              <p className="text-lg text-gray-600">No results matched your search.</p>
              <button onClick={refresh} className="btn-secondary mt-4"><RefreshCw size={15} /> Refresh Results</button>
            </div>
          ) : (
            <div className="card card-flush overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Due At</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Trip Source</th>
                    <th className="px-4 py-3">Guest</th>
                    <th className="px-4 py-3">For</th>
                    <th className="px-4 py-3">Created by</th>
                    <th className="px-4 py-3">Assigned To</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((t) => (
                    <tr key={t._id} className={cn('hover:bg-gray-50', t.isResolved && 'opacity-60')}>
                      <td className="px-4 py-3 text-gray-600">{dt(t.dueDate)}</td>
                      <td className="px-4 py-3 text-gray-800">{t.body}</td>
                      <td className="px-4 py-3 text-gray-600">{t.query?.source?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{t.query?.guest?.name || '—'}</div>
                        {t.query?.guest?.phones?.[0] && (
                          <div className="flex items-center gap-1 text-xs text-gray-400"><Phone size={11} /> {paxLabel(t.query?.pax)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t.query ? <Link to={`/trips/${t.query._id}`} className="font-medium text-brand-600 hover:underline">Trip#{tripNo(t.query.queryNumber)}</Link> : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{t.createdBy?.name || '—'}{t.createdAt ? <span className="text-xs text-gray-400"> on {format(new Date(t.createdAt), 'd MMM')}</span> : ''}</td>
                      <td className="px-4 py-3 text-gray-600">{t.assignedTo?.name || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {!t.isResolved
                          ? <RowMenu onResolve={() => resolveMut.mutate(t._id)} />
                          : <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><Check size={13} /> Done</span>}
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

function RowMenu({ onResolve }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="text-slate-400 hover:text-slate-700"><MoreVertical size={16} /></button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
          <button onClick={() => { setOpen(false); onResolve(); }} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"><Check size={14} className="text-green-600" /> Mark as Resolved</button>
        </div>
      )}
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

function FiltersPanel({ open, initial, onClose, onApply, onReset }) {
  const [f, setF] = useState(initial || EMPTY);
  useEffect(() => { setF(initial || EMPTY); }, [initial, open]);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const toggleStatus = (val) => setF((s) => ({ ...s, status: s.status.includes(val) ? s.status.filter((x) => x !== val) : [...s.status, val] }));
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
          <Field label="Assigned To">
            <AsyncSelect isMulti loadOptions={usersApi.search} value={f.assignedTo} onChange={set('assignedTo')} placeholder="Type to search…" />
          </Field>
          <Field label="Destinations">
            <AsyncSelect isMulti loadOptions={destinationsApi.search} value={f.destinations} onChange={set('destinations')} placeholder="Type to search…" />
          </Field>
          <Field label="Created By">
            <AsyncSelect isMulti loadOptions={usersApi.search} value={f.createdBy} onChange={set('createdBy')} placeholder="Type to search…" />
          </Field>
          <Field label="Task Status">
            <div className="space-y-1.5">
              {STATUS_OPTIONS.map((o) => (
                <label key={o.value} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={f.status.includes(o.value)} onChange={() => toggleStatus(o.value)} /> {o.label}
                </label>
              ))}
            </div>
          </Field>
        </div>
        <div className="flex items-center gap-3 border-t border-slate-200 px-4 py-3">
          <button onClick={() => onApply(f)} className="btn-primary flex-1">Apply Filters</button>
          <button onClick={onReset} className="text-sm font-medium text-slate-600 hover:text-slate-900">Reset Filters</button>
        </div>
      </aside>
    </>
  );
}
