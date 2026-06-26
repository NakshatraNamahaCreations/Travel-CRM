import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { accountsApi, transactionsApi } from '../../api/accounts.js';
import Modal from '../ui/Modal.jsx';
import AsyncSelect from '../form/AsyncSelect.jsx';

// Record a double-entry transaction (debit → credit).
export default function TransactionFormModal({ open, onClose, onSaved, presetDebit, presetCredit }) {
  const [f, setF] = useState({
    debitAccount: presetDebit || null,
    creditAccount: presetCredit || null,
    amount: '',
    date: '',
    refId: '',
    narration: '',
  });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const loadAccounts = (s) => accountsApi.list({ search: s, limit: 20 }).then((r) => r.data);

  const mut = useMutation({
    mutationFn: () => transactionsApi.create({
      debitAccount: f.debitAccount?._id,
      creditAccount: f.creditAccount?._id,
      amount: Number(f.amount),
      date: f.date || undefined,
      refId: f.refId || undefined,
      narration: f.narration || undefined,
    }),
    onSuccess: () => { toast.success('Transaction recorded'); onSaved?.(); },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    if (!f.debitAccount || !f.creditAccount) return toast.error('Select debit and credit accounts');
    if (f.debitAccount._id === f.creditAccount._id) return toast.error('Debit and credit accounts must differ');
    if (!(Number(f.amount) > 0)) return toast.error('Enter an amount');
    mut.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="New Transaction" width="max-w-lg">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Debit Account</label><AsyncSelect loadOptions={loadAccounts} value={f.debitAccount} onChange={set('debitAccount')} placeholder="From…" /></div>
          <div><label className="label">Credit Account</label><AsyncSelect loadOptions={loadAccounts} value={f.creditAccount} onChange={set('creditAccount')} placeholder="To…" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Amount</label><input type="number" min="0" className="input" value={f.amount} onChange={(e) => set('amount')(e.target.value)} placeholder="0" /></div>
          <div><label className="label">Date <span className="label-optional">(optional)</span></label><input type="date" className="input" value={f.date} onChange={(e) => set('date')(e.target.value)} /></div>
        </div>
        <div><label className="label">Reference ID <span className="label-optional">(optional)</span></label><input className="input" value={f.refId} onChange={(e) => set('refId')(e.target.value)} placeholder="UTR / settlement id" /></div>
        <div><label className="label">Narration <span className="label-optional">(optional)</span></label><input className="input" value={f.narration} onChange={(e) => set('narration')(e.target.value)} placeholder="What is this for?" /></div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={submit} disabled={mut.isPending} className="btn-primary">{mut.isPending ? 'Saving…' : 'Save Transaction'}</button>
        </div>
      </div>
    </Modal>
  );
}
