import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, FileDown, MapPin, UserSquare, MessageSquare, Plus, Trash2, Flag, X, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import CreatableSelect from '../../components/form/CreatableSelect.jsx';
import FormSection from '../../components/form/FormSection.jsx';
import { useAuth } from '../../store/AuthContext.jsx';
import { queriesApi } from '../../api/queries.js';
import { tripNo } from '../../lib/format.js';
import {
  destinationsApi,
  querySourcesApi,
  tagsApi,
  usersApi,
} from '../../api/masterData.js';

const COUNTRY_CODES = [
  { code: '91', label: '91-IN' },
  { code: '1', label: '1-US' },
  { code: '44', label: '44-UK' },
  { code: '971', label: '971-AE' },
];

export default function NewQueryPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const emailRef = useRef(null);
  const [showEmail, setShowEmail] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  useEffect(() => { if (showEmail) emailRef.current?.focus(); }, [showEmail]);

  // Default the Sales Person to the logged-in user on a new query.
  useEffect(() => {
    if (!isEdit && user) {
      setForm((f) => (f.owner ? f : { ...f, owner: { _id: user._id || user.id, name: user.name } }));
    }
  }, [user, isEdit]);

  const { data: existing } = useQuery({
    queryKey: ['query', id],
    queryFn: () => queriesApi.get(id),
    enabled: isEdit,
  });

  const [form, setForm] = useState({
    source: null,
    referenceId: '',
    owner: null,
    tags: [],
    destinations: [],
    startDate: '',
    nights: 1,
    adults: 1,
    children: [], // ages
    foc: 0,
    salutation: '',
    name: '',
    phones: [{ countryCode: '91', number: '', isPrimary: true }],
    email: '',
    location: '',
    nationality: '',
    comments: '',
  });

  // Prefill in edit mode
  useEffect(() => {
    if (!existing) return;
    setForm({
      source: existing.source || null,
      referenceId: existing.referenceId || '',
      owner: existing.owner || null,
      tags: existing.tags || [],
      destinations: existing.destinations || [],
      startDate: existing.startDate ? existing.startDate.slice(0, 10) : '',
      nights: existing.nights ?? 1,
      adults: existing.pax?.adults ?? 1,
      children: existing.pax?.children || [],
      foc: existing.foc || 0,
      salutation: existing.guest?.salutation || '',
      name: existing.guest?.name || '',
      phones: existing.guest?.phones?.length ? existing.guest.phones : [{ countryCode: '91', number: '', isPrimary: true }],
      email: existing.guest?.email || '',
      location: existing.guest?.location || '',
      nationality: existing.guest?.nationality || '',
      comments: existing.comments || '',
    });
    setShowEmail(!!existing.guest?.email);
    setShowLocation(!!(existing.guest?.location || existing.guest?.nationality));
  }, [existing]);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const setEvt = (key) => (e) => set(key)(e.target.value);

  const addChild = () => set('children')([...form.children, { age: 1 }]);
  const removeChild = (i) => set('children')(form.children.filter((_, idx) => idx !== i));
  const setChildAge = (i, age) =>
    set('children')(form.children.map((c, idx) => (idx === i ? { age: Number(age) } : c)));

  const addPhone = () => set('phones')([...form.phones, { countryCode: '91', number: '', isPrimary: false }]);
  const removePhone = (i) => {
    const next = form.phones.filter((_, idx) => idx !== i);
    if (next.length && !next.some((p) => p.isPrimary)) next[0].isPrimary = true;
    set('phones')(next.length ? next : [{ countryCode: '91', number: '', isPrimary: true }]);
  };
  const setPrimary = (i) => set('phones')(form.phones.map((p, idx) => ({ ...p, isPrimary: idx === i })));
  const setPhone = (i, patch) =>
    set('phones')(form.phones.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const handleSubmit = async (e) => {
    e.preventDefault();
    // A trip can't start in the past (existing trips keep their original date).
    const today = new Date().toISOString().slice(0, 10);
    const origStart = existing?.startDate ? existing.startDate.slice(0, 10) : '';
    if (form.startDate && form.startDate < today && form.startDate !== origStart) {
      return toast.error('Start date cannot be in the past');
    }
    setSaving(true);
    try {
      const payload = {
        source: form.source?._id,
        referenceId: form.referenceId || undefined,
        owner: form.owner?._id,
        tags: form.tags.map((t) => t._id),
        destinations: form.destinations.map((d) => d._id),
        startDate: form.startDate || undefined,
        nights: Number(form.nights) || 0,
        pax: {
          adults: Number(form.adults) || 1,
          children: form.children.map((c) => ({ age: Number(c.age) || 0 })),
        },
        foc: Number(form.foc) || 0,
        guest: {
          salutation: form.salutation || undefined,
          name: form.name || undefined,
          email: form.email || undefined,
          location: form.location || undefined,
          nationality: form.nationality || undefined,
          phones: (() => {
            const valid = form.phones.filter((p) => p.number.trim());
            if (valid.length && !valid.some((p) => p.isPrimary)) valid[0].isPrimary = true;
            return valid;
          })(),
        },
        comments: form.comments || undefined,
      };
      const saved = isEdit ? await queriesApi.update(id, payload) : await queriesApi.create(payload);
      toast.success(isEdit ? 'Query updated' : `Query #${tripNo(saved.queryNumber)} created`);
      navigate(`/trips/${saved._id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to save query');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Sub header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-3">
        <div className="flex items-center gap-3 text-sm">
          <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-gray-900">
            <ArrowLeft size={18} />
          </button>
          <span className="font-semibold text-gray-900">{isEdit ? 'Edit Query' : 'New Query'}</span>
          <span className="text-gray-400">/</span>
          <Link to="/trips" className="text-gray-500 hover:text-gray-800">Trips</Link>
          <span className="text-gray-400">/</span>
          <span className="text-gray-500">{isEdit ? `#${tripNo(existing?.queryNumber)}` : 'New Query'}</span>
        </div>
        <Link to="/trips/upload" className="btn-secondary text-sm">
          <FileDown size={15} /> Upload Via CSV
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-6">
        <div className="card px-6">
          {/* Query Source */}
          <FormSection
            icon={Download}
            title="Query Source"
            description="Please specify the query source, e.g., whether it came via B2B or from another source."
          >
            <div>
              <label className="label">Query Source</label>
              <AsyncSelect
                loadOptions={querySourcesApi.search}
                value={form.source}
                onChange={set('source')}
                creatable
                onCreate={(name) => querySourcesApi.create({ name })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Reference ID <span className="label-optional">(optional)</span></label>
                <input className="input" placeholder="1231231" value={form.referenceId} onChange={setEvt('referenceId')} />
                <p className="mt-1 text-xs text-slate-400">A custom id for your reference regarding the query</p>
              </div>
              <div>
                <label className="label">Sales Person</label>
                <AsyncSelect loadOptions={usersApi.search} value={form.owner} onChange={set('owner')} placeholder="Assign to a user…" />
              </div>
            </div>
            <div>
              <label className="label">Tags <span className="font-normal text-gray-400">(optional)</span></label>
              <AsyncSelect
                loadOptions={tagsApi.search}
                value={form.tags}
                onChange={set('tags')}
                isMulti
                creatable
                onCreate={(name) => tagsApi.create({ name })}
              />
            </div>
          </FormSection>

          {/* Destination & Duration */}
          <FormSection
            icon={MapPin}
            title="Destination and Duration"
            description="Provide destination, duration etc. along with number of adults and children with ages."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="label">Destinations</label>
                <AsyncSelect
                  loadOptions={destinationsApi.search}
                  value={form.destinations}
                  onChange={set('destinations')}
                  isMulti
                  creatable
                  onCreate={(name) => destinationsApi.create({ name })}
                />
              </div>
              <div>
                <label className="label">Start Date</label>
                <input type="date" className="input" min={new Date().toISOString().slice(0, 10)} value={form.startDate} onChange={setEvt('startDate')} />
              </div>
              <div>
                <label className="label">No. of Nights</label>
                <input type="number" min="0" className="input" value={form.nights} onChange={setEvt('nights')} />
                <p className="mt-1 text-xs text-gray-500">{form.nights} Night{form.nights == 1 ? '' : 's'}, {Number(form.nights) + 1} Days</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">No. of Adults</label>
                <input type="number" min="1" className="input" value={form.adults} onChange={setEvt('adults')} />
              </div>
              <div>
                <label className="label">Children &amp; Ages</label>
                <div className="flex flex-wrap items-center gap-2">
                  {form.children.map((c, i) => (
                    <div key={i} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white pl-1 pr-1.5 shadow-sm">
                      <select
                        className="rounded-lg bg-transparent py-2 pl-2 pr-1 text-sm outline-none"
                        value={c.age}
                        onChange={(e) => setChildAge(i, e.target.value)}
                      >
                        {Array.from({ length: 12 }, (_, n) => n + 1).map((y) => (
                          <option key={y} value={y}>{y}y</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => removeChild(i)} className="text-slate-400 hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addChild} title="Add child" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-brand-600 shadow-sm transition-colors hover:bg-brand-50">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Total FOC</label>
                <input type="number" min="0" className="input" value={form.foc} onChange={setEvt('foc')} />
              </div>
            </div>
          </FormSection>

          {/* Guest Details */}
          <FormSection icon={UserSquare} title="Guest Details" description="Please provide name and phone number(s).">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Salutation</label>
                <CreatableSelect category="salutation" value={form.salutation} onChange={set('salutation')} placeholder="e.g. Mr." />
              </div>
              <div>
                <label className="label">Name</label>
                <input className="input" placeholder="Anoop Rai" value={form.name} onChange={setEvt('name')} />
              </div>
            </div>
            <div>
              <label className="label">Phone Number(s)</label>
              <div className="space-y-2">
                {form.phones.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      className="input w-28"
                      value={p.countryCode}
                      onChange={(e) => setPhone(i, { countryCode: e.target.value })}
                    >
                      {COUNTRY_CODES.map((c) => (
                        <option key={c.code} value={c.code}>{c.label}</option>
                      ))}
                    </select>
                    <input
                      className="input flex-1"
                      placeholder="e.g. 9779212232"
                      value={p.number}
                      onChange={(e) => setPhone(i, { number: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setPrimary(i)}
                      title={p.isPrimary ? 'Primary number' : 'Set as primary'}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-colors ${p.isPrimary ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                    >
                      <Flag size={15} className={p.isPrimary ? 'fill-brand-500' : ''} />
                    </button>
                    {form.phones.length > 1 && (
                      <button type="button" onClick={() => removePhone(i)} title="Remove" className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-400 shadow-sm transition-colors hover:bg-red-50 hover:text-red-500">
                        <X size={15} />
                      </button>
                    )}
                    {p.isPrimary && (
                      <>
                        <button type="button" onClick={() => setShowEmail((s) => !s)} title="Add email"
                          className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-colors ${showEmail ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
                          <Mail size={15} />
                        </button>
                        <button type="button" onClick={() => setShowLocation((s) => !s)} title="Add origin/nationality"
                          className={`flex h-10 w-10 items-center justify-center rounded-xl border shadow-sm transition-colors ${showLocation ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
                          <MapPin size={15} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addPhone} className="mt-2 text-sm font-medium text-brand-700 hover:underline">
                + Add More
              </button>
            </div>

            {showEmail && (
              <div className="max-w-sm">
                <label className="label">Email <span className="label-optional">(optional)</span></label>
                <input ref={emailRef} type="email" className="input" placeholder="guest@email.com" value={form.email} onChange={setEvt('email')} />
              </div>
            )}
            {showLocation && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label">Origin City/State <span className="label-optional">(optional)</span></label>
                  <input className="input" placeholder="e.g. City, State, Country" value={form.location} onChange={setEvt('location')} />
                </div>
                <div>
                  <label className="label">Nationality <span className="label-optional">(optional)</span></label>
                  <input className="input" placeholder="e.g. India" value={form.nationality} onChange={setEvt('nationality')} />
                </div>
              </div>
            )}
          </FormSection>

          {/* Comments */}
          <FormSection icon={MessageSquare} title="Comments or Notes" description="Any comments or notes regarding this query which may be useful for the sales process.">
            <div>
              <label className="label">Comments <span className="font-normal text-gray-400">(optional)</span></label>
              <textarea rows={3} className="input" placeholder="Only 5 star hotels" value={form.comments} onChange={setEvt('comments')} />
            </div>
          </FormSection>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <button type="submit" className="btn-primary px-8" disabled={saving}>
            {saving ? 'Saving…' : 'Save Details'}
          </button>
          <button type="button" onClick={() => navigate('/trips')} className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
