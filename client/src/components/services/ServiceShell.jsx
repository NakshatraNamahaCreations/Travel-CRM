import { RefreshCw, Search, SlidersHorizontal } from 'lucide-react';

/**
 * Standard Services list page chrome: title, search, actions, "Showing N items".
 */
export default function ServiceShell({
  title,
  search,
  onSearch,
  total,
  onRefresh,
  actions,
  children,
  showSearch = true,
}) {
  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <div className="flex items-center gap-2">
          {showSearch && (
            <div className="flex w-72 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm transition-colors focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200">
              <Search size={15} className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => onSearch?.(e.target.value)}
                placeholder="Search..."
                className="w-full text-sm outline-none"
              />
              <SlidersHorizontal size={15} className="text-gray-400" />
            </div>
          )}
          {actions}
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
        {total != null && <span>Showing {total} Items</span>}
        {onRefresh && (
          <button onClick={onRefresh} className="text-gray-400 hover:text-gray-700" title="Refresh">
            <RefreshCw size={14} />
          </button>
        )}
      </div>

      {children}
    </div>
  );
}
