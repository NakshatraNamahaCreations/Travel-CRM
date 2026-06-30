import { Info } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * Lightweight table.
 * @param {Array<{key,header,render,className,thClassName}>} columns
 * @param {Array} rows
 * @param {function} [rowKey]  (row) => key
 * @param {boolean} [selectable]        render a leading checkbox column
 * @param {Array<string>} [selectedIds] ids of currently-selected rows
 * @param {function} [onToggleRow]      (id) => void
 * @param {function} [onToggleAll]      (allIds, allSelected) => void
 */
export default function DataTable({
  columns, rows, rowKey, loading, emptyLabel = 'No results found.',
  selectable = false, selectedIds = [], onToggleRow, onToggleAll,
}) {
  if (loading) return <div className="py-16 text-center text-gray-400">Loading…</div>;
  if (!rows?.length)
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
        <Info size={36} className="mb-2 text-gray-300" />
        {emptyLabel}
      </div>
    );

  const keyOf = (row, i) => (rowKey ? rowKey(row) : row._id || i);
  const selected = new Set(selectedIds);
  const allIds = rows.map((r, i) => keyOf(r, i));
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selected.has(id));

  return (
    <div className="card card-flush overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left text-xs font-semibold tracking-normal text-slate-600">
          <tr>
            {selectable && (
              <th className="w-10 px-4 py-3.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleAll?.(allIds, allSelected)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
              </th>
            )}
            {columns.map((c) => (
              <th key={c.key} className={cn('px-4 py-3.5', c.thClassName)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row, i) => {
            const id = keyOf(row, i);
            const isSel = selected.has(id);
            return (
              <tr key={id} className={cn('hover:bg-brand-50/40', isSel ? 'bg-brand-50/60' : 'even:bg-slate-50/40')}>
                {selectable && (
                  <td className="px-4 py-3.5 align-top">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => onToggleRow?.(id)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3.5 align-top', c.className)}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
