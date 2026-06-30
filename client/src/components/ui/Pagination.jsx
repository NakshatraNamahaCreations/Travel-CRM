import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/cn.js';

// Windowed page numbers around the current page, with first/last anchors.
function pageList(page, totalPages) {
  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

export default function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  const go = (p) => p >= 1 && p <= totalPages && p !== page && onChange(p);

  return (
    <div className="mt-4 flex items-center justify-center gap-1">
      <button
        onClick={() => go(page - 1)}
        disabled={page <= 1}
        className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft size={15} /> Prev
      </button>

      {pageList(page, totalPages).map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-1.5 text-sm text-slate-400">…</span>
        ) : (
          <button
            key={p}
            onClick={() => go(p)}
            className={cn(
              'h-8 min-w-8 rounded-lg border px-2 text-sm transition-colors',
              p === page
                ? 'border-brand-600 bg-brand-600 font-semibold text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            )}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => go(page + 1)}
        disabled={page >= totalPages}
        className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next <ChevronRight size={15} />
      </button>
    </div>
  );
}
