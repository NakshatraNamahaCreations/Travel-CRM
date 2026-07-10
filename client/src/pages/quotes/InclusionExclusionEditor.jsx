import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus, X, ListChecks } from 'lucide-react';
import { inclusionExclusionApi } from '../../api/masterData.js';

/* Text input with a suggestion dropdown fed by the Inclusions/Exclusions
   master — Sembark-style "select or type your own" rows. */
function SuggestInput({ value, onChange, suggestions, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const q = String(value || '').toLowerCase();
  const filtered = suggestions.filter((s) => s.toLowerCase().includes(q) && s !== value).slice(0, 8);

  return (
    <div className="relative flex-1" ref={ref}>
      <input
        className="input w-full"
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
          {filtered.map((s) => (
            <button
              type="button"
              key={s}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(s); setOpen(false); }}
              className="block w-full px-3 py-1.5 text-left text-[12.5px] text-slate-700 hover:bg-brand-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Column({ title, rows, onRows, suggestions, addLabel, note }) {
  const setRow = (i, v) => onRows(rows.map((r, idx) => (idx === i ? v : r)));
  const rmRow = (i) => onRows(rows.filter((_, idx) => idx !== i));
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        {rows.length > 0 && (
          <button type="button" onClick={() => onRows([])} className="text-slate-300 transition hover:text-red-500" title={`Clear all ${title.toLowerCase()}`}>
            <X size={15} />
          </button>
        )}
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <SuggestInput value={r} onChange={(v) => setRow(i, v)} suggestions={suggestions} placeholder="Select from the master or type your own…" />
            <button type="button" onClick={() => rmRow(i)} className="text-slate-300 transition hover:text-red-500" title="Remove line"><X size={15} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onRows([...rows, ''])} className="btn-secondary mt-3 text-xs"><Plus size={13} /> {addLabel}</button>
      {note && <p className="mt-3 text-xs text-amber-600">{note}</p>}
    </div>
  );
}

/* Quote-level Inclusion/Exclusion editor for the quote builder. Leaving both
   lists empty makes the quotation fall back to the master defaults. */
export default function InclusionExclusionEditor({ inclusions, exclusions, onChange }) {
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ['inclusion-exclusions', 'defaults'],
    queryFn: () => inclusionExclusionApi.list({ limit: 200 }),
    staleTime: 60_000,
  });
  const items = (data?.data || []).filter((i) => i.isActive !== false);
  const incSuggestions = items.filter((i) => i.type === 'inclusion').map((i) => i.text);
  const excSuggestions = items.filter((i) => i.type === 'exclusion').map((i) => i.text);

  const loadPreset = () => onChange({ inclusions: [...incSuggestions], exclusions: [...excSuggestions] });
  const customised = inclusions.length > 0 || exclusions.length > 0;

  return (
    <div className="card p-5 sm:p-6">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm"><ListChecks size={17} /></span>
        <div className="flex-1">
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
            Inclusion / Exclusion
            {open ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {customised
              ? `Custom lists for this quote — ${inclusions.length} inclusion${inclusions.length === 1 ? '' : 's'}, ${exclusions.length} exclusion${exclusions.length === 1 ? '' : 's'}.`
              : 'Using the default lists from Settings → Inclusions & Exclusions. Expand to customise for this quote.'}
          </p>
        </div>
      </button>

      {open && (
        <div className="mt-5 border-t border-slate-100 pt-5">
          <div className="mb-5 flex items-end gap-3">
            <div>
              <label className="label">Select Inc/Exclusion Preset</label>
              <select
                className="input w-64"
                value=""
                onChange={(e) => { if (e.target.value === 'default') loadPreset(); }}
              >
                <option value="">Choose a preset…</option>
                <option value="default">Default Package (from Settings)</option>
              </select>
            </div>
            {customised && (
              <button type="button" onClick={() => onChange({ inclusions: [], exclusions: [] })} className="btn-secondary text-xs">
                Reset to defaults
              </button>
            )}
          </div>

          <div className="flex flex-col gap-8 lg:flex-row">
            <Column title="Included" rows={inclusions} onRows={(rows) => onChange({ inclusions: rows, exclusions })} suggestions={incSuggestions} addLabel="Add Inclusion" />
            <Column
              title="Excluded"
              rows={exclusions}
              onRows={(rows) => onChange({ inclusions, exclusions: rows })}
              suggestions={excSuggestions}
              addLabel="Add Exclusion"
              note="Anything not mentioned in the inclusions is excluded."
            />
          </div>
        </div>
      )}
    </div>
  );
}
