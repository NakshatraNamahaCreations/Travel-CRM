import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, FileText, Info, RefreshCw } from 'lucide-react';
import { queriesApi } from '../../api/queries.js';
import { quotesApi } from '../../api/quotes.js';
import { proformaApi } from '../../api/proforma.js';
import { orgProfileApi } from '../../api/orgProfile.js';
import { serviceBookingsApi } from '../../api/serviceBookings.js';
import { installmentsApi } from '../../api/installments.js';
import { company } from '../../config/company.js';
import { tripNo } from '../../lib/format.js';
import { cn } from '../../lib/cn.js';
import { useConfirm } from '../ui/ConfirmProvider.jsx';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const inr2 = (n) => `INR ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dt = (d) => (d ? format(new Date(d), 'd MMM, yyyy') : '—');

/* Indian-system number → words — mirrors the server's PDF helper. */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`);
const three = (n) => `${Math.floor(n / 100) ? `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' : ''}` : ''}${n % 100 ? two(n % 100) : ''}`;
function amountInWords(num) {
  let n = Math.floor(Math.abs(Number(num) || 0));
  if (!n) return 'Zero Only';
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${two(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (n) parts.push(three(n));
  return `${parts.join(' ')} Only`;
}

/* ---------------------------- Proforma Invoice ---------------------------- */

// "IDBI - **8013 - INR" style label for a bank account row.
const bankLabel = (b) => [b.bank, b.accNo?.length > 4 ? `**${b.accNo.slice(-4)}` : b.accNo, b.currency || 'INR'].filter(Boolean).join(' - ');

export function ProformaSection({ queryId }) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data: q } = useQuery({ queryKey: ['query', queryId], queryFn: () => queriesApi.get(queryId) });
  const { data: org } = useQuery({ queryKey: ['org-profile'], queryFn: orgProfileApi.get });
  const { data: quotes = [] } = useQuery({ queryKey: ['quotes', queryId], queryFn: () => quotesApi.listForQuery(queryId) });
  const { data: invoices = [], isLoading } = useQuery({ queryKey: ['proforma', queryId], queryFn: () => proformaApi.list(queryId) });
  const [editing, setEditing] = useState(null); // 'new' | invoice doc | null

  const refresh = () => qc.invalidateQueries({ queryKey: ['proforma', queryId] });

  const saveMut = useMutation({
    mutationFn: (payload) => (payload._id ? proformaApi.update(payload._id, payload) : proformaApi.create({ ...payload, query: queryId })),
    onSuccess: () => { toast.success('Proforma invoice saved'); setEditing(null); refresh(); },
    onError: (e) => toast.error(e.response?.data?.message || e.message),
  });
  const delMut = useMutation({
    mutationFn: (id) => proformaApi.remove(id),
    onSuccess: () => { toast.success('Deleted'); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const askDelete = async (inv) => {
    if (await confirm({ title: 'Delete this proforma invoice?', message: `Invoice #${inv.invoiceNumber} will be permanently removed.`, confirmLabel: 'Delete' })) delMut.mutate(inv._id);
  };

  const openPdf = async (inv) => {
    const t = toast.loading('Preparing PDF…');
    try {
      const blob = await proformaApi.pdf(inv._id);
      window.open(URL.createObjectURL(blob), '_blank');
    } catch {
      toast.error('Could not generate the PDF');
    } finally {
      toast.dismiss(t);
    }
  };

  // Fresh-invoice defaults from the trip + accepted quote + org profile
  // (primary billing address = seller block; first bank account preselected).
  const defaults = useMemo(() => {
    const accepted = quotes.find((x) => x.status === 'accepted') || quotes[0];
    const total = accepted?.pricing?.total || 0;
    const guestName = [q?.guest?.salutation, q?.guest?.name].filter(Boolean).join(' ') || 'Guest';
    const dests = (q?.destinations || []).map((d) => d.name).join(', ') || 'Tour';
    const meta = [
      q?.startDate ? format(new Date(q.startDate), 'd MMM yyyy') : 'Flexible',
      `${q?.nights || 0}N,${(q?.nights || 0) + 1}D`,
      `${q?.pax?.adults || 0}A${q?.pax?.children?.length ? `, ${q.pax.children.length}C` : ''}`,
    ].join(' - ');
    const billing = (org?.billingAddresses || []).find((b) => b.primary) || (org?.billingAddresses || [])[0];
    const bank0 = (org?.bankAccounts || [])[0];
    return {
      seller: {
        name: org?.officialName || company.name,
        address: billing?.address || (company.address || []).join('\n'),
        phone: billing?.phone || org?.supportPhones?.[0] || company.phones?.[0] || '',
        email: billing?.email || org?.emails?.[0] || company.emails?.[0] || '',
        gstin: billing?.gstin || company.gstin || '',
      },
      buyer: { name: guestName, address: '' },
      placeOfSupply: '',
      bankAccount: bank0 ? bankLabel(bank0) : '',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      overview: '',
      hideTaxBreakup: true,
      items: [{ particular: `Trip#: ${tripNo(q?.queryNumber)}\n${dests} Tour Package\n${guestName} - ${meta}`, qty: 1, amount: total, hsn: '' }],
      specialNotes: '',
      terms: '',
    };
  }, [q, quotes, org]);

  if (editing) {
    return (
      <ProformaForm
        initial={editing === 'new' ? defaults : editing}
        org={org}
        pending={saveMut.isPending}
        onCancel={() => setEditing(null)}
        onSave={(payload) => saveMut.mutate(editing === 'new' ? payload : { ...payload, _id: editing._id })}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Proforma Invoice</h3>
        {invoices.length > 0 && (
          <button onClick={() => setEditing('new')} className="btn-ghost text-sm font-medium text-gray-600 hover:text-brand-700"><Plus size={15} /> New</button>
        )}
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-gray-400">Loading…</div>
      ) : !invoices.length ? (
        <div className="card flex flex-col items-center gap-4 p-14 text-center">
          <p className="text-lg font-medium text-gray-700">No Proforma Invoice created for this Trip!</p>
          <button onClick={() => setEditing('new')} className="btn-secondary">Create Proforma Invoice</button>
        </div>
      ) : (
        <div className="space-y-6">
          {invoices.map((inv) => (
            <div key={inv._id} className="card card-flush overflow-hidden">
              <div className="flex flex-wrap items-center gap-6 border-b border-gray-100 bg-gray-50 px-5 py-3">
                <div><p className="text-xs text-gray-400">Created By</p><p className="text-sm font-semibold text-gray-800">{inv.createdBy?.name || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Created On</p><p className="text-sm font-semibold text-gray-800">{dt(inv.createdAt)}</p></div>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={refresh} title="Refresh" className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:text-gray-800"><RefreshCw size={14} /></button>
                  <button onClick={() => openPdf(inv)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"><FileText size={14} /> PDF</button>
                  <button onClick={() => setEditing(inv)} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-100"><Pencil size={13} /> Edit</button>
                  <button onClick={() => askDelete(inv)} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="flex justify-center bg-gray-100/60 p-6">
                <InvoicePreview inv={inv} queryNumber={q?.queryNumber} org={org} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* The rendered invoice document — mirrors the server PDF layout. */
function InvoicePreview({ inv, queryNumber, org }) {
  // Bank block: invoice snapshot first (chosen from the org profile at save
  // time), static config as the legacy fallback.
  const bank = inv.bank && (inv.bank.accNo || inv.bank.bank)
    ? { ...inv.bank, address: inv.bank.branch }
    : (company.bank || {});
  const seller = inv.seller || {};
  const buyer = inv.buyer || {};
  return (
    <div className="w-full max-w-3xl bg-white p-8 text-[13px] text-slate-900 shadow-sm">
      <div className="bg-brand-600 py-2 text-center text-sm font-extrabold uppercase tracking-widest text-white">Proforma Invoice</div>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          {org?.images?.logo ? (
            <img src={org.images.logo} alt="logo" className="h-12 max-w-[200px] object-contain" />
          ) : (
            <>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-xl font-extrabold text-white">{(seller.name || company.name || 'T').charAt(0)}</div>
              <p className="text-base font-extrabold text-brand-800">{seller.name || company.name}</p>
            </>
          )}
        </div>
        <div className="flex gap-6 text-right">
          <div><p className="text-[11px] text-gray-400">Issue Date</p><p className="font-bold">{dt(inv.createdAt)}</p></div>
          <div><p className="text-[11px] text-gray-400">Due Date</p><p className="font-bold">{dt(inv.dueDate || inv.createdAt)}</p></div>
          <div><p className="text-[11px] text-gray-400">Trip ID</p><p className="font-bold">{queryNumber ?? inv.query?.queryNumber ?? '—'}</p></div>
        </div>
      </div>
      <div className="mt-4 flex justify-between gap-8">
        <div>
          <p className="text-[10.5px] font-bold tracking-widest text-gray-400">SELLER</p>
          <p className="text-[15px] font-extrabold text-brand-800">{seller.name || company.name}</p>
          <p className="whitespace-pre-line italic text-slate-700">{seller.address}</p>
          <p>{seller.phone} • {seller.email}</p>
          {seller.gstin && <p className="text-gray-500">GSTIN: {seller.gstin}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10.5px] font-bold tracking-widest text-gray-400">BUYER (BILL TO)</p>
          <p className="text-[15px] font-extrabold text-brand-800">{buyer.name || 'Guest'}</p>
          <p className="whitespace-pre-line text-gray-500">{buyer.address || 'N/A'}</p>
        </div>
      </div>
      <hr className="my-4 border-brand-900/30" />
      {inv.overview && <p className="mb-2">{inv.overview}</p>}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border border-blue-200 bg-blue-100 px-2.5 py-1.5 text-left text-[11.5px] tracking-wider">S.NO.</th>
            <th className="border border-blue-200 bg-blue-100 px-2.5 py-1.5 text-left text-[11.5px] tracking-wider">PARTICULARS</th>
            <th className="border border-blue-200 bg-blue-100 px-2.5 py-1.5 text-right text-[11.5px] tracking-wider">AMOUNT ({inv.currency || 'INR'})</th>
          </tr>
        </thead>
        <tbody>
          {(inv.items || []).map((it, i) => (
            <tr key={i}>
              <td className="w-12 border border-slate-200 px-2.5 py-2 align-top">{i + 1}.</td>
              <td className="border border-slate-200 px-2.5 py-2 align-top">
                <span className="whitespace-pre-line">{it.particular}</span>
                {it.hsn && <p className="mt-0.5 text-[11px] text-gray-400">HSN/SAC: {it.hsn}</p>}
              </td>
              <td className="border border-slate-200 px-2.5 py-2 text-right align-top">{inr2(it.total ?? (it.qty || 1) * (it.amount || 0))}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} className="border border-slate-200 px-2.5 py-1.5 text-right font-extrabold">Total ({inv.currency || 'INR'})</td>
            <td className="border border-slate-200 px-2.5 py-1.5 text-right font-extrabold">{inr2(inv.total)}</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-[10.5px] font-bold tracking-widest text-gray-400">AMOUNT CHARGEABLE (IN WORDS)</p>
          <p className="font-extrabold">{inv.currency || 'INR'}: {amountInWords(inv.total)}</p>
        </div>
        <p className="text-[11.5px] text-gray-400">E. &amp; O.E.</p>
      </div>
      <hr className="my-4 border-brand-900/30" />
      <div className="pl-4">
        <p className="mb-1 text-[10.5px] font-bold tracking-widest text-gray-500">SELLER'S BANK DETAILS</p>
        {inv.bankAccount && <p><b>Account:</b> {inv.bankAccount}</p>}
        <p>Bank Name: {bank.bank}</p>
        <p>A/c Holder Name: {bank.holder}</p>
        <p>A/c No. {bank.accNo}</p>
        <p>IFSC: {bank.ifsc}</p>
        {bank.address && <p>Branch: {bank.address}</p>}
      </div>
      {inv.specialNotes && <div className="mt-3"><p className="text-[10.5px] font-bold tracking-widest text-gray-500">SPECIAL NOTES</p><p className="whitespace-pre-line text-slate-700">{inv.specialNotes}</p></div>}
      {inv.terms && <div className="mt-3"><p className="text-[10.5px] font-bold tracking-widest text-gray-500">TERMS AND CONDITIONS</p><p className="whitespace-pre-line text-slate-700">{inv.terms}</p></div>}
      <p className="mt-8 text-center text-gray-400">This is a computer generated document. No signature required.</p>
    </div>
  );
}

function ProformaForm({ initial, org, pending, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({
    ...initial,
    dueDate: initial.dueDate ? format(new Date(initial.dueDate), 'yyyy-MM-dd') : '',
    items: (initial.items || []).map((it) => ({ ...it })),
  }));
  const [confirmed, setConfirmed] = useState(false);
  const [editSeller, setEditSeller] = useState(false);
  // Bank options from the org profile (editable in Settings → Organization Profile).
  const bankOptions = (org?.bankAccounts || []).map((b) => ({ label: bankLabel(b), acc: b }));
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setItem = (i, patch) => set({ items: form.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const addItem = () => set({ items: [...form.items, { particular: '', qty: 1, amount: 0, hsn: '' }] });
  const rmItem = (i) => set({ items: form.items.filter((_, idx) => idx !== i) });
  const total = form.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.amount) || 0), 0);

  const submit = () => {
    if (!form.items.length) return toast.error('Add at least one particular');
    // Snapshot the chosen bank account's details into the invoice so later
    // org-profile edits don't rewrite old invoices.
    const acc = bankOptions.find((o) => o.label === form.bankAccount)?.acc;
    onSave({
      seller: form.seller,
      buyer: form.buyer,
      placeOfSupply: form.placeOfSupply,
      bankAccount: form.bankAccount,
      bank: acc ? { holder: acc.holder, bank: acc.bank, branch: acc.branch, ifsc: acc.ifsc, accNo: acc.accNo } : initial.bank,
      dueDate: form.dueDate || undefined,
      overview: form.overview,
      hideTaxBreakup: form.hideTaxBreakup,
      items: form.items.map((it) => ({ particular: it.particular, qty: Number(it.qty) || 1, amount: Number(it.amount) || 0, hsn: it.hsn })),
      specialNotes: form.specialNotes,
      terms: form.terms,
    });
  };

  return (
    <div className="space-y-5">
      <h3 className="font-semibold text-gray-900">{initial._id ? 'Edit Proforma Invoice' : 'Create New Proforma Invoice'}</h3>

      <div className="card p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Invoice Options</p>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
          <input type="checkbox" checked={!!form.hideTaxBreakup} onChange={(e) => set({ hideTaxBreakup: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
          Hide Tax Breakup
        </label>
      </div>

      <div className="card grid gap-6 p-5 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-sm font-bold text-gray-800">
            Seller Billing/Address Details
            <button type="button" onClick={() => setEditSeller((v) => !v)} title="Edit seller details for this invoice" className="text-gray-400 hover:text-brand-600"><Pencil size={13} /></button>
          </p>
          {editSeller ? (
            <div className="space-y-2">
              <div><label className="label">Name</label><input className="input" value={form.seller?.name || ''} onChange={(e) => set({ seller: { ...form.seller, name: e.target.value } })} /></div>
              <div><label className="label">Address</label><textarea rows={3} className="input" value={form.seller?.address || ''} onChange={(e) => set({ seller: { ...form.seller, address: e.target.value } })} /></div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><label className="label">Phone</label><input className="input" value={form.seller?.phone || ''} onChange={(e) => set({ seller: { ...form.seller, phone: e.target.value } })} /></div>
                <div><label className="label">Email</label><input className="input" value={form.seller?.email || ''} onChange={(e) => set({ seller: { ...form.seller, email: e.target.value } })} /></div>
              </div>
              <div><label className="label">GSTIN</label><input className="input" value={form.seller?.gstin || ''} onChange={(e) => set({ seller: { ...form.seller, gstin: e.target.value } })} /></div>
              <p className="text-xs text-gray-400">Defaults come from Settings → Organization Profile; edits here apply to this invoice only.</p>
            </div>
          ) : (
            <>
              <p className="font-semibold text-gray-800">{form.seller?.name}</p>
              <p className="whitespace-pre-line text-sm italic text-gray-600">{form.seller?.address}</p>
              <p className="mt-1 text-sm text-gray-600">{form.seller?.phone} · {form.seller?.email}</p>
              <p className="text-xs text-gray-400">GSTIN: {form.seller?.gstin}</p>
            </>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-sm font-bold text-gray-800">Buyer Billing/Address Details</p>
          <label className="label">Name</label>
          <input className="input" value={form.buyer?.name || ''} onChange={(e) => set({ buyer: { ...form.buyer, name: e.target.value } })} />
          <label className="label mt-2">Address (optional)</label>
          <textarea rows={2} className="input" value={form.buyer?.address || ''} onChange={(e) => set({ buyer: { ...form.buyer, address: e.target.value } })} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div><label className="label">Place of Supply</label><input className="input" placeholder="Type to search…" value={form.placeOfSupply || ''} onChange={(e) => set({ placeOfSupply: e.target.value })} /></div>
        <div>
          <label className="label">Bank Account <span className="font-normal text-gray-400">(optional)</span></label>
          <select className="input" value={form.bankAccount || ''} onChange={(e) => set({ bankAccount: e.target.value })}>
            <option value="">— None —</option>
            {bankOptions.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
            {form.bankAccount && !bankOptions.some((o) => o.label === form.bankAccount) && <option value={form.bankAccount}>{form.bankAccount}</option>}
          </select>
        </div>
        <div><label className="label">Due Date</label><input type="date" className="input" value={form.dueDate || ''} onChange={(e) => set({ dueDate: e.target.value })} /></div>
      </div>

      <div>
        <label className="label">Overview</label>
        <textarea rows={3} className="input" placeholder="eg. Darjeeling Tour Package - 27 Oct 2025 - 6N, 7D - 2A, 3 Children (10y, 9y, 8y)" value={form.overview || ''} onChange={(e) => set({ overview: e.target.value })} />
      </div>

      <div>
        <p className="mb-2 font-semibold text-gray-900">Particulars</p>
        <div className="card card-flush overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
              <tr><th className="px-4 py-2.5 w-10">#</th><th className="px-4 py-2.5">Particular</th><th className="px-4 py-2.5 w-24">Qty</th><th className="px-4 py-2.5 w-36">Amount (INR)</th><th className="px-4 py-2.5 w-40 text-right">Total (INR)</th><th className="w-10" /></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {form.items.map((it, i) => (
                <tr key={i} className="align-top">
                  <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3">
                    <textarea rows={3} className="input" value={it.particular} onChange={(e) => setItem(i, { particular: e.target.value })} />
                    <div className="mt-1.5 flex items-center justify-end gap-2">
                      <span className="text-xs font-medium text-gray-400">HSN/SAC</span>
                      <input className="input w-36" placeholder="e.g. 998555" value={it.hsn || ''} onChange={(e) => setItem(i, { hsn: e.target.value })} />
                    </div>
                  </td>
                  <td className="px-4 py-3"><input type="number" min="1" className="input" value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} /></td>
                  <td className="px-4 py-3"><input type="number" className="input" value={it.amount} onChange={(e) => setItem(i, { amount: e.target.value })} /></td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{((Number(it.qty) || 0) * (Number(it.amount) || 0)).toLocaleString('en-IN')}</td>
                  <td className="px-2 py-3"><button onClick={() => rmItem(i)} className="text-gray-300 hover:text-red-500">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex justify-end"><button onClick={addItem} className="btn-secondary text-sm"><Plus size={13} /> Add Item</button></div>
        <div className="mt-2 rounded-lg bg-blue-50 px-4 py-3 text-right text-sm font-bold text-gray-900">
          Total: <span className="text-[11px] font-semibold text-gray-400">INR</span> <span className="text-lg">{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label">Special Notes <span className="font-normal text-gray-400">(optional)</span></label><textarea rows={3} className="input" placeholder="Any special notes here" value={form.specialNotes || ''} onChange={(e) => set({ specialNotes: e.target.value })} /></div>
        <div><label className="label">Terms and Conditions</label><textarea rows={3} className="input" placeholder="Type here…" value={form.terms || ''} onChange={(e) => set({ terms: e.target.value })} /></div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-gray-800">Please cross check all the details and correct it if something is not as per rules and regulations.</p>
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
          I confirm that all the details of this proforma invoice are correct
        </label>
      </div>

      <div className="flex gap-2">
        <button onClick={submit} disabled={!confirmed || pending} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Saving…' : 'Save Details'}</button>
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </div>
  );
}

/* ------------------------------ Profit Report ----------------------------- */

export function ProfitSection({ queryId, onGoToPayments }) {
  const { data: quotes = [] } = useQuery({ queryKey: ['quotes', queryId], queryFn: () => quotesApi.listForQuery(queryId) });
  const { data: sbs = [] } = useQuery({ queryKey: ['service-bookings', queryId], queryFn: () => serviceBookingsApi.list(queryId) });
  const { data: instData } = useQuery({ queryKey: ['inst-all', queryId], queryFn: () => installmentsApi.list({ query: queryId }) });
  const [showIncomplete, setShowIncomplete] = useState(false);

  const accepted = quotes.find((x) => x.status === 'accepted') || quotes[0];
  const packageAmount = accepted?.pricing?.total || 0;
  const tax = accepted?.pricing?.tax || 0;

  const active = sbs.filter((s) => s.status !== 'cancelled');
  const pending = active.filter((s) => s.status === 'initialized');
  const bookedCost = active.filter((s) => ['booked', 'confirmed'].includes(s.status)).reduce((s2, x) => s2 + (x.price || 0), 0);
  const complete = active.length > 0 && pending.length === 0;
  const showNumbers = complete || showIncomplete;

  const profit = showNumbers ? packageAmount - tax - bookedCost : 0;
  const profitPct = showNumbers && packageAmount ? (profit / packageAmount) * 100 : 0;

  const transactions = (instData?.data || []).filter((r) => r.paid);

  const Tile = ({ label, children, sub }) => (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <div className="mt-1 text-2xl font-bold text-gray-900">{children}</div>
      {sub}
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Summary</h3>
        <button onClick={onGoToPayments} className="btn-secondary text-sm"><Plus size={14} /> Log Payment</button>
      </div>

      <div className="card grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Package Amount"><span className="mr-1 text-[11px] font-semibold text-gray-400">INR</span>{packageAmount.toLocaleString('en-IN')}</Tile>
        <Tile
          label="Bookings"
          sub={!complete && <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">⚠ Some bookings are still pending.</p>}
        >
          {showNumbers ? <><span className="mr-1 text-[11px] font-semibold text-gray-400">INR</span>{bookedCost.toLocaleString('en-IN')}</> : 'N/A'}
        </Tile>
        <Tile label={`Estm. Tax (${accepted?.taxPercent ?? 5}%)`}><span className="mr-1 text-[11px] font-semibold text-gray-400">INR</span>{tax.toLocaleString('en-IN')}</Tile>
        <Tile label="Estm. Profit"><span className="mr-1 text-[11px] font-semibold text-gray-400">INR</span><span className={cn(showNumbers && profit < 0 && 'text-red-600')}>{profit.toLocaleString('en-IN')}</span></Tile>
        <Tile label="Estm. Profit %"><span className={cn(showNumbers && profit < 0 && 'text-red-600')}>{profitPct.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span><span className="text-xs text-gray-400">%</span></Tile>
      </div>

      <h3 className="mb-2 mt-7 font-semibold text-gray-900">Profit Report</h3>
      {pending.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-gray-800">⚠ There are pending bookings ({pending.length} not booked) for this Trip.</p>
          <button onClick={() => setShowIncomplete((v) => !v)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            {showIncomplete ? 'Hide Incomplete Report' : 'Show Incomplete Report'}
          </button>
        </div>
      ) : !active.length ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">No service bookings generated for this trip yet.</div>
      ) : (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">All services are booked — the report below is final.</div>
      )}

      {showNumbers && active.length > 0 && (
        <div className="card card-flush mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
              <tr><th className="px-4 py-2.5">Service</th><th className="px-4 py-2.5">Kind</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Cost (INR)</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {active.map((s) => (
                <tr key={s._id}>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{s.name || '—'}{s.detail ? <span className="block text-xs font-normal text-gray-400">{s.detail}</span> : null}</td>
                  <td className="px-4 py-2.5 capitalize text-gray-600">{s.kind}</td>
                  <td className="px-4 py-2.5"><span className={cn('rounded px-2 py-0.5 text-xs font-medium capitalize', ['booked', 'confirmed'].includes(s.status) ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700')}>{s.status}</span></td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{(s.price || 0).toLocaleString('en-IN')}</td>
                </tr>
              ))}
              <tr className="bg-slate-50">
                <td colSpan={3} className="px-4 py-2.5 text-right font-bold text-gray-700">Booked Cost</td>
                <td className="px-4 py-2.5 text-right font-bold text-gray-900">{bookedCost.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mb-2 mt-7 font-semibold text-gray-900">Transactions</h3>
      {!transactions.length ? (
        <div className="card flex flex-col items-center gap-2 p-10 text-center">
          <Info size={28} className="text-gray-300" />
          <p className="text-sm text-gray-500">There are no items in this list.</p>
        </div>
      ) : (
        <div className="card card-flush overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
              <tr><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Reference</th><th className="px-4 py-2.5 text-right">Amount (INR)</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((r) => (
                <tr key={r._id}>
                  <td className="px-4 py-2.5 text-gray-600">{dt(r.paidOn || r.dueDate)}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn('rounded px-2 py-0.5 text-xs font-medium', r.direction === 'incoming' ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-700')}>
                      {r.direction === 'incoming' ? 'Received' : 'Paid out'}
                    </span>
                    {r.direction === 'outgoing' && r.supplierName ? <span className="ml-2 text-xs text-gray-400">{r.supplierName}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500">{r.reference || '—'}</td>
                  <td className={cn('px-4 py-2.5 text-right font-semibold', r.direction === 'incoming' ? 'text-green-700' : 'text-rose-700')}>
                    {r.direction === 'incoming' ? '+' : '−'} {inr(r.paidAmount || r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
