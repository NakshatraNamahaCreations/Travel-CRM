import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Ticket, MoreVertical, Download, Ban } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { activitiesApi } from '../../api/services.js';
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
  const Item = ({ icon: Icon, children, onClick, danger }) => (
    <button onClick={() => { setOpen(false); onClick(); }} className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm ${danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'}`}>
      <Icon size={15} className={danger ? '' : 'text-slate-400'} /> {children}
    </button>
  );
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="btn-secondary px-2" title="More"><MoreVertical size={16} /></button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <Item icon={Download} onClick={onDownload}>Download Travel Activities Details</Item>
          <Item icon={Ban} onClick={onBulkDisable} danger>Bulk Disable Travel Activities</Item>
        </div>
      )}
    </div>
  );
}

export default function ActivitiesListPage() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const qc = useQueryClient();
  const confirm = useConfirm();

  const { data, isLoading } = useQuery({
    queryKey: ['activities', debounced],
    queryFn: () => activitiesApi.list({ search: debounced, limit: 50 }),
  });
  const rows = data?.data || [];

  const bulkMut = useMutation({
    mutationFn: () => activitiesApi.bulkDisable(),
    onSuccess: (r) => { toast.success(`Disabled ${r.disabled} activit${r.disabled === 1 ? 'y' : 'ies'}`); qc.invalidateQueries({ queryKey: ['activities'] }); },
    onError: (e) => toast.error(e.message),
  });
  const askBulkDisable = async () => {
    if (await confirm({ title: 'Bulk disable travel activities?', message: 'Every active travel activity will be marked inactive (hidden from lists). You can re-enable them later.', confirmLabel: 'Disable All' })) bulkMut.mutate();
  };

  const downloadCsv = () => {
    const data2 = rows.map((a) => [a.name, (a.ticketTypes || []).map((t) => t.name).join('; '), a.ageConfig || '', format(new Date(a.updatedAt), 'yyyy-MM-dd')]);
    const csv = [['Activity', 'Ticket / Packages', 'Age Config', 'Last Updated'], ...data2].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'travel-activities.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const columns = [
    {
      key: 'name',
      header: 'Activities Name',
      render: (a) => (
        <div className="flex items-center gap-2">
          <Ticket size={16} className="text-brand-500" />
          <Link to={`/services/activities/${a._id}`} className="font-semibold text-brand-600 hover:underline">{a.name}</Link>
        </div>
      ),
    },
    {
      key: 'tickets',
      header: 'Ticket / Packages',
      render: (a) => <TicketCell tickets={a.ticketTypes} />,
    },
    { key: 'age', header: 'Age Config', render: (a) => <span className="text-gray-600">{cleanAgeConfig(a.ageConfig) || '—'}</span> },
    { key: 'updated', header: 'Last Updated', render: (a) => <span className="text-gray-500">{format(new Date(a.updatedAt), 'd MMM, yyyy')}</span> },
  ];

  return (
    <ServiceShell
      title="Travel Activities"
      search={search}
      onSearch={setSearch}
      total={data?.meta?.total}
      onRefresh={() => qc.invalidateQueries({ queryKey: ['activities'] })}
      actions={
        <div className="flex gap-2">
          <Link to="/services/activity-prices" className="btn-secondary">Prices</Link>
          <Link to="/services/activities/new" className="btn-primary"><Plus size={16} /> Add New</Link>
          <ToolsMenu onDownload={downloadCsv} onBulkDisable={askBulkDisable} />
        </div>
      }
    >
      <DataTable columns={columns} rows={rows} loading={isLoading} emptyLabel="No activities yet." />
    </ServiceShell>
  );
}

// Drop stray "undefined"/empty tokens that crept in from imported age-config strings.
function cleanAgeConfig(value) {
  if (!value) return '';
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s.toLowerCase() !== 'undefined')
    .join(', ');
}

// Ticket/package cell — shows the first two, expandable to all via "View More".
function TicketCell({ tickets }) {
  const [open, setOpen] = useState(false);
  if (!tickets?.length) return <span className="text-gray-400">—</span>;
  const shown = open ? tickets : tickets.slice(0, 2);
  return (
    <div className="space-y-1">
      {shown.map((t, i) => (
        <div key={t._id || `${t.name}-${i}`} className="rounded border border-gray-100 bg-gray-50 px-2 py-1 text-gray-700">{t.name}</div>
      ))}
      {tickets.length > 2 && (
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-medium text-brand-600 hover:underline">
          {open ? 'View Less' : `View More (${tickets.length - 2})`}
        </button>
      )}
    </div>
  );
}
