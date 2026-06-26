import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { teamsApi } from '../../api/settings.js';
import ServiceShell from '../../components/services/ServiceShell.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';

function TeamForm({ existing, onSaved }) {
  const isEdit = !!existing;
  const [f, setF] = useState({ name: existing?.name || '', description: existing?.description || '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const mut = useMutation({
    mutationFn: () => (isEdit ? teamsApi.update(existing._id, f) : teamsApi.create(f)),
    onSuccess: () => { toast.success(isEdit ? 'Team updated' : 'Team created'); onSaved(); },
    onError: (e) => toast.error(e.message),
  });
  const submit = (e) => { e.preventDefault(); if (!f.name.trim()) return toast.error('Team name required'); mut.mutate(); };
  return (
    <form onSubmit={submit} className="space-y-3">
      <div><label className="label">Team Name</label><input className="input" value={f.name} onChange={set('name')} placeholder="Inbound Sales" /></div>
      <div><label className="label">Description</label><input className="input" value={f.description} onChange={set('description')} /></div>
      <div className="flex justify-end pt-2"><button className="btn-primary" disabled={mut.isPending}>{mut.isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}</button></div>
    </form>
  );
}

export default function OrganizationPage() {
  const [editing, setEditing] = useState(null);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ['teams'], queryFn: () => teamsApi.list({ limit: 50 }) });

  const delMut = useMutation({
    mutationFn: (id) => teamsApi.remove(id),
    onSuccess: () => { toast.success('Team deleted'); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['teams'] });
  const askDelete = async (t) => { if (await confirm({ title: 'Delete team?', message: `“${t.name}” will be permanently deleted.` })) delMut.mutate(t._id); };

  const columns = [
    { key: 'name', header: 'Team', render: (t) => <span className="font-medium text-gray-900">{t.name}</span> },
    { key: 'description', header: 'Description', render: (t) => t.description || '—' },
    { key: 'act', header: '', render: (t) => (
      <div className="flex gap-2">
        <button onClick={() => setEditing(t)} className="text-gray-400 hover:text-brand-600"><Pencil size={15} /></button>
        <button onClick={() => askDelete(t)} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
      </div>
    ) },
  ];

  return (
    <ServiceShell title="Organization — Sales Teams" showSearch={false} total={data?.meta?.total} onRefresh={refresh}
      actions={<button onClick={() => setEditing('new')} className="btn-primary"><Plus size={16} /> Add Team</button>}>
      <DataTable columns={columns} rows={data?.data || []} loading={isLoading} emptyLabel="No teams yet." />
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add Team' : 'Edit Team'}>
        {editing && <TeamForm existing={editing === 'new' ? null : editing} onSaved={() => { setEditing(null); refresh(); }} />}
      </Modal>
    </ServiceShell>
  );
}
