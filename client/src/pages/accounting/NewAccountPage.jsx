import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, Building2, User, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import { accountsApi } from '../../api/accounts.js';
import { cn } from '../../lib/cn.js';

const ENTITY_TYPES = [
  { kind: 'company', icon: Building2, title: 'Company Account', desc: 'Create company account to manage the company wide transactions or restricted transactions.' },
  { kind: 'employee', icon: User, title: 'Employee / User Account', desc: 'Create employee/user account to hold the user specific accounting e.g. salary accounts, team lead accounts etc.' },
  { kind: 'third_party', icon: Briefcase, title: 'Third Party Account', desc: 'Create accounts for third parties e.g. Travel Expense, ISP etc. to manage expenses and other transactions.' },
];

export default function NewAccountPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState('company');
  const [form, setForm] = useState({ name: '', tags: '', phone: '', openingBalance: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const mut = useMutation({
    mutationFn: () => accountsApi.create({
      name: form.name.trim(),
      kind,
      tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      phone: form.phone || undefined,
      openingBalance: form.openingBalance !== '' ? Number(form.openingBalance) : 0,
    }),
    onSuccess: () => { toast.success('Account created'); navigate('/accounting/accounts'); },
    onError: (e) => toast.error(e.message),
  });

  const save = () => {
    if (!form.name.trim()) return toast.error('Account name is required');
    mut.mutate();
  };

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-6 py-3 text-sm">
        <button onClick={() => navigate('/accounting/accounts')} className="text-slate-600 hover:text-slate-900"><ArrowLeft size={18} /></button>
        <span className="font-semibold text-slate-900">New Account</span>
        <span className="text-slate-400">/</span>
        <Link to="/accounting/accounts" className="text-slate-500 hover:text-slate-800">Accounting Accounts</Link>
        <span className="text-slate-400">/</span>
        <span className="text-slate-500">New</span>
      </div>

      <div className="px-6 py-8">
        <div className="card p-6">
          {step === 1 ? (
            <>
              <h2 className="text-lg font-bold text-slate-900">Account Association</h2>
              <p className="mt-1 text-sm text-brand-600">Please select the entity type to attach the account.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {ENTITY_TYPES.map((t) => (
                  <button key={t.kind} onClick={() => setKind(t.kind)} className={cn('rounded-xl border p-4 text-left transition', kind === t.kind ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-200 hover:border-slate-300')}>
                    <div className="flex items-center gap-2">
                      <input type="radio" checked={kind === t.kind} readOnly />
                      <t.icon size={16} className="text-slate-500" />
                      <span className="font-semibold text-slate-800">{t.title}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{t.desc}</p>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button onClick={() => navigate('/accounting/accounts')} className="btn-secondary">Cancel</button>
                <button onClick={() => setStep(2)} className="btn-primary">Next: Add Account Details <ChevronRight size={15} /></button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-slate-900">Account Details</h2>
              <p className="mt-1 text-sm text-slate-500">Entity type: <b className="capitalize">{kind.replace('_', ' ')}</b></p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div><label className="label">Account Name</label><input className="input" value={form.name} onChange={set('name')} placeholder="e.g. Travel Expense" autoFocus /></div>
                <div><label className="label">Phone <span className="label-optional">(optional)</span></label><input className="input" value={form.phone} onChange={set('phone')} placeholder="+91…" /></div>
                <div><label className="label">Tags <span className="label-optional">(comma separated)</span></label><input className="input" value={form.tags} onChange={set('tags')} placeholder="Guest, Vendor" /></div>
                <div><label className="label">Opening Balance <span className="label-optional">(optional)</span></label><input type="number" className="input" value={form.openingBalance} onChange={set('openingBalance')} placeholder="0" /></div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <button onClick={() => setStep(1)} className="btn-secondary"><ArrowLeft size={15} /> Back</button>
                <button onClick={save} disabled={mut.isPending} className="btn-primary">{mut.isPending ? 'Saving…' : 'Create Account'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
