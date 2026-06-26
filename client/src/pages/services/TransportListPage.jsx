import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Bus, MoreVertical, Receipt, Car, Download, Ban } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { transportApi } from '../../api/services.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import ServiceShell from '../../components/services/ServiceShell.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';

function ToolsMenu({ onDownload, onBulkDisable }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const Item = ({ icon: Icon, children, onClick, to, danger }) => {
    const cls = `flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm ${danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'}`;
    return to
      ? <Link to={to} onClick={() => setOpen(false)} className={cls}><Icon size={15} className={danger ? '' : 'text-slate-400'} /> {children}</Link>
      : <button onClick={() => { setOpen(false); onClick(); }} className={cls}><Icon size={15} className={danger ? '' : 'text-slate-400'} /> {children}</button>;
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn-secondary px-2" title="More"><MoreVertical size={16} /></button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <Item icon={Receipt} to="/services/transport-prices">View Prices</Item>
          <Item icon={Car} to="/services/transport/cab-types">Cab Types</Item>
          <div className="my-1 border-t border-slate-100" />
          <Item icon={Download} onClick={onDownload}>Download as CSV/Excel</Item>
          <Item icon={Ban} onClick={onBulkDisable} danger>Bulk Disable Transport Services</Item>
        </div>
      )}
    </div>
  );
}

export default function TransportListPage() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const qc = useQueryClient();
  const confirm = useConfirm();

  const { data, isLoading } = useQuery({
    queryKey: ['transport', debounced],
    queryFn: () => transportApi.list({ search: debounced, limit: 50 }),
  });
  const rows = data?.data || [];

  const bulkMut = useMutation({
    mutationFn: () => transportApi.bulkDisable(),
    onSuccess: (r) => { toast.success(`Disabled ${r.disabled} service${r.disabled === 1 ? '' : 's'}`); qc.invalidateQueries({ queryKey: ['transport'] }); },
    onError: (e) => toast.error(e.message),
  });
  const askBulkDisable = async () => {
    if (await confirm({ title: 'Bulk disable transport services?', message: 'Every active transport service will be marked inactive (hidden from lists). You can re-enable them later.', confirmLabel: 'Disable All' })) bulkMut.mutate();
  };

  const downloadCsv = () => {
    const data2 = rows.map((t) => [t.from || t.name, t.to || '', (t.items || []).map((i) => i.name).join('; '), format(new Date(t.updatedAt), 'yyyy-MM-dd')]);
    const csv = [['From', 'To', 'Services', 'Last Updated'], ...data2].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transport-services.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const columns = [
    {
      key: 'from',
      header: 'From',
      render: (t) => (
        <div className="flex items-center gap-2">
          <Bus size={16} className="text-brand-500" />
          <Link to={`/services/transport/${t._id}`} className="font-semibold text-brand-600 hover:underline">{t.from || t.name}</Link>
        </div>
      ),
    },
    { key: 'to', header: 'To', render: (t) => <span className="text-gray-600">{t.to || ''}</span> },
    {
      key: 'items',
      header: 'Services',
      render: (t) => (
        <div className="space-y-1">
          {(t.items || []).slice(0, 2).map((it) => (
            <div key={it._id || it.name} className="rounded border border-gray-100 bg-gray-50 px-2 py-1 text-gray-700">{it.name}</div>
          ))}
          {t.items?.length > 2 && <span className="text-xs text-brand-600">View More ({t.items.length - 2})</span>}
          {!t.items?.length && <span className="text-gray-400">—</span>}
        </div>
      ),
    },
    { key: 'updated', header: 'Last Updated', render: (t) => <span className="text-gray-500">{format(new Date(t.updatedAt), 'd MMM, yyyy')}</span> },
  ];

  return (
    <ServiceShell
      title="Transport Services"
      search={search}
      onSearch={setSearch}
      total={data?.meta?.total}
      onRefresh={() => qc.invalidateQueries({ queryKey: ['transport'] })}
      actions={
        <>
          <Link to="/services/transport/new" className="btn-primary"><Plus size={16} /> New Service</Link>
          <ToolsMenu onDownload={downloadCsv} onBulkDisable={askBulkDisable} />
        </>
      }
    >
      <DataTable columns={columns} rows={rows} loading={isLoading} emptyLabel="No transport services yet." />
    </ServiceShell>
  );
}
