import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn.js';

// Searchable account picker for the Log Payment modal — lists bank accounts
// + trip/guest accounts, each with a radio, optional "Guest" badge, and a subtitle/phone.
// Value is the chosen account's label string.
export default function AccountSelect({ value, onChange, accounts = [], placeholder = 'Type to search…' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return accounts;
    return accounts.filter((a) => `${a.label} ${a.phone || ''} ${a.subtitle || ''}`.toLowerCase().includes(t));
  }, [q, accounts]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="input flex items-center justify-between text-left">
        <span className={cn('truncate', !value && 'text-slate-400')}>{value || placeholder}</span>
        <ChevronDown size={15} className={cn('shrink-0 text-slate-400 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to search…" className="input py-1.5 text-sm" />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-slate-400">No accounts found.</p>
            ) : filtered.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => { onChange(a.label); setOpen(false); setQ(''); }}
                className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-slate-50"
              >
                <input type="radio" readOnly checked={value === a.label} className="mt-1 shrink-0 text-brand-600" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {a.type === 'guest' && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">Guest</span>}
                    <span className="font-medium text-slate-800">{a.label}</span>
                  </div>
                  {a.subtitle && <p className="text-xs text-slate-400">{a.subtitle}</p>}
                  {a.phone && <p className="text-xs text-brand-600">{a.phone}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
