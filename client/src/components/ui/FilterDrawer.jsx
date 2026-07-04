import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import AsyncSelect from '../form/AsyncSelect.jsx';
import { cn } from '../../lib/cn.js';

/**
 * Generic right-side Advanced Filters drawer, driven by field definitions.
 *
 * field = { key, label, type: 'async'|'select'|'text'|'dateRange'|'checkbox',
 *           loadOptions?, options? [{value,label}], isMulti?, placeholder?,
 *           fromKey?, toKey? (dateRange) }
 */
export default function FilterDrawer({ open, onClose, fields, initial, empty, onApply, title = 'Advanced Filters' }) {
  const [draft, setDraft] = useState(initial || empty);

  useEffect(() => { if (open) setDraft(initial || empty); }, [open, initial, empty]);

  const set = (k) => (v) => setDraft((s) => ({ ...s, [k]: v }));
  const apply = () => { onApply(draft); onClose(); };
  const reset = () => { onApply(empty); onClose(); };

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
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {fields.map((f) => (
            <div key={f.key || f.fromKey}>
              {f.type !== 'checkbox' && <label className="mb-1 block text-sm font-semibold text-slate-700">{f.label}</label>}

              {f.type === 'async' && (
                <AsyncSelect
                  isMulti={!!f.isMulti}
                  loadOptions={f.loadOptions}
                  value={draft[f.key]}
                  onChange={set(f.key)}
                  placeholder={f.placeholder || 'Type to search...'}
                />
              )}

              {f.type === 'select' && (
                <select className="input" value={draft[f.key] ?? ''} onChange={(e) => set(f.key)(e.target.value)}>
                  <option value="">All</option>
                  {(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}

              {f.type === 'text' && (
                <input className="input" value={draft[f.key] ?? ''} onChange={(e) => set(f.key)(e.target.value)} placeholder={f.placeholder || ''} />
              )}

              {f.type === 'dateRange' && (
                <div className="flex items-center gap-2">
                  <input type="date" className="input" value={draft[f.fromKey] ?? ''} onChange={(e) => set(f.fromKey)(e.target.value)} />
                  <span className="text-slate-400">&rarr;</span>
                  <input type="date" className="input" value={draft[f.toKey] ?? ''} onChange={(e) => set(f.toKey)(e.target.value)} />
                </div>
              )}

              {f.type === 'date' && (
                <input type="date" className="input" value={draft[f.key] ?? ''} onChange={(e) => set(f.key)(e.target.value)} />
              )}

              {f.type === 'checkbox' && (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={!!draft[f.key]} onChange={(e) => set(f.key)(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  {f.label}
                </label>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-5 py-4">
          <button onClick={reset} className="text-sm font-medium text-slate-500 hover:text-slate-800">Reset Filters</button>
          <button onClick={apply} className="btn-primary">Apply Filters</button>
        </div>
      </aside>
    </>
  );
}

// Count active filter groups for the badge (arrays, non-empty strings, true booleans, selected objects).
export function countFilters(f) {
  if (!f) return 0;
  return Object.values(f).filter((v) => {
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'string') return v.trim() !== '';
    if (typeof v === 'boolean') return v;
    return v != null && typeof v === 'object';
  }).length;
}
