import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import AsyncSelect from '../form/AsyncSelect.jsx';
import { destinationsApi } from '../../api/masterData.js';
import { optionsApi } from '../../api/options.js';
import { cn } from '../../lib/cn.js';

export const EMPTY_HOTEL_FILTERS = {
  destinations: [], location: '', roomTypes: [], mealPlans: [],
  stars: [], updatedFrom: '', updatedTo: '', disabledOnly: false,
};

// How many filter groups are active — used for the badge on the filter icon.
export function countHotelFilters(f) {
  if (!f) return 0;
  let n = 0;
  if (f.destinations?.length) n++;
  if (f.location?.trim()) n++;
  if (f.roomTypes?.length) n++;
  if (f.mealPlans?.length) n++;
  if (f.stars?.length) n++;
  if (f.updatedFrom || f.updatedTo) n++;
  if (f.disabledOnly) n++;
  return n;
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-slate-700">{label}</label>
      {children}
    </div>
  );
}

export default function HotelFilterDrawer({ open, onClose, initial, onApply }) {
  const [draft, setDraft] = useState(initial || EMPTY_HOTEL_FILTERS);

  // Re-seed the draft from the applied filters whenever the drawer opens.
  useEffect(() => {
    if (open) setDraft(initial || EMPTY_HOTEL_FILTERS);
  }, [open, initial]);

  const set = (k) => (v) => setDraft((s) => ({ ...s, [k]: v }));
  const toggleStar = (n) =>
    setDraft((s) => ({ ...s, stars: s.stars.includes(n) ? s.stars.filter((x) => x !== n) : [...s.stars, n] }));

  const loadDestinations = useCallback((s) => destinationsApi.search(s), []);
  const loadMealPlans = useCallback(
    (s) => optionsApi.search('mealPlan', s).then((l) => l.map((o) => ({ _id: o.value, name: o.value }))),
    []
  );
  const loadRoomTypes = useCallback(
    (s) => optionsApi.search('roomType', s).then((l) => l.map((o) => ({ _id: o.value, name: o.value }))),
    []
  );

  const apply = () => { onApply(draft); onClose(); };
  const reset = () => { setDraft(EMPTY_HOTEL_FILTERS); onApply(EMPTY_HOTEL_FILTERS); };

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

          <Field label="Location (City)">
            <input className="input" value={draft.location} onChange={(e) => set('location')(e.target.value)} placeholder="e.g. Havelock" />
          </Field>

          <Field label="Room Types">
            <AsyncSelect isMulti loadOptions={loadRoomTypes} value={draft.roomTypes} onChange={set('roomTypes')} placeholder="Type to search..." />
          </Field>

          <Field label="Meal Plans">
            <AsyncSelect isMulti loadOptions={loadMealPlans} value={draft.mealPlans} onChange={set('mealPlans')} placeholder="Select meals..." />
          </Field>

          <Field label="Star Categories">
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => toggleStar(n)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                    draft.stars.includes(n)
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  )}
                >
                  {n}★
                </button>
              ))}
            </div>
          </Field>

          <Field label="Last Updated Between">
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
