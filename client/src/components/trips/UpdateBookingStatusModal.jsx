import { useState } from 'react';
import Modal from '../ui/Modal.jsx';

// Status is a one-way workflow, never revertible to an earlier stage:
//   Initialized -> { In Progress, Booked, Changed }
//   In Progress <-> Changed, either -> Booked
//   Booked (= finalized/confirmed with the supplier) -> Dropped ONLY
//   Dropped is terminal, and is never offered before a line is Booked.
export const STATUS_LABEL = { initialized: 'Initialized', in_progress: 'In Progress', booked: 'Booked', changed: 'Changed', cancelled: 'Dropped' };

const TRANSITIONS = {
  initialized: ['in_progress', 'booked', 'changed'],
  in_progress: ['changed', 'booked'],
  changed: ['in_progress', 'booked'],
  booked: ['cancelled'],
  cancelled: [],
};

export function nextStatusOptions(current) {
  return TRANSITIONS[current] || [];
}

export default function UpdateBookingStatusModal({ row, onClose, onSave, saving }) {
  const options = nextStatusOptions(row.status);
  const [status, setStatus] = useState('');
  const [comment, setComment] = useState('');

  return (
    <Modal open onClose={onClose} title="Update Booking Status" width="max-w-md">
      {options.length ? (
        <div className="space-y-4">
          <div>
            <label className="label">Select Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Select status...</option>
              {options.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Any Comments <span className="font-normal text-gray-400">(optional)</span></label>
            <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => onSave({ status, comment: comment || row.comment })} disabled={!status || saving} className="btn-primary">
              {saving ? 'Updating…' : 'Update'}
            </button>
            <button onClick={onClose} className="btn-secondary">Cancel</button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">This booking has been dropped — no further status changes are available.</p>
      )}
    </Modal>
  );
}
