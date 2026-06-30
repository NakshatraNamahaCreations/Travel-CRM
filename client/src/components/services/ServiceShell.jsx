import { RefreshCw, Search, SlidersHorizontal } from 'lucide-react';

/**
 * Standard Services list page chrome: title, search, actions, "Showing N items".
 *
 * @param {function} [onFilterClick] when set, the sliders icon becomes a button (filter drawer trigger)
 * @param {number}   [filterCount]   active-filter badge shown on the sliders icon
 * @param {number}   [rangeStart]    1-based index of first row shown (for "Showing X - Y of Z")
 * @param {number}   [rangeEnd]      1-based index of last row shown
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
  onFilterClick,
  filterCount = 0,
  rangeStart,
  rangeEnd,
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
              {onFilterClick ? (
                <button
                  type="button"
                  onClick={onFilterClick}
                  title="Advanced Filters"
                  className="relative -mr-1 rounded-md p-1 text-gray-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
                >
                  <SlidersHorizontal size={15} />
                  {filterCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[9px] font-bold text-white">
                      {filterCount}
                    </span>
                  )}
                </button>
              ) : (
                <SlidersHorizontal size={15} className="text-gray-400" />
              )}
            </div>
          )}
          {actions}
        </div>
      </div>

      <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
        {total != null && (
          <span>
            {rangeStart != null && rangeEnd != null
              ? `Showing ${rangeStart} - ${rangeEnd} of ${total} Items`
              : `Showing ${total} Items`}
          </span>
        )}
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
