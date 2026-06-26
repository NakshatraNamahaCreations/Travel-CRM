import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, MapPin, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { transportApi } from '../../api/services.js';
import { destinationsApi } from '../../api/masterData.js';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import CreatableSelect from '../../components/form/CreatableSelect.jsx';
import FormSection from '../../components/form/FormSection.jsx';
import { LocationList, DayPicker, IntervalList } from '../../components/form/Repeaters.jsx';

const emptyService = () => ({ name: '', serviceCode: '', distanceKms: 0, startTime: '', durationMins: 60, closedDays: [], closedDates: [], description: '' });

export default function TransportFormPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [form, setForm] = useState({
    from: '', to: '', shortCode: '', destinations: [],
    useSamePickDrop: true, pickupLocations: [''], dropLocations: [''],
    useCheckinAsPickup: false, useCheckinAsDrop: false,
    services: [emptyService()],
  });

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setEvt = (k) => (e) => set(k)(e.target.value);
  const setService = (i, patch) => set('services')(form.services.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const addService = () => set('services')([...form.services, emptyService()]);
  const removeService = (i) => set('services')(form.services.filter((_, idx) => idx !== i));

  const services = form.services.filter((s) => s.name.trim());

  const submit = async (e) => {
    e.preventDefault();
    if (!services.length && !form.from.trim()) return toast.error('Add at least a Start City or one Service Name');
    setSaving(true);
    try {
      const name = form.from.trim() || services[0]?.name?.trim() || 'Transport Service';
      const saved = await transportApi.create({
        name,
        from: form.from, to: form.to, shortCode: form.shortCode || undefined,
        destinations: form.destinations.map((d) => d._id),
        useSamePickDrop: form.useSamePickDrop,
        pickupLocations: form.pickupLocations.filter((x) => x.trim()),
        dropLocations: form.dropLocations.filter((x) => x.trim()),
        useCheckinAsPickup: form.useCheckinAsPickup,
        useCheckinAsDrop: form.useCheckinAsDrop,
        items: services.map((s) => ({
          name: s.name,
          serviceCode: s.serviceCode || undefined,
          distanceKms: Number(s.distanceKms) || 0,
          startTime: s.startTime || undefined,
          durationMins: Number(s.durationMins) || 60,
          closedDays: s.closedDays,
          closedDates: s.closedDates.filter((d) => d.start && d.end),
          description: s.description || undefined,
        })),
      });
      toast.success('Transport service created');
      navigate(`/services/transport/${saved._id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 text-sm">
        <button onClick={() => navigate(-1)} className="text-slate-600 hover:text-slate-900"><ArrowLeft size={18} /></button>
        <span className="font-semibold text-slate-900">New Transport Service</span>
        <span className="text-slate-400">/</span>
        <Link to="/services/transport" className="text-slate-500 hover:text-slate-800">Transport Services</Link>
      </div>

      <form onSubmit={submit} className="mx-auto max-w-5xl px-6 py-6">
        <div className="card px-6">
          <div className="flex justify-end pt-4">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              <input type="checkbox" checked={quickAdd} onChange={(e) => setQuickAdd(e.target.checked)} /> Quick Add
            </label>
          </div>

          {/* Locations */}
          <FormSection icon={MapPin} title="Locations" description="Add pickup-drop location along with a short code for quick identification.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Start City</label><CreatableSelect category="city" value={form.from} onChange={set('from')} placeholder="Type to search..." /></div>
              <div><label className="label">End City <span className="label-optional">(optional)</span></label><CreatableSelect category="city" value={form.to} onChange={set('to')} placeholder="Type to search..." /></div>
              <div><label className="label">Short Code <span className="label-optional">(optional)</span></label><input className="input" value={form.shortCode} onChange={setEvt('shortCode')} placeholder="125" /></div>
              <div><label className="label">Trip Destinations</label><AsyncSelect loadOptions={destinationsApi.search} value={form.destinations} onChange={set('destinations')} isMulti creatable onCreate={(name) => destinationsApi.create({ name })} placeholder="Type to search..." /></div>
            </div>

            {!quickAdd && (
              <>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={form.useSamePickDrop} onChange={(e) => set('useSamePickDrop')(e.target.checked)} /> Use same pick-up/drop point for All Services
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="label">Pick Up Locations <span className="label-optional">(optional)</span></label><LocationList value={form.pickupLocations} onChange={set('pickupLocations')} placeholder="Type a pickup point..." /></div>
                  <div><label className="label">Drop Locations <span className="label-optional">(optional)</span></label><LocationList value={form.dropLocations} onChange={set('dropLocations')} placeholder="Type a drop point..." /></div>
                </div>
                <div className="flex flex-wrap gap-5">
                  <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.useCheckinAsPickup} onChange={(e) => set('useCheckinAsPickup')(e.target.checked)} /> Use Check-in Hotel as Pickup</label>
                  <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.useCheckinAsDrop} onChange={(e) => set('useCheckinAsDrop')(e.target.checked)} /> Use Check-in Hotel as Drop</label>
                </div>
              </>
            )}
          </FormSection>

          {/* Services */}
          <FormSection icon={Tag} title="Service and Itinerary Details" description="Please provide the service name with inclusions, distance, duration and itinerary description.">
            <div className="space-y-4">
              {form.services.map((s, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Service {i + 1}</span>
                    {form.services.length > 1 && <button type="button" onClick={() => removeService(i)} className="text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>}
                  </div>
                  <div className="space-y-3">
                    <div><label className="label">Service Name</label><input className="input" value={s.name} onChange={(e) => setService(i, { name: e.target.value })} placeholder="Oneway sightseeing" /></div>
                    {!quickAdd && (
                      <div>
                        <label className="label">Service Code Name <span className="label-optional">(optional)</span></label>
                        <input className="input" value={s.serviceCode} onChange={(e) => setService(i, { serviceCode: e.target.value })} placeholder="e.g. SUPPLIER OR SPECIFIC HIDDEN DETAILS" />
                        <p className="mt-1 text-xs text-slate-400">Attach a code for unique, non customer-shareable information.</p>
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div><label className="label">Distance (kms) <span className="label-optional">(optional)</span></label><input type="number" className="input" value={s.distanceKms} onChange={(e) => setService(i, { distanceKms: e.target.value })} /></div>
                      <div><label className="label">Start Time <span className="label-optional">(optional)</span></label><input className="input" value={s.startTime} onChange={(e) => setService(i, { startTime: e.target.value })} placeholder="e.g. 13:00" /><p className="mt-1 text-xs text-slate-400">Default start time for the service</p></div>
                      <div><label className="label">Duration (in mins) <span className="label-optional">(optional)</span></label><input type="number" className="input" value={s.durationMins} onChange={(e) => setService(i, { durationMins: e.target.value })} /></div>
                    </div>
                    {!quickAdd && (
                      <>
                        <div>
                          <label className="label">Closed on Days of Week <span className="label-optional">(optional)</span></label>
                          <DayPicker value={s.closedDays} onChange={(v) => setService(i, { closedDays: v })} />
                          <p className="mt-1 text-xs text-slate-400">Select the day(s) where this transport is closed or non-operational.</p>
                        </div>
                        <div>
                          <label className="label">Closed on Dates / Intervals</label>
                          <IntervalList value={s.closedDates} onChange={(v) => setService(i, { closedDates: v })} />
                          <p className="mt-1 text-xs text-slate-400">Select single date or intervals during which the transport is not operational.</p>
                        </div>
                      </>
                    )}
                    <div><label className="label">Description</label><textarea rows={3} className="input" value={s.description} onChange={(e) => setService(i, { description: e.target.value })} placeholder="Upon your arrival at Railway Station, your driver will escort you to your hotel..." /></div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={addService} className="btn-secondary text-sm"><Plus size={14} /> Add another service</button>
            </div>
          </FormSection>

          {/* Summary */}
          <div className="border-t border-slate-100 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Summary</p>
            <p className="mt-1 font-bold text-slate-900">{form.from ? `${form.from}${form.to ? ` → ${form.to}` : ''}` : '[Title]'}</p>
            <p className="text-sm text-slate-500">{services.length ? services.map((s) => s.name).join(' · ') : '[Itinerary]'}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <button type="submit" className="btn-primary px-8" disabled={saving}>{saving ? 'Saving…' : 'Save Service'}</button>
          <button type="button" onClick={() => navigate('/services/transport')} className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
        </div>
      </form>
    </div>
  );
}
