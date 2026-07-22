import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Building2, CreditCard, Landmark, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { orgProfileApi } from '../../api/orgProfile.js';
import Modal from '../../components/ui/Modal.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';

/* Organization Profile — the editable company details (Sembark-style).
   Everything saved here feeds documents like the Proforma Invoice (seller
   block + bank details), so updates apply without a code change. */

// Read an image file, downscale to maxW px wide, return a data URI — keeps
// org-profile documents small and lets PDFs inline the images directly.
const fileToDataUrl = (file, maxW = 1600) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });

// One brand-image slot: preview + Update/Add + Remove.
function ImageCard({ title, hint, value, onChange, maxW, tall }) {
  const inputRef = useRef(null);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) return toast.error('Please choose an image file');
    try { onChange(await fileToDataUrl(file, maxW)); } catch { toast.error('Could not read that image'); }
  };
  return (
    <div>
      <p className="font-bold text-gray-900">{title}</p>
      <p className="mb-2 text-xs text-gray-400">{hint}</p>
      {value ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <img src={value} alt={title} className={tall ? 'max-h-40 w-auto p-2' : 'w-full object-contain'} />
        </div>
      ) : null}
      <div className="mt-2 flex gap-2">
        <button onClick={() => inputRef.current?.click()} className="btn-secondary text-sm">{value ? 'Update Image' : 'Add Image'}</button>
        {value && <button onClick={() => onChange(null)} className="btn-ghost text-sm text-gray-500 hover:text-red-600">Remove</button>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
    </div>
  );
}

