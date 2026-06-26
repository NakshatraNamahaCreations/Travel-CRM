import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronDown, Plus, Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn.js';

const getId = (o) => o?._id ?? o?.id ?? o;
const getLabel = (o) => o?.name ?? o?.label ?? String(o);

/**
 * Async searchable select.
 *
 * @param {object}   props
 * @param {function} props.loadOptions  (search) => Promise<option[]>
 * @param {any}      props.value        option | option[] (controlled)
 * @param {function} props.onChange     (next) => void
 * @param {boolean}  [props.isMulti]
 * @param {boolean}  [props.creatable]  show "Add '<term>'" when no exact match
 * @param {function} [props.onCreate]   (term) => Promise<option>
 */
export default function AsyncSelect({
  loadOptions,
  value,
  onChange,
  isMulti = false,
  creatable = false,
  onCreate,
  placeholder = 'Type to search...',
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const selected = isMulti ? (Array.isArray(value) ? value : []) : value ? [value] : [];
  const selectedIds = selected.map(getId);

  // Debounced fetch when the dropdown is open.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      Promise.resolve(loadOptions(search))
        .then((opts) => active && setOptions(opts || []))
        .finally(() => active && setLoading(false));
    }, 220);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [search, open, loadOptions]);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = useCallback(
    (opt) => {
      if (isMulti) {
        if (!selectedIds.includes(getId(opt))) onChange([...selected, opt]);
      } else {
        onChange(opt);
        setOpen(false);
      }
      setSearch('');
    },
    [isMulti, onChange, selected, selectedIds]
  );

  const remove = (opt) => {
    if (isMulti) onChange(selected.filter((s) => getId(s) !== getId(opt)));
    else onChange(null);
  };

  const exactExists = options.some(
    (o) => getLabel(o).toLowerCase() === search.trim().toLowerCase()
  );
  const showCreate = creatable && search.trim() && !exactExists && !!onCreate;

  const handleCreate = async () => {
    const created = await onCreate(search.trim());
    if (created) pick(created);
  };

  const available = options.filter((o) => !selectedIds.includes(getId(o)));

  return (
    <div className="relative" ref={ref}>
      <div
        className={cn(
          'flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-xl border bg-white px-2 py-1.5 text-sm shadow-sm transition-colors',
          open ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-200'
        )}
        onClick={() => setOpen(true)}
      >
        {isMulti &&
          selected.map((opt) => (
            <span
              key={getId(opt)}
              className="pill-brand"
            >
              {getLabel(opt)}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(opt);
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}

        {!isMulti && value && !open ? (
          <span className="flex-1 truncate text-gray-900">{getLabel(value)}</span>
        ) : (
          <input
            className="min-w-[80px] flex-1 bg-transparent outline-none placeholder-gray-400"
            placeholder={selected.length && !isMulti ? '' : placeholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        )}

        <span className="ml-auto flex items-center gap-1 text-gray-400">
          {!isMulti && value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(value);
              }}
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={16} />
        </span>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full animate-scale-in overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400">
              <Loader2 size={14} className="animate-spin" /> Searching…
            </div>
          )}
          {!loading && available.length === 0 && !showCreate && (
            <div className="px-3 py-2 text-sm text-gray-400">No results</div>
          )}
          {!loading &&
            available.map((opt) => (
              <button
                type="button"
                key={getId(opt)}
                onClick={() => pick(opt)}
                className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                {getLabel(opt)}
              </button>
            ))}
          {showCreate && (
            <button
              type="button"
              onClick={handleCreate}
              className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              <Plus size={14} /> Add “{search.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
