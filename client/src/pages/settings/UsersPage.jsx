import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, UserCheck, UserX } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from '../../api/settings.js';
import { useDebounced } from '../../hooks/useDebounced.js';
import { useAuth } from '../../store/AuthContext.jsx';
import ServiceShell from '../../components/services/ServiceShell.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { cn } from '../../lib/cn.js';
import { PERMISSION_MODULES, ACTION_LABELS, roleDefaultGranted } from '../../lib/permissions.js';

const ROLES = ['admin', 'manager', 'sales', 'operations', 'accounts'];
const ROLE_BADGE = {
  admin: 'bg-purple-50 text-purple-700', manager: 'bg-blue-50 text-blue-700',
  sales: 'bg-green-50 text-green-700', operations: 'bg-amber-50 text-amber-700', accounts: 'bg-cyan-50 text-cyan-700',
};

function UserForm({ existing, onSaved }) {
  const isEdit = !!existing;
  const [f, setF] = useState({
    name: existing?.name || '', email: existing?.email || '', phone: existing?.phone || '',
    role: existing?.role || 'sales', password: '',
  });
  // Sparse map of explicit per-user overrides (only deviations from the role default).
  const [overrides, setOverrides] = useState(() => ({ ...(existing?.permissionOverrides || {}) }));
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target?.value ?? e }));

  const effective = (key) =>
    overrides[key] !== undefined ? overrides[key] : roleDefaultGranted(f.role, key);
  const togglePerm = (key) => setOverrides((o) => {
    const next = { ...o };
    const cur = next[key] !== undefined ? next[key] : roleDefaultGranted(f.role, key);
    const val = !cur;
    if (val === roleDefaultGranted(f.role, key)) delete next[key];
    else next[key] = val;
    return next;
  });

  const mut = useMutation({
    mutationFn: () => {
      const payload = { name: f.name, phone: f.phone, role: f.role, permissionOverrides: overrides };
      if (f.password) payload.password = f.password;
      if (isEdit) return usersApi.update(existing._id, payload);
      return usersApi.create({ ...payload, email: f.email, password: f.password });
    },
    onSuccess: () => { toast.success(isEdit ? 'User updated' : 'User created'); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return toast.error('Name required');
    if (!isEdit && (!f.email.trim() || !f.password)) return toast.error('Email and password required');
    mut.mutate();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Name</label><input className="input" value={f.name} onChange={set('name')} /></div>
        <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={set('phone')} /></div>
      </div>
      <div><label className="label">Email</label><input type="email" className="input" value={f.email} onChange={set('email')} disabled={isEdit} /></div>
      <div><label className="label">Role</label><select className="input" value={f.role} onChange={set('role')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
      <div><label className="label">{isEdit ? 'Reset Password (optional)' : 'Password'}</label><input type="password" className="input" value={f.password} onChange={set('password')} placeholder={isEdit ? 'Leave blank to keep' : ''} /></div>

      <div className="pt-1">
        <div className="mb-1 flex items-center justify-between">
          <label className="label mb-0">Permissions</label>
          {Object.keys(overrides).length > 0 && (
            <button type="button" onClick={() => setOverrides({})} className="text-xs font-medium text-brand-600 hover:underline">Reset to role defaults</button>
          )}
        </div>
        <p className="mb-2 text-xs text-slate-400">Unchecked = blocked for this user. Defaults follow the selected role; changes are saved as per-user overrides.</p>
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
          {PERMISSION_MODULES.map((m) => (
            <div key={m.key} className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="mb-1.5 text-xs font-semibold text-slate-600">{m.label}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {m.actions.map((a) => {
                  const key = `${m.key}.${a}`;
                  const checked = effective(key);
                  const overridden = overrides[key] !== undefined;
                  return (
                    <label key={key} className="flex cursor-pointer items-center gap-1.5 text-[13px]">
                      <input type="checkbox" checked={checked} onChange={() => togglePerm(key)} className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                      <span className={cn(!checked && 'text-slate-400 line-through', overridden && 'font-semibold text-brand-700')}>{ACTION_LABELS[a]}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2"><button className="btn-primary" disabled={mut.isPending}>{mut.isPending ? 'Saving…' : isEdit ? 'Update User' : 'Create User'}</button></div>
    </form>
  );
}

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // user | 'new' | null
  const debounced = useDebounced(search);
  const qc = useQueryClient();
  const { can } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['users', debounced],
    queryFn: () => usersApi.list({ search: debounced, limit: 50 }),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, isActive }) => usersApi.setStatus(id, isActive),
    onSuccess: () => { toast.success('Updated'); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });

  const columns = [
    { key: 'name', header: 'Name', render: (u) => (
      <div><div className="font-medium text-gray-900">{u.name}</div><div className="text-xs text-gray-400">{u.email}</div></div>
    ) },
    { key: 'role', header: 'Role', render: (u) => <span className={cn('rounded px-2 py-0.5 text-xs font-medium capitalize', ROLE_BADGE[u.role])}>{u.role}</span> },
    { key: 'team', header: 'Team', render: (u) => u.team?.name || '—' },
    { key: 'phone', header: 'Phone', render: (u) => u.phone || '—' },
    { key: 'status', header: 'Status', render: (u) => (
      <span className={cn('rounded px-2 py-0.5 text-xs', u.isActive === false ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700')}>
        {u.isActive === false ? 'Disabled' : 'Active'}
      </span>
    ) },
    { key: 'act', header: '', render: (u) => (
      <div className="flex gap-2">
        {can('users.edit') && <button onClick={() => setEditing(u)} className="text-gray-400 hover:text-brand-600" title="Edit"><Pencil size={15} /></button>}
        <button onClick={() => statusMut.mutate({ id: u._id, isActive: u.isActive === false })} className="text-gray-400 hover:text-gray-700" title={u.isActive === false ? 'Enable' : 'Disable'}>
          {u.isActive === false ? <UserCheck size={15} /> : <UserX size={15} />}
        </button>
      </div>
    ) },
  ];

  return (
    <ServiceShell title="Users & Teams" search={search} onSearch={setSearch} total={data?.meta?.total} onRefresh={refresh}
      actions={can('users.create') && <button onClick={() => setEditing('new')} className="btn-primary"><Plus size={16} /> Add User</button>}>
      <DataTable columns={columns} rows={data?.data || []} loading={isLoading} emptyLabel="No users found." />
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add User' : 'Edit User'} width="max-w-2xl">
        {editing && <UserForm existing={editing === 'new' ? null : editing} onSaved={() => { setEditing(null); refresh(); }} />}
      </Modal>
    </ServiceShell>
  );
}
