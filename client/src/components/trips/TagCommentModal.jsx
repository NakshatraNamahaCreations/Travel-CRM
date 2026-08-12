import { useMemo, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import { cn } from '../../lib/cn.js';

// The reconfirmation workflow tags an agent can put on a hotel booking row.
export const BOOKING_TAGS = [
  'Pending Reconfirmation',
  'Payment due for Confirmation',
  'Reconfirmed',
];

// Edits just the Tag / Comments pair on one booking row — the pencil in the
// Tag column of the hotel booking tables. `row` accepts either shape
// (`row.name` from ServiceBooking docs, `row.hotelName` from the Hotel
// Check-Ins view's mapped response).
export default function TagCommentModal({ row, onClose, onSave, saving }) {
  const [tag, setTag] = useState(row.tag || '');
  const [comment, setComment] = useState(row.comment || '');
  const [search, setSearch] = useState('');

  const options = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = BOOKING_TAGS.includes(tag) || !tag ? BOOKING_TAGS : [...BOOKING_TAGS, tag];
    return q ? all.filter((t) => t.toLowerCase().includes(q)) : all;
  }, [search, tag]);

  return (
    <Modal open onClose={onClose} title="Edit Tag/Comments" width="max-w-md">
      <div className="space-y-4">
        <div>
          <label className="label">Select Tag <span className="font-normal text-gray-400">(optional)</span></label>
          <input
            className="input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type to search..."
          />
          <div className="mt-1 overflow-hidden rounded-lg border border-slate-200">
            {options.length ? options.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTag(tag === t ? '' : t)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50',
                  tag === t && 'bg-brand-50/60'
                )}
              >
                <span className={cn(
                  'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
                  tag === t ? 'border-brand-600' : 'border-slate-300'
                )}>
                  {tag === t && <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />}
                </span>
                <span className={cn(tag === t ? 'font-medium text-slate-800' : 'text-slate-600')}>{t}</span>
              </button>
            )) : (
              <p className="px-3 py-2 text-sm text-slate-400">No matching tag.</p>
            )}
          </div>
        </div>

        <div>
          <label className="label">Comments <span className="font-normal text-gray-400">(optional)</span></label>
          <textarea rows={3} className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Notes / follow-up…" />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={() => onSave({ tag, comment })} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
