import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, MapPin, Users, Ticket } from 'lucide-react';
import toast from 'react-hot-toast';
import { activitiesApi } from '../../api/services.js';
import { destinationsApi } from '../../api/masterData.js';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import FormSection from '../../components/form/FormSection.jsx';
import { LocationList, DayPicker, IntervalList } from '../../components/form/Repeaters.jsx';

const DURATION_UNITS = ['mins', 'hours', 'days'];
const emptyTicket = () => ({ name: '', internalRefCode: '', slots: '', duration: '', durationUnit: 'mins', details: '', closedDays: [], closedDates: [] });

export default function ActivityFormPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [form, setForm] = useState({
    name: '',
    details: '',
    destinations: [],
    useSamePickDrop: true,
    pickupLocations: [''],
    dropLocations: [''],
    useCheckinAsPickup: false,
    useCheckinAsDrop: false,
    ageConfig: 'Adult, Child (6-12)',
    complimentaryAge: '',
    useSameClosing: true,
    closedDays: [],
    closedDates: [],
    ticketTypes: [emptyTicket()],
  });

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setEvt = (k) => (e) => set(k)(e.target.value);
  const setTicket = (i, patch) => set('ticketTypes')(form.ticketTypes.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const addTicket = () => set('ticketTypes')([...form.ticketTypes, emptyTicket()]);
  const removeTicket = (i) => set('ticketTypes')(form.ticketTypes.filter((_, idx) => idx !== i));

  const tickets = form.ticketTypes.filter((t) => t.name.trim());

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Activity name is required');
    setSaving(true);
    try {
      const saved = await activitiesApi.create({
        name: form.name,
        details: form.details || undefined,
        destinations: form.destinations.map((d) => d._id),
        useSamePickDrop: form.useSamePickDrop,
        pickupLocations: form.pickupLocations.filter((x) => x.trim()),
        dropLocations: form.dropLocations.filter((x) => x.trim()),
        useCheckinAsPickup: form.useCheckinAsPickup,
        useCheckinAsDrop: form.useCheckinAsDrop,
        ageConfig: form.ageConfig,
        complimentaryAge: form.complimentaryAge !== '' ? Number(form.complimentaryAge) : undefined,
        useSameClosing: form.useSameClosing,
        closedDays: form.useSameClosing ? form.closedDays : [],
        closedDates: form.useSameClosing ? form.closedDates.filter((d) => d.start && d.end) : [],
        ticketTypes: tickets.map((t) => ({
          name: t.name,
          internalRefCode: t.internalRefCode || undefined,
          slots: t.slots || undefined,
          duration: t.duration !== '' ? Number(t.duration) : undefined,
          durationUnit: t.durationUnit,
          details: t.details || undefined,
          closedDays: form.useSameClosing ? [] : t.closedDays,
          closedDates: form.useSameClosing ? [] : t.closedDates.filter((d) => d.start && d.end),
        })),
      });
      toast.success('Activity created');
      navigate(`/services/activities/${saved._id}`);
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
        <span className="font-semibold text-slate-900">New Travel Activity</span>
        <span className="text-slate-400">/</span>
        <Link to="/services/activities" className="text-slate-500 hover:text-slate-800">Travel Activities</Link>
      </div>

      <form onSubmit={submit} className="mx-auto max-w-5xl px-6 py-6">
        <div className="card px-6">
          <div className="flex justify-end pt-4">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              <input type="checkbox" checked={quickAdd} onChange={(e) => setQuickAdd(e.target.checked)} /> Quick Add
            </label>
          </div>

          {/* Activity Details */}
          <FormSection icon={MapPin} title="Activity Details" description="Please provide basic details regarding the activity.">
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={setEvt('name')} placeholder="e.g. Port Blair To Havelock : Private Catamaran Ferry" /></div>
            {!quickAdd && (
              <div><label className="label">Itinerary/Details <span className="label-optional">(optional)</span></label><textarea rows={3} className="input" value={form.details} onChange={setEvt('details')} placeholder="Some details regarding the activity" /></div>
            )}

            {!quickAdd && (
              <>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={form.useSamePickDrop} onChange={(e) => set('useSamePickDrop')(e.target.checked)} /> Use same pick-up/drop point for All Services
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="label">Pick Up Locations <span className="label-optional">(optional)</span></label><LocationList value={form.pickupLocations} onChange={set('pickupLocations')} placeholder="Type to search..." /></div>
                  <div><label className="label">Drop Locations <span className="label-optional">(optional)</span></label><LocationList value={form.dropLocations} onChange={set('dropLocations')} placeholder="Type to search..." /></div>
                </div>
                <div className="flex flex-wrap gap-5">
                  <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.useCheckinAsPickup} onChange={(e) => set('useCheckinAsPickup')(e.target.checked)} /> Use Check-in Hotel as Pickup</label>
                  <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.useCheckinAsDrop} onChange={(e) => set('useCheckinAsDrop')(e.target.checked)} /> Use Check-in Hotel as Drop</label>
                </div>
              </>
            )}

            <div><label className="label">Trip Destinations</label>
              <AsyncSelect loadOptions={destinationsApi.search} value={form.destinations} onChange={set('destinations')} isMulti creatable onCreate={(name) => destinationsApi.create({ name })} placeholder="Type to search..." />
            </div>
          </FormSection>

          {/* Tourist Age & Closing */}
          <FormSection icon={Users} title="Tourist Age and Group Configurations and Closing Day/Dates" description="Please provide tourist age and group configuration for tickets available in this activity e.g. Adult, Child(3-5), Child(6-12), Group (8 Pax) (2y+).">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Tourist Age Configuration</label><input className="input" value={form.ageConfig} onChange={setEvt('ageConfig')} placeholder="Adult, Child (6-12)" /></div>
              <div><label className="label">Complimentary Age <span className="label-optional">(optional)</span></label><input type="number" min="0" className="input" value={form.complimentaryAge} onChange={setEvt('complimentaryAge')} placeholder="e.g. 4" /></div>
            </div>

            {!quickAdd && (
              <>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={form.useSameClosing} onChange={(e) => set('useSameClosing')(e.target.checked)} /> Use same closing days/dates for All Ticket Types
                </label>
                {form.useSameClosing && (
                  <>
                    <div>
                      <label className="label">Closed on Days of Week <span className="label-optional">(optional)</span></label>
                      <DayPicker value={form.closedDays} onChange={set('closedDays')} />
                      <p className="mt-1 text-xs text-slate-400">Select the day(s) of week where this activity is closed or non-operational.</p>
                    </div>
                    <div>
                      <label className="label">Closed on Dates / Intervals</label>
                      <IntervalList value={form.closedDates} onChange={set('closedDates')} />
                      <p className="mt-1 text-xs text-slate-400">Select single date or intervals during which the activity/tickets are not operational.</p>
                    </div>
                  </>
                )}
              </>
            )}
          </FormSection>

          {/* Ticket Types */}
          <FormSection icon={Ticket} title="Ticket Type / Packages" description="Please provide the ticket types or packages available for this activity.">
            <div className="space-y-4">
              {form.ticketTypes.map((t, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2">
                    <div className="flex-1"><label className="label">Name</label><input className="input" value={t.name} onChange={(e) => setTicket(i, { name: e.target.value })} placeholder="e.g. Premium" /></div>
                    {form.ticketTypes.length > 1 && <button type="button" onClick={() => removeTicket(i)} className="mt-6 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>}
                  </div>

                  {!quickAdd && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div><label className="label">Internal Ref Code <span className="label-optional">(optional)</span></label><input className="input" value={t.internalRefCode} onChange={(e) => setTicket(i, { internalRefCode: e.target.value })} placeholder="e.g. 1PXABC" /></div>
                      <div><label className="label">Slots <span className="label-optional">(optional)</span></label><input className="input" value={t.slots} onChange={(e) => setTicket(i, { slots: e.target.value })} placeholder="11:00, 13:00" /></div>
                      <div>
                        <label className="label">Duration <span className="label-optional">(optional)</span></label>
                        <div className="flex gap-2">
                          <input type="number" min="0" className="input" value={t.duration} onChange={(e) => setTicket(i, { duration: e.target.value })} placeholder="30" />
                          <select className="input w-28" value={t.durationUnit} onChange={(e) => setTicket(i, { durationUnit: e.target.value })}>
                            {DURATION_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-3"><label className="label">Itinerary/Details <span className="label-optional">(optional)</span></label><textarea rows={2} className="input" value={t.details} onChange={(e) => setTicket(i, { details: e.target.value })} placeholder="Some details regarding this ticket type" /></div>

                  {!quickAdd && !form.useSameClosing && (
                    <div className="mt-3 grid gap-3">
                      <div>
                        <label className="label">Closed on Days of Week <span className="label-optional">(optional)</span></label>
                        <DayPicker value={t.closedDays} onChange={(v) => setTicket(i, { closedDays: v })} />
                      </div>
                      <div>
                        <label className="label">Closed on Dates / Intervals</label>
                        <IntervalList value={t.closedDates} onChange={(v) => setTicket(i, { closedDates: v })} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <button type="button" onClick={addTicket} className="btn-secondary text-sm"><Plus size={14} /> Add More Ticket/Package Types</button>
            </div>
          </FormSection>

          {/* Summary */}
          <div className="border-t border-slate-100 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Summary</p>
            <p className="mt-1 font-bold text-slate-900">{form.name.trim() || '[Title]'}</p>
            <p className="text-sm text-slate-500">{tickets.length ? tickets.map((t) => t.name).join(' · ') : '[Ticket itinerary]'}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <button type="submit" className="btn-primary px-8" disabled={saving}>{saving ? 'Saving…' : 'Save Details'}</button>
          <button type="button" onClick={() => navigate('/services/activities')} className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
        </div>
      </form>
    </div>
  );
}
