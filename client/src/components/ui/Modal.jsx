import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null;
  return (
    // On phones the sheet starts near the top and can use the full height;
    // from sm: up it floats with the original inset. `max-h`/`overflow` keep
    // long forms scrollable instead of overflowing off-screen.
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-2 pt-4 sm:p-4 sm:pt-20">
      <div
        className={`card card-flush my-auto w-full ${width} animate-scale-in flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden bg-white shadow-xl sm:max-h-[calc(100dvh-6rem)]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6 sm:py-4">
          <h3 className="min-w-0 truncate font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="shrink-0 text-slate-400 transition-colors hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
