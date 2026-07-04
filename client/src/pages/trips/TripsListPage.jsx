import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, SlidersHorizontal, Plus, RefreshCw, Info, Phone, X, MoreVertical, Tag as TagIcon, Ban, MessageSquarePlus } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { queriesApi } from '../../api/queries.js';
import { commentsApi } from '../../api/comments.js';
import { destinationsApi, querySourcesApi, tagsApi, teamsApi, usersApi } from '../../api/masterData.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { useDebounced } from '../../hooks/useDebounced.js';
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
  const [menuFor, setMenuFor] = useState(null);   // query id whose kebab menu is open
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0, up: false }); // anchor for the fixed-position menu
  const [tagsFor, setTagsFor] = useState(null);   // query object being tag-edited
  const [followFor, setFollowFor] = useState(null); // query object getting a follow-up
  const navigate = useNavigate();
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

  const cancelMut = useMutation({
    mutationFn: (id) => queriesApi.setStatus(id, 'canceled'),
    onSuccess: () => { toast.success('Query canceled'); refresh(); },
    onError: (e) => toast.error(e.message || 'Could not cancel'),
  });
  const cancelQuery = (q) => {
    setMenuFor(null);
    if (window.confirm(`Cancel query ${tripNo(q.queryNumber)}?`)) cancelMut.mutate(q._id);
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
                    <th className="px-4 py-3">Tags</th>
                    <th className="px-4 py-3">Follow-up</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="w-10 px-2 py-3"></th>
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
                        <span className={cn('whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium', STATUS_BADGE[q.status])}>
                          {TABS.find((t) => t.value === q.status)?.label || q.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-[180px] flex-wrap gap-1">
                          {(q.tags || []).map((t) => (
                            <span key={t._id} className="whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {t.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {q.lastComment ? (
                          <>
                            <p className="max-w-[190px] truncate text-[12.5px] text-gray-700">{q.lastComment.body}</p>
                            <p className="text-[11px] text-gray-400">{formatDistanceToNow(new Date(q.lastComment.createdAt), { addSuffix: true })}</p>
                          </>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {format(new Date(q.createdAt), 'd MMM yyyy')}
                      </td>
                      <td className="relative px-2 py-3 text-right">
                        {can('trips.edit') && (
                          <>
                            <button
                              onClick={(e) => {
                                const r = e.currentTarget.getBoundingClientRect();
                                setMenuPos({ x: r.right, y: r.bottom, up: r.bottom + 150 > window.innerHeight });
                                setMenuFor(menuFor === q._id ? null : q._id);
                              }}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                              <MoreVertical size={16} />
                            </button>
                            {menuFor === q._id && (
                              <div
                                className="fixed z-20 w-44 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 text-left shadow-2xl"
                                style={{
                                  left: Math.max(8, menuPos.x - 176),
                                  ...(menuPos.up ? { bottom: window.innerHeight - menuPos.y + 32 } : { top: menuPos.y + 4 }),
                                }}
                              >
                                {q.status === 'in_progress' ? (
                                  <button
                                    onClick={() => { setMenuFor(null); setFollowFor(q); }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-[12.5px] text-slate-700 hover:bg-slate-50"
                                  >
                                    <MessageSquarePlus size={13} className="text-slate-400" /> Add Follow-up
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => { setMenuFor(null); navigate(`/trips/${q._id}/quote/new`); }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-[12.5px] text-slate-700 hover:bg-slate-50"
                                  >
                                    <Plus size={13} className="text-slate-400" /> Create Quote
                                  </button>
                                )}
                                <button
                                  onClick={() => { setMenuFor(null); setTagsFor(q); }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-[12.5px] text-slate-700 hover:bg-slate-50"
                                >
                                  <TagIcon size={13} className="text-slate-400" /> Update Tags
                                </button>
                                <button
                                  onClick={() => cancelQuery(q)}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-[12.5px] text-amber-600 hover:bg-amber-50"
                                >
                                  <Ban size={13} /> Cancel Query
                                </button>
                              </div>
                            )}
                          </>
                        )}
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

      {/* Click-away for the row kebab menus */}
      {menuFor && <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} aria-hidden="true" />}

      {tagsFor && (
        <EditTagsModal
          query={tagsFor}
          onClose={() => setTagsFor(null)}
          onSaved={() => { setTagsFor(null); refresh(); }}
        />
      )}

      {followFor && (
        <AddFollowUpModal
          query={followFor}
          onClose={() => setFollowFor(null)}
          onSaved={() => { setFollowFor(null); refresh(); }}
        />
      )}
    </div>
  );
}

// "Add Task/Comment" modal — logs a follow-up comment on the query, optionally
// actionable with a due date and an assignee.
function AddFollowUpModal({ query, onClose, onSaved }) {
  const [body, setBody] = useState('');
  const [actionable, setActionable] = useState(true);
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState(null);

  const saveMut = useMutation({
    mutationFn: () => commentsApi.create({
      query: query._id,
      body: body.trim(),
      isActionable: actionable,
      dueDate: dueDate || undefined,
      assignedTo: assignee?._id,
    }),
    onSuccess: () => { toast.success('Follow-up added'); onSaved(); },
    onError: (e) => toast.error(e.message || 'Could not save'),
  });
  const submit = () => {
    if (!body.trim()) return toast.error('Enter a comment');
    saveMut.mutate();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed left-1/2 top-16 z-50 w-[560px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl bg-white p-5 shadow-2xl animate-scale-in">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Add Task/Comment</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Comment</label>
            <textarea rows={4} className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body of the comment here…" autoFocus />
          </div>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <input type="checkbox" checked={actionable} onChange={(e) => setActionable(e.target.checked)} className="mt-0.5 accent-brand-600" />
            <span>
              <span className="block text-sm font-medium text-slate-800">Mark it as actionable comment</span>
              <span className="text-xs text-slate-400">This will make it show up in the demanding comments section</span>
            </span>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Due Date <span className="font-normal text-slate-400">(optional)</span></label>
              <input type="datetime-local" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <p className="mt-1 text-xs text-slate-400">If it needs to be resolved at a specific time</p>
            </div>
            <div>
              <label className="label">Assign To Someone <span className="font-normal text-slate-400">(optional)</span></label>
              <AsyncSelect loadOptions={usersApi.search} value={assignee} onChange={setAssignee} placeholder="Type to search…" />
              <p className="mt-1 text-xs text-slate-400">Please leave empty if you want to work on it yourself.</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
          <button onClick={submit} disabled={saveMut.isPending} className="btn-primary">
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose} className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
        </div>
      </div>
    </>
  );
}

// "Edit Tags" modal — select existing tags (fetched dynamically) or create new
// ones on the fly; saves the tag ids onto the query.
function EditTagsModal({ query, onClose, onSaved }) {
  const [selected, setSelected] = useState(query.tags || []); // [{_id, name}]
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term, 300);

  const searchQ = useQuery({
    queryKey: ['tags-search', debounced],
    queryFn: () => tagsApi.search(debounced, 20),
  });
  const options = searchQ.data || [];

  const isSelected = (t) => selected.some((s) => s._id === t._id);
  const toggle = (t) => setSelected((s) => (isSelected(t) ? s.filter((x) => x._id !== t._id) : [...s, t]));

  // Merge current selection into the visible list so checked tags never disappear.
  const list = [...selected.filter((s) => !options.some((o) => o._id === s._id)), ...options];
  const exactMatch = options.some((o) => o.name.toLowerCase() === term.trim().toLowerCase());

  const createMut = useMutation({
    mutationFn: () => tagsApi.create({ name: term.trim() }),
    onSuccess: (tag) => { setSelected((s) => (s.some((x) => x._id === tag._id) ? s : [...s, tag])); setTerm(''); },
    onError: (e) => toast.error(e.message || 'Could not create tag'),
  });

  const saveMut = useMutation({
    mutationFn: () => queriesApi.update(query._id, { tags: selected.map((t) => t._id) }),
    onSuccess: () => { toast.success('Tags updated'); onSaved(); },
    onError: (e) => toast.error(e.message || 'Could not save tags'),
  });

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed left-1/2 top-24 z-50 w-[440px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl bg-white p-5 shadow-2xl animate-scale-in">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">Edit Tags</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Select existing or create new tags</label>
        <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2">
          <Search size={14} className="text-slate-400" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Type to search…"
            autoFocus
            className="w-full text-sm outline-none"
          />
        </div>

        <div className="mt-3 flex max-h-52 flex-wrap content-start gap-2 overflow-y-auto">
          {list.map((t) => (
            <label
              key={t._id}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-medium transition-colors',
                isSelected(t) ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              <input type="checkbox" checked={isSelected(t)} onChange={() => toggle(t)} className="accent-brand-600" />
              {t.name}
            </label>
          ))}
          {term.trim() && !exactMatch && (
            <button
              onClick={() => createMut.mutate()}
              disabled={createMut.isPending}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-brand-300 px-2.5 py-1.5 text-[12.5px] font-medium text-brand-700 hover:bg-brand-50"
            >
              <Plus size={13} /> Create &quot;{term.trim()}&quot;
            </button>
          )}
          {!list.length && !term.trim() && (
            <p className="py-2 text-sm text-slate-400">{searchQ.isLoading ? 'Loading…' : 'No tags yet — type a name to create one.'}</p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="btn-primary">
            {saveMut.isPending ? 'Saving…' : 'Save'}
          </button>
          <button onClick={onClose} className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
        </div>
      </div>
    </>
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
