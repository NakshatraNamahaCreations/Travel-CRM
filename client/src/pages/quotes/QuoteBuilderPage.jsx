import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, X, AlertTriangle, Check, Wallet, Pencil, ClipboardList, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { queriesApi } from '../../api/queries.js';
import { quotesApi } from '../../api/quotes.js';
import { computePackage, packageWarnings, money } from '../../lib/pricing.js';
import { tripNo } from '../../lib/format.js';
import PackageEditor from './PackageEditor.jsx';
import InclusionExclusionEditor from './InclusionExclusionEditor.jsx';
import CreatableSelect from '../../components/form/CreatableSelect.jsx';
import { cn } from '../../lib/cn.js';

const newPackage = (name) => ({
  name, hotels: [], inclusions: [], transports: [], extras: [], flights: [],
  sameCabType: false, sharedCabItems: [{ type: '', qty: 1 }],
  markupType: 'percent', markupValue: 0, taxName: 'GST', taxApplied: true, taxPercent: 5, taxOn: 'cost_markup', rounding: 1,
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
    inclusions: [], exclusions: [],
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
      inclusions: existing.inclusions || [], exclusions: existing.exclusions || [],
    });
  }, [existing]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setPkg = (i, pkg) => set('packages')(form.packages.map((p, idx) => (idx === i ? pkg : p)));
  // New options reuse the active package's transports/activities/cab & pricing
  // setup — typically only the hotels differ between package options.
  const addPkg = () => {
    const base = form.packages[active] || form.packages[0];
    const stripIds = (v) => JSON.parse(JSON.stringify(v, (k, val) => (k === '_id' ? undefined : val)));
    // hotels + hotel-tied special inclusions reset; everything else carries over.
    const clone = base
      ? { ...stripIds(base), name: `Package ${form.packages.length + 1}`, hotels: [], inclusions: [] }
      : newPackage(`Package ${form.packages.length + 1}`);
    set('packages')([...form.packages, clone]);
    setActive(form.packages.length);
  };
  const rmPkg = (i) => { const next = form.packages.filter((_, idx) => idx !== i); set('packages')(next.length ? next : [newPackage('Package 1')]); setActive(0); };
  const renamePkg = (i, name) => setPkg(i, { ...form.packages[i], name });

  const computed = useMemo(() => form.packages.map((p) => ({ ...computePackage(p), warnings: packageWarnings(p, form.pax.adults) })), [form.packages, form.pax.adults]);

  const save = async () => {
    if (!form.title.trim()) return toast.error('Give the quote a title');
    setSaving(true);
    try {
      const payload = {
        ...(isEdit ? {} : { query: queryId }),
        title: form.title, currency: form.currency, startDate: form.startDate || undefined,
        nights: Number(form.nights), pax: form.pax, pricingStrategy: form.pricingStrategy,
        totalFoc: Number(form.totalFoc) || 0, selectedPackageIndex: form.selectedPackageIndex, packages: form.packages,
        inclusions: form.inclusions.map((t) => t.trim()).filter(Boolean),
        exclusions: form.exclusions.map((t) => t.trim()).filter(Boolean),
      };
      const saved = isEdit ? await quotesApi.update(id, payload) : await quotesApi.create(payload);
      toast.success(isEdit ? 'Quote updated' : 'Quote created');
      // A fresh quote continues to the Create Itinerary step; edits return to
      // the trip's quotes tab (Sembark flow — no standalone quote page between).
      if (isEdit) {
        const tripId = existing?.query?._id || saved.query;
        navigate(tripId ? `/trips/${tripId}` : `/quotes/${saved._id}`);
      } else {
        navigate(`/quotes/${saved._id}/itinerary`);
      }
    } catch (err) { toast.error(err.message || 'Failed to save quote'); }
    finally { setSaving(false); }
  };

  const parentId = isEdit ? existing?.query?._id : queryId;
  const trip = isEdit ? existing?.query : query;
  const tripGuest = [trip?.guest?.salutation, trip?.guest?.name].filter(Boolean).join(' ') || 'Guest';
  const tripDest = (trip?.destinations || []).map((d) => d.name).join(', ') || 'Andaman and Nicobar Islands';

  const selPkg = form.packages[form.selectedPackageIndex] || form.packages[0];
  const selComputed = computed[form.selectedPackageIndex] || computed[0];

  return (
    <div className="min-h-full bg-slate-50/70">
      {/* Breadcrumb */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-6 py-3 text-sm backdrop-blur">
        <button onClick={() => navigate(-1)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><ArrowLeft size={17} /></button>
        <span className="font-bold text-slate-900">{isEdit ? 'Edit Quote' : 'New Quote'}</span>
        <span className="text-slate-300">/</span>
        <Link to="/trips" className="text-slate-500 hover:text-slate-800">Trips</Link>
        {trip && (
          <>
            <span className="text-slate-300">/</span>
            <Link to={`/trips/${parentId}`} className="max-w-md truncate text-slate-500 hover:text-slate-800">#{tripNo(trip.queryNumber)} • {tripGuest} • {tripDest}</Link>
          </>
        )}
      </div>

      <div className="space-y-6 px-6 py-6">
        {/* Basic Details */}
        <div className="card p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm"><ClipboardList size={17} /></span>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">Basic Details</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">Review basic details for this quote. Edit these to quote a different configuration without changing the trip details.</p>
              </div>
            </div>
            {!editBasics && (
              <button onClick={() => setEditBasics(true)} className="btn-secondary shrink-0 text-sm"><Pencil size={14} /> Edit</button>
            )}
          </div>

          {!editBasics ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
              <Detail label="Destination" value={tripDest} />
              <Detail label="Start Date" value={form.startDate ? format(new Date(form.startDate), 'd MMM, yyyy') : '—'} />
              <Detail label="Duration" value={`${form.nights} Night${form.nights === 1 ? '' : 's'}, ${Number(form.nights) + 1} Days`} />
              <Detail label="Pax" value={`${form.pax.adults} Adult${form.pax.adults === 1 ? '' : 's'}${form.pax.children?.length ? `, ${form.pax.children.length} Child` : ''}`} />
              <Detail label="Currency" value={form.currency} />
            </div>
          ) : (
            <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2"><label className="label">Quote Title</label><input className="input" value={form.title} onChange={(e) => set('title')(e.target.value)} /></div>
                <div><label className="label">Start Date</label><input type="date" className="input" min={new Date().toISOString().slice(0, 10)} value={form.startDate} onChange={(e) => set('startDate')(e.target.value)} /></div>
                <div><label className="label">Nights</label><input type="number" className="input" value={form.nights} onChange={(e) => set('nights')(Number(e.target.value))} /></div>
                <div><label className="label">Adults</label><input type="number" className="input" value={form.pax.adults} onChange={(e) => set('pax')({ ...form.pax, adults: Number(e.target.value) })} /></div>
                <div><label className="label">Currency</label><CreatableSelect category="currency" value={form.currency} onChange={set('currency')} /></div>
                <div><label className="label">Total FOC</label><input type="number" className="input" value={form.totalFoc} onChange={(e) => set('totalFoc')(Number(e.target.value))} /></div>
                <div><label className="label">Pricing</label><select className="input" value={form.pricingStrategy} onChange={(e) => set('pricingStrategy')(e.target.value)}><option value="overall">Overall</option><option value="per-service">Per-service</option></select></div>
              </div>
              <button onClick={() => setEditBasics(false)} className="btn-primary mt-4 text-sm">Done</button>
            </div>
          )}
        </div>

        {/* Package options */}
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Package Options ({form.packages.length})</p>
          <div className="flex flex-wrap items-center gap-2">
            {form.packages.map((p, i) => (
              <button key={i} onClick={() => setActive(i)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium shadow-sm transition',
                  active === i ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700',
                )}>
                {p.name}
                <span className={cn('rounded-full px-2 py-0.5 text-xs tabular-nums', active === i ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500')}>
                  {money(computed[i]?.sellingPrice, form.currency)}
                </span>
                {form.packages.length > 1 && <X size={13} onClick={(e) => { e.stopPropagation(); rmPkg(i); }} className={active === i ? 'hover:text-red-200' : 'hover:text-red-500'} />}
              </button>
            ))}
            <button onClick={addPkg} className="btn-secondary text-sm"><Plus size={14} /> Add Option</button>
          </div>
        </div>

        {/* Active package name */}
        <div className="card flex flex-wrap items-end gap-4 p-4">
          <div>
            <label className="label">Package Name</label>
            <input className="input w-64 font-semibold" value={form.packages[active].name} onChange={(e) => renamePkg(active, e.target.value)} />
          </div>
          <label className={cn('mb-1 flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition', form.selectedPackageIndex === active ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50')}>
            <input type="radio" checked={form.selectedPackageIndex === active} onChange={() => set('selectedPackageIndex')(active)} className="h-3.5 w-3.5 text-brand-600" />
            Default option shown to the customer
          </label>
        </div>

        <PackageEditor pkg={form.packages[active]} onChange={(p) => setPkg(active, p)} nights={form.nights} startDate={form.startDate} currency={form.currency} pax={form.pax} />

        {/* Inclusion / Exclusion */}
        <InclusionExclusionEditor
          inclusions={form.inclusions}
          exclusions={form.exclusions}
          onChange={({ inclusions, exclusions }) => setForm((f) => ({ ...f, inclusions, exclusions }))}
        />

        {/* Summary */}
        <div className="card p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm"><ClipboardCheck size={17} /></span>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900">Summary</h3>
              <p className="mt-0.5 text-xs text-slate-400">Please review the quote's data before saving.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
            <div className="grid grid-cols-3 gap-8 text-sm">
              <Detail label="Start Date" value={form.startDate ? format(new Date(form.startDate), 'd MMM, yyyy') : '—'} />
              <Detail label="Duration" value={`${form.nights} Night${form.nights === 1 ? '' : 's'}, ${Number(form.nights) + 1} Days`} />
              <Detail label="Pax" value={`${form.pax.adults} Adult${form.pax.adults === 1 ? '' : 's'}${form.pax.children?.length ? `, ${form.pax.children.length} Child` : ''}`} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-right shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total Cost</p>
              <p className="text-lg font-bold tabular-nums text-slate-900">{money(selComputed?.costPrice || 0, form.currency)}</p>
              <p className="text-[10.5px] text-slate-400">Cost price of all services — not the selling price</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {form.packages.map((p, i) => {
              const c = computed[i];
              const isDefault = form.selectedPackageIndex === i;
              return (
                <div key={i} className={cn('rounded-xl border p-4 transition', isDefault ? 'border-brand-300 bg-brand-50/40 ring-1 ring-brand-200' : 'border-slate-200')}>
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-slate-900">{p.name}</h4>
                    {isDefault && <span className="flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white"><Check size={11} /> Default</span>}
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <Row label="Cost" value={money(c.costPrice, form.currency)} />
                    <Row label="Markup" value={money(c.markupAmount, form.currency)} />
                    <Row label={`Tax${p.taxApplied ? '' : ' (off)'}`} value={money(c.taxAmount, form.currency)} />
                    <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900"><span>Selling</span><span className="tabular-nums">{money(c.sellingPrice, form.currency)}</span></div>
                  </div>
                  {c.warnings.length > 0 && (
                    <div className="mt-3 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">
                      <p className="flex items-center gap-1 font-semibold"><AlertTriangle size={12} /> Review:</p>
                      <ul className="ml-4 mt-0.5 list-disc space-y-0.5">{c.warnings.map((w, k) => <li key={k}>{w}</li>)}</ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Preview Final Package Price */}
          <div className="mt-5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 p-5 text-white">
            <h4 className="flex items-center gap-2 text-[15px] font-bold"><Wallet size={17} /> Preview Final Package Price</h4>
            <p className="text-xs text-white/70">Here are the final prices for this quote.</p>
            <div className="mt-4 flex flex-wrap gap-10">
              {form.packages.map((p, i) => (
                <div key={i}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">{p.name}</p>
                  <p className="text-2xl font-extrabold tabular-nums">{money(computed[i].sellingPrice, form.currency)}</p>
                  <p className="text-[11px] text-white/60">{p.taxApplied ? `${p.taxName || 'GST'}: Included (${p.taxPercent}%)` : `${p.taxName || 'GST'}: Excluded`}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{selPkg?.name || 'Package'} — Final Price</p>
            <p className="text-lg font-bold tabular-nums text-slate-900">{money(selComputed?.sellingPrice || 0, form.currency)}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} disabled={saving} className="btn-secondary">Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary px-6">{saving ? 'Saving…' : 'Save Quote'}</button>
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
