import { Info } from 'lucide-react';
import { cn } from '../../lib/cn.js';

/**
 * Lightweight table.
 * @param {Array<{key,header,render,className,thClassName}>} columns
 * @param {Array} rows
 * @param {function} [rowKey]  (row) => key
 */
export default function DataTable({ columns, rows, rowKey, loading, emptyLabel = 'No results found.' }) {
  if (loading) return <div className="py-16 text-center text-gray-400">Loading…</div>;
  if (!rows?.length)
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
        <Info size={36} className="mb-2 text-gray-300" />
        {emptyLabel}
      </div>
    );

  return (
    <div className="card card-flush overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 text-left text-xs font-semibold tracking-normal text-slate-600">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cn('px-4 py-3.5', c.thClassName)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map((row, i) => (
            <tr key={rowKey ? rowKey(row) : row._id || i} className="even:bg-slate-50/40 hover:bg-brand-50/40">
              {columns.map((c) => (
                <td key={c.key} className={cn('px-4 py-3.5 align-top', c.className)}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