function AddressForm({ existing, withGstin, onSave, onClose }) {
  const [f, setF] = useState({
    label: existing?.label || '', address: existing?.address || '', phone: existing?.phone || '',
    email: existing?.email || '', gstin: existing?.gstin || '', primary: existing?.primary || false,
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  return (
    <div className="space-y-3">
      <div><label className="label">Label</label><input className="input" value={f.label} onChange={set('label')} placeholder="e.g. Registered Office" /></div>
      <div><label className="label">Address</label><textarea rows={3} className="input" value={f.address} onChange={set('address')} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Phone</label><input className="input" value={f.phone} onChange={set('phone')} /></div>
        <div><label className="label">Email</label><input className="input" value={f.email} onChange={set('email')} /></div>
      </div>
      {withGstin && <div><label className="label">GSTIN</label><input className="input" value={f.gstin} onChange={set('gstin')} /></div>}
      <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={f.primary} onChange={set('primary')} className="h-4 w-4 rounded border-gray-300 text-brand-600" /> Primary
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={() => { if (!f.address.trim()) return toast.error('Address is required'); onSave(f); }} className="btn-primary">Save</button>
      </div>
    </div>
  );
}

function BankForm({ existing, onSave, onClose }) {
  const [f, setF] = useState({
    holder: existing?.holder || '', bank: existing?.bank || '', branch: existing?.branch || '',
    ifsc: existing?.ifsc || '', accNo: existing?.accNo || '', currency: existing?.currency || 'INR',
  });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  return (
    <div className="space-y-3">
      <div><label className="label">A/c Holder Name</label><input className="input" value={f.holder} onChange={set('holder')} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label">Bank</label><input className="input" value={f.bank} onChange={set('bank')} placeholder="e.g. HDFC" /></div>
        <div><label className="label">Branch</label><input className="input" value={f.branch} onChange={set('branch')} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2"><label className="label">Account Number</label><input className="input" value={f.accNo} onChange={set('accNo')} /></div>
        <div><label className="label">Currency</label><input className="input" value={f.currency} onChange={set('currency')} /></div>
      </div>
      <div><label className="label">IFSC</label><input className="input" value={f.ifsc} onChange={set('ifsc')} /></div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={() => { if (!f.bank.trim() || !f.accNo.trim()) return toast.error('Bank and account number are required'); onSave(f); }} className="btn-primary">Save</button>
      </div>
    </div>
  );
}

function ListCard({ icon: Icon, title, hint, columns, rows, renderRow, onAdd, onEdit, onDelete, addLabel = 'Add New' }) {
  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold text-gray-900"><Icon size={16} className="text-brand-600" /> {title}</h3>
        <button onClick={onAdd} className="btn-ghost text-sm font-medium text-brand-600"><Plus size={14} /> {addLabel}</button>
      </div>
      <p className="mb-3 text-xs text-gray-400">{hint}</p>
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
            <tr>{columns.map((c) => <th key={c} className="px-4 py-2.5">{c}</th>)}<th className="w-20" /></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length ? rows.map((r, i) => (
              <tr key={r._id || i} className="align-top">
                {renderRow(r)}
                <td className="px-4 py-3 text-right">
                  <button onClick={() => onEdit(r, i)} className="mr-2 text-gray-400 hover:text-brand-600"><Pencil size={14} /></button>
                  <button onClick={() => onDelete(r, i)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={columns.length + 1} className="px-4 py-6 text-center text-gray-400">Nothing added yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function OrgProfilePage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: org, isLoading } = useQuery({ queryKey: ['org-profile'], queryFn: orgProfileApi.get });

  const [basic, setBasic] = useState(null); // editable basic block
  useEffect(() => {
    if (org && !basic) {
      setBasic({
        officialName: org.officialName || '', brandName: org.brandName || '',
        supportPhones: (org.supportPhones || []).join(', '), emails: (org.emails || []).join(', '),
        website: org.website || '', brandPrefixCode: org.brandPrefixCode || '',
        colorTheme: org.colorTheme || '#1e56d6', autoLockDays: org.autoLockDays || 0,
      });
    }
  }, [org, basic]);

  const [modal, setModal] = useState(null); // { kind: 'contact'|'billing'|'bank', item?, index? }

  const saveMut = useMutation({
    mutationFn: (patch) => orgProfileApi.update(patch),
    onSuccess: () => { toast.success('Organization profile saved'); qc.invalidateQueries({ queryKey: ['org-profile'] }); setModal(null); },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });

  if (isLoading || !org) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const saveBasic = () => saveMut.mutate({
    officialName: basic.officialName, brandName: basic.brandName,
    supportPhones: basic.supportPhones.split(',').map((s) => s.trim()).filter(Boolean),
    emails: basic.emails.split(',').map((s) => s.trim()).filter(Boolean),
    website: basic.website, brandPrefixCode: basic.brandPrefixCode,
    colorTheme: basic.colorTheme, autoLockDays: Number(basic.autoLockDays) || 0,
  });

  const saveImage = (key) => (dataUri) => saveMut.mutate({ images: { ...(org.images || {}), [key]: dataUri } });

  // Save an item into one of the three lists (primary flag stays unique).
  const saveListItem = (key, item, index) => {
    let list = [...(org[key] || [])].map((x) => ({ ...x }));
    if (item.primary) list = list.map((x) => ({ ...x, primary: false }));
    if (index != null) list[index] = { ...list[index], ...item };
    else list.push(item);
    saveMut.mutate({ [key]: list });
  };
  const deleteListItem = async (key, label, index) => {
    if (!(await confirm({ title: `Delete this ${label}?`, message: 'It will be removed from the organization profile.', confirmLabel: 'Delete' }))) return;
    saveMut.mutate({ [key]: (org[key] || []).filter((_, i) => i !== index) });
  };

  const setB = (k) => (e) => setBasic((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      <h1 className="text-xl font-bold text-gray-900">Organization Profile</h1>

      {/* Basic details */}
      <div className="card p-5">
        <h3 className="mb-3 flex items-center gap-2 font-bold text-gray-900"><Building2 size={16} className="text-brand-600" /> Profile</h3>
        {basic && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="label">Official/Registered Name</label><input className="input" value={basic.officialName} onChange={setB('officialName')} /></div>
              <div><label className="label">Display/Brand Name</label><input className="input" value={basic.brandName} onChange={setB('brandName')} /></div>
              <div><label className="label">Support Phone Numbers <span className="font-normal text-gray-400">(comma separated)</span></label><input className="input" value={basic.supportPhones} onChange={setB('supportPhones')} /></div>
              <div><label className="label">Emails <span className="font-normal text-gray-400">(comma separated)</span></label><input className="input" value={basic.emails} onChange={setB('emails')} /></div>
              <div><label className="label">Website</label><input className="input" value={basic.website} onChange={setB('website')} /></div>
              <div><label className="label">Brand Prefix Code <span className="font-normal text-gray-400">(used in document numbers)</span></label><input className="input" value={basic.brandPrefixCode} onChange={setB('brandPrefixCode')} placeholder="e.g. ATC" /></div>
              <div>
                <label className="label">Color Theme</label>
                <div className="flex items-center gap-2">
                  <input type="color" className="h-9 w-12 cursor-pointer rounded border border-gray-200" value={basic.colorTheme} onChange={setB('colorTheme')} />
                  <input className="input flex-1" value={basic.colorTheme} onChange={setB('colorTheme')} />
                </div>
              </div>
              <div><label className="label">Auto Lock Trip After Past Days <span className="font-normal text-gray-400">(0 = not active)</span></label><input type="number" min="0" className="input" value={basic.autoLockDays} onChange={setB('autoLockDays')} /></div>
            </div>
            <div className="mt-3 flex justify-end"><button onClick={saveBasic} disabled={saveMut.isPending} className="btn-primary">{saveMut.isPending ? 'Saving…' : 'Save Profile'}</button></div>
          </>
        )}
      </div>

      {/* Brand images */}
      <div className="card p-5">
        <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900"><ImageIcon size={16} className="text-brand-600" /> Brand Images</h3>
        <div className="grid gap-8 lg:grid-cols-2">
          <ImageCard title="Brand Logo" hint="Shown on generated documents e.g. Proforma Invoice." value={org.images?.logo} onChange={saveImage('logo')} maxW={600} tall />
          <div />
          <ImageCard title="Header Banner/Letterhead Image" hint="Image to be used as header banner in generated Branded PDFs e.g. Quote, Vouchers etc." value={org.images?.headerBanner} onChange={saveImage('headerBanner')} />
          <ImageCard title="Footer Banner Image" hint="Image to be used for footer in generated Branded PDFs e.g. Quote, Vouchers etc." value={org.images?.footerBanner} onChange={saveImage('footerBanner')} />
          <ImageCard title="Header Banner/Letterhead Image (Non-Branded)" hint="Used as the header when Hide Branding is enabled - ensure no logos or brand elements." value={org.images?.headerBannerPlain} onChange={saveImage('headerBannerPlain')} />
          <ImageCard title="Footer Banner Image (Non-Branded)" hint="Used as the footer when Hide Branding is enabled - ensure no logos or brand elements." value={org.images?.footerBannerPlain} onChange={saveImage('footerBannerPlain')} />
        </div>
      </div>

      <ListCard
        icon={Building2} title="Contact Addresses"
        hint="Here you can manage different addresses used for contact and support purposes."
        columns={['Label', 'Address', 'Contact']}
        rows={org.contactAddresses || []}
        renderRow={(r) => (
          <>
            <td className="px-4 py-3 font-medium text-gray-800">{r.label || '—'}{r.primary && <span className="ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">Primary</span>}</td>
            <td className="whitespace-pre-line px-4 py-3 italic text-gray-600">{r.address}</td>
            <td className="px-4 py-3 text-gray-500">{[r.phone, r.email].filter(Boolean).join(' · ') || '—'}</td>
          </>
        )}
        onAdd={() => setModal({ kind: 'contact' })}
        onEdit={(r, i) => setModal({ kind: 'contact', item: r, index: i })}
        onDelete={(_, i) => deleteListItem('contactAddresses', 'contact address', i)}
      />

      <ListCard
        icon={CreditCard} title="Billing Addresses"
        hint="Here you can manage different addresses used for billing purposes. The primary one is used as the seller block on proforma invoices."
        columns={['Label', 'Address', 'Contact', 'Billing Details']}
        rows={org.billingAddresses || []}
        renderRow={(r) => (
          <>
            <td className="px-4 py-3 font-medium text-gray-800">{r.label || '—'}{r.primary && <span className="ml-1.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">Primary</span>}</td>
            <td className="whitespace-pre-line px-4 py-3 italic text-gray-600">{r.address}</td>
            <td className="px-4 py-3 text-gray-500">{[r.phone, r.email].filter(Boolean).join(' · ') || '—'}</td>
            <td className="px-4 py-3 text-gray-600">{r.gstin ? `GSTIN: ${r.gstin}` : '—'}</td>
          </>
        )}
        onAdd={() => setModal({ kind: 'billing' })}
        onEdit={(r, i) => setModal({ kind: 'billing', item: r, index: i })}
        onDelete={(_, i) => deleteListItem('billingAddresses', 'billing address', i)}
      />

      <ListCard
        icon={Landmark} title="Bank Account Details" addLabel="Add More"
        hint="Bank account details to be shared with your client in payments related communications."
        columns={['Name', 'Bank / Branch', 'Account Number', 'IFSC']}
        rows={org.bankAccounts || []}
        renderRow={(r) => (
          <>
            <td className="px-4 py-3 font-medium text-gray-800">{r.holder || '—'}<span className="ml-1.5 rounded border border-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">{r.currency || 'INR'}</span></td>
            <td className="px-4 py-3 text-gray-600"><b>{r.bank}</b>{r.branch ? <span className="block text-xs text-gray-400">{r.branch}</span> : null}</td>
            <td className="px-4 py-3 text-gray-600">{r.accNo}</td>
            <td className="px-4 py-3 text-gray-600">{r.ifsc || '—'}</td>
          </>
        )}
        onAdd={() => setModal({ kind: 'bank' })}
        onEdit={(r, i) => setModal({ kind: 'bank', item: r, index: i })}
        onDelete={(_, i) => deleteListItem('bankAccounts', 'bank account', i)}
      />

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal ? `${modal.index != null ? 'Edit' : 'Add'} ${modal.kind === 'bank' ? 'Bank Account' : modal.kind === 'billing' ? 'Billing Address' : 'Contact Address'}` : ''}>
        {modal?.kind === 'bank' ? (
          <BankForm existing={modal.item} onClose={() => setModal(null)} onSave={(f) => saveListItem('bankAccounts', f, modal.index)} />
        ) : modal ? (
          <AddressForm existing={modal.item} withGstin={modal.kind === 'billing'} onClose={() => setModal(null)} onSave={(f) => saveListItem(modal.kind === 'billing' ? 'billingAddresses' : 'contactAddresses', f, modal.index)} />
        ) : null}
      </Modal>
    </div>
  );
}
