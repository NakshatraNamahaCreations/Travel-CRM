import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, X, AlertTriangle, Check, Wallet, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { queriesApi } from '../../api/queries.js';
import { quotesApi } from '../../api/quotes.js';
import { computePackage, packageWarnings, money } from '../../lib/pricing.js';
import { tripNo } from '../../lib/format.js';
import PackageEditor from './PackageEditor.jsx';
import CreatableSelect from '../../components/form/CreatableSelect.jsx';
import { cn } from '../../lib/cn.js';

const newPackage = (name) => ({
  name, hotels: [], inclusions: [], transports: [], extras: [],
  sameCabType: false, sharedCabItems: [{ type: '', qty: 1 }],
  markupType: 'percent', markupValue: 0, taxName: 'GST', taxApplied: false, taxPercent: 5, taxOn: 'cost_markup', rounding: 1,
  internalComments: '', customerRemarks: '',
});

export default function QuoteBuilderPage({ mode }) {
  const { id, queryId } = useParams();
  const navigate = useNavigate();
  const isEdit = mode === 'edit';
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(0);
  const [editBasics, setEditBasics] = useState(false);

  const [form, setForm] = useState({
    title: '', currency: 'INR', startDate: '', nights: 1, pax: { adults: 1, children: [] },
    pricingStrategy: 'overall', totalFoc: 0, selectedPackageIndex: 0,
    packages: [newPackage('Deluxe Package')],
  });

  const { data: query } = useQuery({ queryKey: ['query', queryId], queryFn: () => queriesApi.get(queryId), enabled: !isEdit && !!queryId });
  const { data: existing } = useQuery({ queryKey: ['quote', id], queryFn: () => quotesApi.get(id), enabled: isEdit && !!id });

  useEffect(() => {
    if (query) setForm((f) => ({
      ...f,
      title: f.title || `${(query.destinations || []).map((d) => d.name).join(', ')} ${query.nights}N/${query.nights + 1}D`,
      currency: query.currency || 'INR',
      startDate: query.startDate ? query.startDate.slice(0, 10) : '',
      nights: query.nights || 1,
      pax: query.pax || { adults: 1, children: [] },
    }));
  }, [query]);

  useEffect(() => {
    if (existing) setForm({
      title: existing.title || '', currency: existing.currency || 'INR',
      startDate: existing.startDate ? existing.startDate.slice(0, 10) : '', nights: existing.nights || 1,
      pax: existing.pax || { adults: 1, children: [] }, pricingStrategy: existing.pricingStrategy || 'overall',
      totalFoc: existing.totalFoc || 0, selectedPackageIndex: existing.selectedPackageIndex || 0,
      packages: existing.packages?.length ? existing.packages.map((p) => ({ ...p })) : [newPackage('Deluxe Package')],
    });
  }, [existing]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setPkg = (i, pkg) => set('packages')(form.packages.map((p, idx) => (idx === i ? pkg : p)));
  const addPkg = () => { set('packages')([...form.packages, newPackage(`Package ${form.packages.length + 1}`)]); setActive(form.packages.length); };
  const rmPkg = (i) => { const next = form.packages.filter((_, idx) => idx !== i); set('packages')(next.length ? next : [newPackage('Package 1')]); setActive(0); };
  const renamePkg = (i, name) => setPkg(i, { ...form.packages[i], name });

  const computed = useMemo(() => form.packages.map((p) => ({ ...computePackage(p), warnings: packageWarnings(p, form.pax.adults) })), [form.packages, form.pax.adults]);

  const save = async (sendAfter = false) => {
    if (!form.title.trim()) return toast.error('Give the quote a title');
    setSaving(true);
    try {
      const payload = {
        ...(isEdit ? {} : { query: queryId }),
        title: form.title, currency: form.currency, startDate: form.startDate || undefined,
        nights: Number(form.nights), pax: form.pax, pricingStrategy: form.pricingStrategy,
        totalFoc: Number(form.totalFoc) || 0, selectedPackageIndex: form.selectedPackageIndex, packages: form.packages,
      };
      const saved = isEdit ? await quotesApi.update(id, payload) : await quotesApi.create(payload);
      if (sendAfter) await quotesApi.setStatus(saved._id, 'sent');
      toast.success(isEdit ? 'Quote updated' : 'Quote created');
      navigate(`/quotes/${saved._id}`);
    } catch (err) { toast.error(err.message || 'Failed to save quote'); }
    finally { setSaving(false); }
  };

  const parentId = isEdit ? existing?.query?._id : queryId;
  const trip = isEdit ? existing?.query : query;
  const tripGuest = [trip?.guest?.salutation, trip?.guest?.name].filter(Boolean).join(' ') || 'Guest';
  const tripDest = (trip?.destinations || []).map((d) => d.name).join(', ') || 'Andaman and Nicobar Islands';

  return (
    <div>
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-3 text-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-slate-600 hover:text-slate-900"><ArrowLeft size={18} /></button>
          <span className="font-semibold text-slate-900">{isEdit ? 'Edit Quote' : 'New Quote'}</span>
          <span className="text-slate-300">/</span>
          <Link to="/trips" className="text-slate-500 hover:text-slate-800">Trips</Link>
          {trip && (
            <>
              <span className="text-slate-300">/</span>
              <Link to={`/trips/${parentId}`} className="max-w-md truncate text-slate-500 hover:text-slate-800">#{tripNo(trip.queryNumber)} • {tripGuest} • {tripDest}</Link>
            </>
          )}
          <span className="text-slate-300">/</span>
          <span className="text-slate-500">Create Quote</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => save(false)} className="btn-secondary" disabled={saving}>Save Quote</button>
          <button onClick={() => save(true)} className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save & Send'}</button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Basic Details */}
        <div className="card mb-5 p-5">
          <h3 className="heading-h4 text-slate-900">Basic Details</h3>
          <p className="mb-3 text-sm text-slate-500">Review basic details for this quote. You can edit these to provide a quote with a different configuration, without changing the trip details.</p>

          {!editBasics ? (
            <div className="flex flex-wrap items-center gap-x-10 gap-y-3">
              <Detail label="Destination" value={tripDest} />
              <Detail label="Start Date" value={form.startDate ? format(new Date(form.startDate), 'd MMM, yyyy') : '—'} />
              <Detail label="Duration" value={`${form.nights} Night${form.nights === 1 ? '' : 's'}, ${Number(form.nights) + 1} Days`} />
              <Detail label="Pax" value={`${form.pax.adults} Adult${form.pax.adults === 1 ? '' : 's'}${form.pax.children?.length ? `, ${form.pax.children.length} Child` : ''}`} />
              <Detail label="Currency" value={form.currency} />
              <button onClick={() => setEditBasics(true)} className="btn-secondary ml-auto text-sm"><Pencil size={14} /> Edit Basic Details</button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-4">
                <div className="sm:col-span-2"><label className="label">Quote Title</label><input className="input" value={form.title} onChange={(e) => set('title')(e.target.value)} /></div>
                <div><label className="label">Start Date</label><input type="date" className="input" value={form.startDate} onChange={(e) => set('startDate')(e.target.value)} /></div>
                <div><label className="label">Nights</label><input type="number" className="input" value={form.nights} onChange={(e) => set('nights')(Number(e.target.value))} /></div>
                <div><label className="label">Adults</label><input type="number" className="input" value={form.pax.adults} onChange={(e) => set('pax')({ ...form.pax, adults: Number(e.target.value) })} /></div>
                <div><label className="label">Currency</label><CreatableSelect category="currency" value={form.currency} onChange={set('currency')} /></div>
                <div><label className="label">Total FOC</label><input type="number" className="input" value={form.totalFoc} onChange={(e) => set('totalFoc')(Number(e.target.value))} /></div>
                <div><label className="label">Pricing</label><select className="input" value={form.pricingStrategy} onChange={(e) => set('pricingStrategy')(e.target.value)}><option value="overall">Overall</option><option value="per-service">Per-service</option></select></div>
              </div>
              <button onClick={() => setEditBasics(false)} className="btn-primary mt-3 text-sm">Done</button>
            </>
          )}

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3">
            <span className="font-semibold text-slate-800">Package Types/Categories: {form.packages.length} Option{form.packages.length === 1 ? '' : 's'}</span>
            <span className="text-slate-400">·</span>
            <span className="text-sm text-slate-500">{form.packages.map((p) => p.name).join(', ')}</span>
          </div>
        </div>

        {/* Package tabs */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {form.packages.map((p, i) => (
            <button key={i} onClick={() => setActive(i)}
              className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm', active === i ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50')}>
              {p.name} <span className="text-xs text-gray-400">{money(computed[i]?.sellingPrice, form.currency)}</span>
              {form.packages.length > 1 && <X size={13} onClick={(e) => { e.stopPropagation(); rmPkg(i); }} className="hover:text-red-500" />}
            </button>
          ))}
          <button onClick={addPkg} className="btn-secondary text-sm"><Plus size={14} /> Add Option</button>
        </div>

        {/* Active package editor */}
        <div className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <input className="input max-w-xs font-semibold" value={form.packages[active].name} onChange={(e) => renamePkg(active, e.target.value)} />
            <label className="flex items-center gap-1 text-sm text-gray-500">
              <input type="radio" checked={form.selectedPackageIndex === active} onChange={() => set('selectedPackageIndex')(active)} /> Default option
            </label>
          </div>
          <PackageEditor pkg={form.packages[active]} onChange={(p) => setPkg(active, p)} nights={form.nights} startDate={form.startDate} currency={form.currency} />
        </div>

        {/* Summary */}
        <div className="card mt-6 p-5">
          <h3 className="heading-h4 text-slate-900">Summary</h3>
          <p className="mb-3 text-sm text-slate-500">Please review the quote's data before creating.</p>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap gap-8 text-sm">
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Start Date</p><p className="font-semibold text-slate-900">{form.startDate ? format(new Date(form.startDate), 'd MMM, yyyy') : '—'}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Duration</p><p className="font-semibold text-slate-900">{form.nights} Night{form.nights === 1 ? '' : 's'}, {Number(form.nights) + 1} Days</p></div>
              <div><p className="text-xs uppercase tracking-wide text-slate-400">Pax</p><p className="font-semibold text-slate-900">{form.pax.adults} Adult{form.pax.adults === 1 ? '' : 's'}{form.pax.children?.length ? `, ${form.pax.children.length} Child` : ''}</p></div>
            </div>
            <div className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Total Cost</p>
              <p className="text-lg font-bold tabular-nums text-slate-900">{money(computed[form.selectedPackageIndex]?.costPrice || 0, form.currency)}</p>
            </div>
          </div>
          <p className="mb-4 mt-1 text-right text-xs text-slate-400">Total cost price for all provided services — this is NOT the selling price.</p>

          <div className="grid gap-4 sm:grid-cols-2">
            {form.packages.map((p, i) => {
              const c = computed[i];
              return (
                <div key={i} className={cn('rounded-lg border p-4', form.selectedPackageIndex === i ? 'border-brand-300 bg-brand-50/40' : 'border-gray-200')}>
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">{p.name}</h4>
                    {form.selectedPackageIndex === i && <span className="flex items-center gap-1 text-xs text-brand-600"><Check size={12} /> Default</span>}
                  </div>
                  <div className="mt-2 space-y-1 text-sm">
                    <Row label="Cost" value={money(c.costPrice, form.currency)} />
                    <Row label="Markup" value={money(c.markupAmount, form.currency)} />
                    <Row label={`Tax${p.taxApplied ? '' : ' (off)'}`} value={money(c.taxAmount, form.currency)} />
                    <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-bold text-gray-900"><span>Selling</span><span>{money(c.sellingPrice, form.currency)}</span></div>
                  </div>
                  {c.warnings.length > 0 && (
                    <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-700">
                      <p className="flex items-center gap-1 font-semibold"><AlertTriangle size={12} /> Review:</p>
                      <ul className="ml-4 list-disc">{c.warnings.map((w, k) => <li key={k}>{w}</li>)}</ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Preview Final Package Price */}
          <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50/40 p-5">
            <h4 className="flex items-center gap-2 heading-h4 text-slate-900"><Wallet size={18} className="text-brand-600" /> Preview Final Package Price</h4>
            <p className="text-sm text-slate-500">Here are the final prices for this quote.</p>
            <div className="mt-3 flex flex-wrap gap-8">
              {form.packages.map((p, i) => (
                <div key={i}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{p.name}</p>
                  <p className="text-2xl font-bold tabular-nums text-slate-900">{money(computed[i].sellingPrice, form.currency)}</p>
                  <p className="text-xs text-slate-400">{p.taxApplied ? `${p.taxName || 'GST'}: Included (${p.taxPercent}%)` : `${p.taxName || 'GST'}: Excluded`}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return <div className="flex justify-between"><span className="text-gray-500">{label}</span><span className="font-medium text-gray-900">{value}</span></div>;
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-semibold text-slate-900">{value}</p>
    </div>
  );
}
