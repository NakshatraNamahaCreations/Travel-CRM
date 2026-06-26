import { X, Plus } from 'lucide-react';
import { cn } from '../../lib/cn.js';

export const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// A growable list of free-text rows (e.g. pickup / drop points).
export function LocationList({ value, onChange, placeholder }) {
  const set = (i, v) => onChange(value.map((x, idx) => (idx === i ? v : x)));
  return (
    <div className="space-y-2">
      {value.map((loc, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className="input flex-1" value={loc} onChange={(e) => set(i, e.target.value)} placeholder={placeholder} />
          {value.length > 1 && <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500"><X size={16} /></button>}
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, ''])} className="text-sm font-medium text-brand-600 hover:underline">+ Add More</button>
    </div>
  );
}

// Toggleable weekday chips.
export function DayPicker({ value, onChange }) {
  const toggle = (d) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEK_DAYS.map((d) => (
        <button type="button" key={d} onClick={() => toggle(d)} className={cn('rounded-lg border px-2.5 py-1 text-xs font-medium', value.includes(d) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:border-slate-300')}>
          {d.slice(0, 3)}
        </button>
      ))}
    </div>
  );
}

// A growable list of start→end date intervals.
export function IntervalList({ value, onChange }) {
  const set = (i, patch) => onChange(value.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  return (
    <div className="space-y-2">
      {value.map((iv, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="date" className="input" value={iv.start} onChange={(e) => set(i, { start: e.target.value })} />
          <span className="text-slate-400">→</span>
          <input type="date" className="input" value={iv.end} onChange={(e) => set(i, { end: e.target.value })} />
          <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { start: '', end: '' }])} className="btn-secondary text-sm"><Plus size={14} /> Add Date Intervals</button>
    </div>
  );
}
