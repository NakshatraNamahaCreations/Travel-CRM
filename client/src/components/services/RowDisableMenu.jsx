import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Ban, RotateCcw } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';

/**
 * Per-row kebab to disable / re-enable a record via its REST resource.
 * @param {object}   props.row    the row (needs _id, isActive)
 * @param {object}   props.api    a resource() client exposing update(id, payload)
 * @param {function} props.onChanged  refetch callback
 */
export default function RowDisableMenu({ row, api, onChanged }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const disabled = row.isActive === false;
  const mut = useMutation({
    mutationFn: () => api.update(row._id, { isActive: disabled }),
    onSuccess: () => { toast.success(disabled ? 'Enabled' : 'Disabled'); setOpen(false); onChanged?.(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="text-slate-400 hover:text-slate-700"><MoreVertical size={16} /></button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
          <button onClick={() => mut.mutate()} disabled={mut.isPending} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            {disabled ? <><RotateCcw size={14} /> Enable</> : <><Ban size={14} /> Disable</>}
          </button>
        </div>
      )}
    </div>
  );
}
