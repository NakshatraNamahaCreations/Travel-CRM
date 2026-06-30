import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import AsyncSelect from '../form/AsyncSelect.jsx';
import { destinationsApi } from '../../api/masterData.js';
import { cn } from '../../lib/cn.js';

export const EMPTY_TRANSPORT_FILTERS = {
  destinations: [], from: '', to: '', updatedFrom: '', updatedTo: '', disabledOnly: false,
};

export function countTransportFilters(f) {
  if (!f) return 0;
  let n = 0;
  if (f.destinations?.length) n++;
  if (f.from?.trim()) n++;
  if (f.to?.trim()) n++;
  if (f.updatedFrom || f.updatedTo) n++;
  if (f.disabledOnly) n++;
  return n;
}

// Local YYYY-MM-DD (avoids timezone shifts from toISOString).
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function presetRange(key) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (key === 'today') return [today, today];
  if (key === 'yesterday') { const y = new Date(today); y.setDate(y.getDate() - 1); return [y, y]; }
  if (key === 'week') { const s = new Date(today); const dow = (s.getDay() + 6) % 7; s.setDate(s.getDate() - dow); return [s, today]; }
  if (key === 'month') return [new Date(today.getFullYear(), today.getMonth(), 1), today];
  if (key === 'lastMonth') return [new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 0)];
  return [null, null];
}

const PRESETS = [['today', 'Today'], ['yesterday', 'Yesterday'], ['week', 'This Week'], ['month', 'This Month'], ['lastMonth', 'Last Month']];

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  );
}

export default function TransportFilterDrawer({ open, onClose, initial, onApply }) {
  const [draft, setDraft] = useState(initial || EMPTY_TRANSPORT_FILTERS);

  useEffect(() => {
    if (open) setDraft(initial || EMPTY_TRANSPORT_FILTERS);
  }, [open, initial]);

  const set = (k) => (v) => setDraft((s) => ({ ...s, [k]: v }));
  const applyPreset = (key) => {
    const [from, to] = presetRange(key);
    setDraft((s) => ({ ...s, updatedFrom: from ? ymd(from) : '', updatedTo: to ? ymd(to) : '' }));
  };

  const loadDestinations = useCallback((s) => destinationsApi.search(s), []);

  const apply = () => { onApply(draft); onClose(); };
  const reset = () => { setDraft(EMPTY_TRANSPORT_FILTERS); onApply(EMPTY_TRANSPORT_FILTERS); };

  return (
    <>
      {open && <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} aria-hidden="true" />}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="font-semibold text-slate-900">Advanced Filters</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <Field label="Destinations">
            <AsyncSelect isMulti loadOptions={loadDestinations} value={draft.destinations} onChange={set('destinations')} placeholder="Type to search..." />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="From (Start City)">
              <input className="input" value={draft.from} onChange={(e) => set('from')(e.target.value)} placeholder="e.g. Port Blair" />
            </Field>
            <Field label="To (End City)">
              <input className="input" value={draft.to} onChange={(e) => set('to')(e.target.value)} placeholder="e.g. Havelock" />
            </Field>
          </div>

          <Field label="Last Updated Between">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {PRESETS.map(([key, label]) => (
                <button key={key} type="button" onClick={() => applyPreset(key)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="date" className="input" value={draft.updatedFrom} onChange={(e) => set('updatedFrom')(e.target.value)} />
              <span className="text-slate-400">→</span>
              <input type="date" className="input" value={draft.updatedTo} onChange={(e) => set('updatedTo')(e.target.value)} />
            </div>
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={draft.disabledOnly} onChange={(e) => set('disabledOnly')(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
            Disabled Only
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-4">
          <button onClick={reset} className="text-sm font-medium text-slate-500 hover:text-slate-800">Reset Filters</button>
          <button onClick={apply} className="btn-primary">Apply Filters</button>
        </div>
      </aside>
    </>
  );
}
