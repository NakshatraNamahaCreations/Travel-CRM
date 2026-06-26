import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { transactionsApi } from '../../api/accounts.js';
import { money } from '../../lib/pricing.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { cn } from '../../lib/cn.js';
import TransactionFormModal from '../../components/accounting/TransactionFormModal.jsx';

const TABS = [
  { key: 'month', label: 'This Month' },
  { key: 'last-month', label: 'Last Month' },
  { key: 'all', label: 'All Transactions' },
];

export default function TransactionsPage() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState('month');
  const [search, setSearch] = useState('');
  const [showTxn, setShowTxn] = useState(false);
  const debounced = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', period, debounced],
    queryFn: () => transactionsApi.list({ period, search: debounced, limit: 50 }),
  });
  const items = data?.data || [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['transactions'] });
  const dt = (d) => (d ? format(new Date(d), 'd MMM, yyyy') : '—');

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Transactions</h1>
        <div className="flex items-center gap-2">
          <div className="flex w-64 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <Search size={15} className="text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full text-sm outline-none" />
          </div>
          <button onClick={() => setShowTxn(true)} className="btn-primary"><Plus size={16} /> Transaction</button>
        </div>
      </div>

      <div className="flex gap-6">
        <aside className="w-40 shrink-0 space-y-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setPeriod(t.key)} className={cn('block w-full rounded-lg px-3 py-2 text-left text-sm', period === t.key ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50')}>
              {t.label}
            </button>
          ))}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-500">
            Showing {data?.meta?.total ?? items.length} Items
            <button onClick={refresh} className="text-slate-400 hover:text-slate-700"><RefreshCw size={14} /></button>
          </div>
          <div className="card card-flush overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Txn ID</th>
                  <th className="px-4 py-3">Txn Date</th>
                  <th className="px-4 py-3">Debit Acc.</th>
                  <th className="px-4 py-3">Credit Acc.</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Ref ID</th>
                  <th className="px-4 py-3">Narration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-400">Loading…</td></tr>
                ) : !items.length ? (
                  <tr><td colSpan={7} className="py-12 text-center text-slate-400">No transactions yet.</td></tr>
                ) : items.map((t) => (
                  <tr key={t._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.txnId}</td>
                    <td className="px-4 py-3 text-slate-600">{dt(t.date)}</td>
                    <td className="px-4 py-3 text-slate-700">{t.debitAccount?.name || '—'}</td>
                    <td className="px-4 py-3 text-brand-700">{t.creditAccount?.name || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(t.amount, t.currency)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{t.refId || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{t.narration || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <TransactionFormModal open={showTxn} onClose={() => setShowTxn(false)} onSaved={() => { setShowTxn(false); refresh(); }} />
    </div>
  );
}
