import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, RefreshCw, Briefcase } from 'lucide-react';
import { accountsApi } from '../../api/accounts.js';
import { money } from '../../lib/pricing.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { cn } from '../../lib/cn.js';
import TransactionFormModal from '../../components/accounting/TransactionFormModal.jsx';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'company', label: 'Company' },
  { key: 'employee', label: 'Employee' },
  { key: 'third_party', label: 'Third Party' },
  { key: 'guest', label: 'Guest' },
  { key: 'gateway', label: 'Gateway' },
];

const KIND_LABEL = { company: 'Company', employee: 'Employee', third_party: 'Third Party', guest: 'Guest', gateway: 'Gateway', bank: 'Bank' };

export default function AccountsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [showTxn, setShowTxn] = useState(false);
  const debounced = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['accounts', tab, debounced],
    queryFn: () => accountsApi.list({ kind: tab, search: debounced, limit: 50 }),
  });
  const items = data?.data || [];
  const refresh = () => qc.invalidateQueries({ queryKey: ['accounts'] });

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">Accounts</h1>
        <div className="flex items-center gap-2">
          <div className="flex w-64 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <Search size={15} className="text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full text-sm outline-none" />
          </div>
          <Link to="/accounting/accounts/new" className="btn-primary"><Plus size={16} /> Account</Link>
          <button onClick={() => setShowTxn(true)} className="btn-secondary"><Plus size={16} /> Transaction</button>
        </div>
      </div>

      <div className="flex gap-6">
        <aside className="w-44 shrink-0 space-y-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={cn('block w-full rounded-lg px-3 py-2 text-left text-sm', tab === t.key ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50')}>
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
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3 text-right">Assets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan={4} className="py-12 text-center text-slate-400">Loading…</td></tr>
                ) : !items.length ? (
                  <tr><td colSpan={4} className="py-12 text-center text-slate-400">No accounts yet.</td></tr>
                ) : items.map((a) => (
                  <tr key={a._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Briefcase size={14} className="text-slate-300" />
                        <div>
                          <span className="font-medium text-slate-800">{a.name}</span>
                          {a.phone && <div className="text-xs text-slate-400">{a.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{KIND_LABEL[a.kind] || a.kind}</td>
                    <td className="px-4 py-3">
                      {(a.tags || []).length ? a.tags.map((t) => <span key={t} className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{t}</span>) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className={cn('px-4 py-3 text-right font-semibold tabular-nums', a.balance < 0 ? 'text-rose-600' : 'text-slate-800')}>
                      {money(a.balance, a.currency)}
                    </td>
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
