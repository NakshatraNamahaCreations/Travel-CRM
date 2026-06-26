import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

const ConfirmContext = createContext(null);

/**
 * App-wide confirmation dialog. Wrap the app once, then:
 *   const confirm = useConfirm();
 *   if (await confirm({ title, message, confirmLabel })) doDelete();
 * Resolves true on confirm, false on cancel/backdrop/escape.
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(
    (opts = {}) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setState({
          title: opts.title || 'Are you sure?',
          message: opts.message || 'This action cannot be undone.',
          confirmLabel: opts.confirmLabel || 'Delete',
          cancelLabel: opts.cancelLabel || 'Cancel',
          danger: opts.danger !== false,
        });
      }),
    []
  );

  const close = useCallback((result) => {
    setState(null);
    if (resolver.current) {
      resolver.current(result);
      resolver.current = null;
    }
  }, []);

  useEffect(() => {
    if (!state) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => close(false)}>
          <div className="w-full max-w-sm animate-scale-in rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${state.danger ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                <AlertTriangle size={20} />
              </span>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">{state.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{state.message}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => close(false)} className="btn-secondary">{state.cancelLabel}</button>
              <button
                autoFocus
                onClick={() => close(true)}
                className={state.danger
                  ? 'rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700'
                  : 'btn-primary'}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
