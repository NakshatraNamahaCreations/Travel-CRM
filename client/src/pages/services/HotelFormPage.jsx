import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, X, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { hotelsApi } from '../../api/services.js';
import { destinationsApi } from '../../api/masterData.js';
import { citiesApi, statesApi } from '../../api/locations.js';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import CreatableSelect from '../../components/form/CreatableSelect.jsx';
import FormSection from '../../components/form/FormSection.jsx';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';

const COUNTRY_CODES = [
  { code: '91', label: '91-IN' }, { code: '1', label: '1-US' }, { code: '44', label: '44-UK' }, { code: '971', label: '971-AE' },
];
const emptyGroup = () => ({ roomTypes: [], allowedExtraBeds: 0, rooms: '', aweb: 1, cweb: 1, cnb: 0 });
const emptyInterval = () => ({ start: '', end: '' });

const initial = {
  name: '', groupName: '', stars: 3, locationLabel: '', destinations: [],
  cityObj: null, stateObj: null, country: 'India', pin: '', street: '', locality: '', landmark: '',
  phones: [{ countryCode: '91', number: '' }], email: '',
  mealPlans: [], roomGroups: [emptyGroup()],
  applyRestrictionsToAll: true, restrictionRoomTypes: [], soldoutDates: [], blackoutDates: [],
  checkIn: '12:00', checkOut: '11:59', childFrom: 6, childTo: 12,
  paymentPreference: '', detailsLink: '',
};

function RequiredHint({ children }) {
  return <p className="mt-1 inline-block rounded-md bg-red-500 px-2 py-0.5 text-[11px] font-medium text-white">{children}</p>;
}

// Repeatable date-interval list (start → end)
function IntervalList({ value, onChange }) {
  const set = (i, patch) => onChange(value.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  return (
    <div className="space-y-2">
      {value.map((iv, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="date" className="input" value={iv.start} onChange={(e) => set(i, { start: e.target.value })} placeholder="DD MMM YY" />
          <span className="text-slate-400">→</span>
          <input type="date" className="input" value={iv.end} onChange={(e) => set(i, { end: e.target.value })} />
          <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500"><X size={16} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, emptyInterval()])} className="btn-secondary text-sm"><Plus size={14} /> Add {value.length ? 'More' : 'Date Intervals'}</button>
    </div>
  );
}

export default function HotelFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);

  const { data: existing } = useQuery({ queryKey: ['hotel', id], queryFn: () => hotelsApi.get(id), enabled: isEdit });

  useEffect(() => {
    if (!existing) return;
    const loc = existing.location || {};
    // reconstruct room groups: one per existing room type
    const roomGroups = existing.roomTypes?.length
      ? existing.roomTypes.map((r) => ({ roomTypes: [r.name], allowedExtraBeds: r.eb || 0, rooms: r.rooms || '', aweb: r.aweb || 0, cweb: r.cweb || 0, cnb: r.cnb || 0 }))
      : [emptyGroup()];
    const toDate = (d) => (d ? String(d).slice(0, 10) : '');
    setForm({
      name: existing.name || '', groupName: existing.groupName || '', stars: existing.stars || 3,
      locationLabel: loc.label || existing.locationLabel || '', destinations: existing.destinations || [],
      cityObj: existing.location?.cityRef ? { _id: String(existing.location.cityRef), name: loc.city || '' } : (loc.city ? { _id: loc.city, name: loc.city } : null),
      stateObj: existing.location?.stateRef ? { _id: String(existing.location.stateRef), name: loc.state || '' } : (loc.state ? { _id: loc.state, name: loc.state } : null),
      country: loc.country || 'India', pin: loc.pin || '',
      street: loc.street || existing.address || '', locality: loc.locality || '', landmark: loc.landmark || '',
      phones: existing.phones?.length ? existing.phones : [{ countryCode: '91', number: '' }], email: existing.email || '',
      mealPlans: existing.mealPlans || [], roomGroups,
      applyRestrictionsToAll: existing.applyRestrictionsToAll ?? true,
      restrictionRoomTypes: existing.restrictionRoomTypes || [],
      soldoutDates: (existing.soldoutDates || []).map((d) => ({ start: toDate(d.start), end: toDate(d.end) })),
      blackoutDates: (existing.blackoutDates || []).map((d) => ({ start: toDate(d.start), end: toDate(d.end) })),
      checkIn: existing.checkIn || '12:00', checkOut: existing.checkOut || '11:59',
      childFrom: existing.childEbAge?.from ?? 6, childTo: existing.childEbAge?.to ?? 12,
      paymentPreference: existing.paymentPreference || '', detailsLink: existing.detailsLink || '',
    });
  }, [existing]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setEvt = (k) => (e) => set(k)(e.target.value);
  const setGroup = (i, patch) => set('roomGroups')(form.roomGroups.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  const setPhone = (i, patch) => set('phones')(form.phones.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.locationLabel.trim()) return toast.error('Location is required');
    setSaving(true);
    try {
      const payload = {
        name: form.name, groupName: form.groupName || undefined, stars: Number(form.stars),
        location: {
          label: form.locationLabel,
          city: form.cityObj?.name || '',
          cityRef: form.cityObj?._id || undefined,
          state: form.stateObj?.name || '',
          stateRef: form.stateObj?._id || undefined,
          country: form.country, pin: form.pin,
          street: form.street, locality: form.locality, landmark: form.landmark,
        },
        address: form.street || undefined,
        destinations: form.destinations.map((d) => d._id),
        mealPlans: form.mealPlans,
        roomTypes: form.roomGroups.flatMap((g) => g.roomTypes.map((name) => ({ name, eb: Number(g.allowedExtraBeds) || 0, aweb: Number(g.aweb) || 0, cweb: Number(g.cweb) || 0, cnb: Number(g.cnb) || 0, rooms: Number(g.rooms) || 0 }))),
        applyRestrictionsToAll: form.applyRestrictionsToAll,
        restrictionRoomTypes: form.applyRestrictionsToAll ? [] : form.restrictionRoomTypes,
        soldoutDates: form.soldoutDates.filter((d) => d.start && d.end),
        blackoutDates: form.blackoutDates.filter((d) => d.start && d.end),
        checkIn: form.checkIn, checkOut: form.checkOut,
        childEbAge: { from: Number(form.childFrom), to: Number(form.childTo) },
        paymentPreference: form.paymentPreference || undefined,
        phones: form.phones.filter((p) => p.number.trim()), email: form.email || undefined,
        detailsLink: form.detailsLink || undefined,
      };
      const saved = isEdit ? await hotelsApi.update(id, payload) : await hotelsApi.create(payload);
      toast.success(isEdit ? 'Hotel updated' : 'Hotel created');
      navigate(`/services/hotels/${saved._id}`);
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
        <span className="font-semibold text-slate-900">{isEdit ? 'Edit Hotel' : 'New Hotel'}</span>
        <span className="text-slate-400">/</span>
        <Link to="/services/hotels" className="text-slate-500 hover:text-slate-800">Hotels</Link>
        {!isEdit && (
          <Link to="/services/hotels/upload" className="ml-auto flex items-center gap-1.5 font-medium text-brand-600 hover:text-brand-700">
            <UploadCloud size={16} /> Upload via CSV
          </Link>
        )}
      </div>

      <form onSubmit={submit} className="px-6 py-6">
        <div className="card px-6">
          <div className="flex justify-end pt-4">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              <input type="checkbox" checked={quickAdd} onChange={(e) => setQuickAdd(e.target.checked)} /> Quick Add
            </label>
          </div>

          {/* Basic Details */}
          <FormSection title="Basic Details" description="Provide basic details e.g. name, star rating and address.">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Name</label>
                <input className="input" placeholder="Taj Hotel" value={form.name} onChange={setEvt('name')} />
                {submitted && !form.name.trim() && <RequiredHint>Name field is required</RequiredHint>}
              </div>
              <div>
                <label className="label">Group Name <span className="label-optional">(optional)</span></label>
                <CreatableSelect category="hotelGroup" value={form.groupName} onChange={set('groupName')} placeholder="Type to search..." />
              </div>
              <div><label className="label">Stars</label><select className="input" value={form.stars} onChange={setEvt('stars')}>{[1, 2, 3, 4, 5].map((s) => <option key={s} value={s}>{s} Star</option>)}</select></div>
            </div>
            <div>
              <label className="label">Location</label>
              <input className="input" placeholder="e.g. City, State, Name" value={form.locationLabel} onChange={setEvt('locationLabel')} />
              <p className="mt-1 text-xs text-slate-400">Hotel's city location. Must match with uploaded data. Used during filters and quote sharing.</p>
              {submitted && !form.locationLabel.trim() && <RequiredHint>Please provide location for hotel</RequiredHint>}
            </div>
            <div>
              <label className="label">Trip Destinations</label>
              <AsyncSelect loadOptions={destinationsApi.search} value={form.destinations} onChange={set('destinations')} isMulti creatable onCreate={(name) => destinationsApi.create({ name })} placeholder="Type to search..." />
            </div>

            {!quickAdd && (
              <>
                <p className="text-sm font-medium text-slate-700">Please provide the full address details of the hotel which will be used in vouchers.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">City / Town / Island</label>
                    <AsyncSelect
                      loadOptions={(q) => citiesApi.search(q)}
                      value={form.cityObj}
                      onChange={(v) => {
                        set('cityObj')(v || null);
                        if (v?.state && !form.stateObj) set('stateObj')(v.state);
                      }}
                      creatable
                      onCreate={async (name) => { const c = await citiesApi.create({ name }); return { _id: c._id, name: c.name }; }}
                      placeholder="Type to search or add…"
                    />
                  </div>
                  <div>
                    <label className="label">State / Province / Region</label>
                    <AsyncSelect
                      loadOptions={(q) => statesApi.search(q)}
                      value={form.stateObj}
                      onChange={(v) => set('stateObj')(v || null)}
                      creatable
                      onCreate={async (name) => { const s = await statesApi.create({ name }); return { _id: s._id, name: s.name }; }}
                      placeholder="Type to search or add…"
                    />
                  </div>
                  <div><label className="label">Country</label><CreatableSelect category="country" value={form.country} onChange={set('country')} placeholder="Type to search..." /></div>
                  <div><label className="label">Pin Code</label><input className="input" placeholder="e.g. Area Code" value={form.pin} onChange={setEvt('pin')} /></div>
                  <div><label className="label">Street Address</label><input className="input" placeholder="Flat / House No. / Floor / Building" value={form.street} onChange={setEvt('street')} /></div>
                  <div><label className="label">Locality / Area</label><input className="input" placeholder="Colony / Street / Locality" value={form.locality} onChange={setEvt('locality')} /></div>
                </div>
                <div><label className="label">Landmark <span className="label-optional">(optional)</span></label><input className="input" placeholder="E.g. Behind Cinema" value={form.landmark} onChange={setEvt('landmark')} /></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Contact Number(s)</label>
                    <div className="space-y-2">
                      {form.phones.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <select className="input w-28" value={p.countryCode} onChange={(e) => setPhone(i, { countryCode: e.target.value })}>{COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select>
                          <input className="input flex-1" placeholder="e.g. 9779212232" value={p.number} onChange={(e) => setPhone(i, { number: e.target.value })} />
                          {i === form.phones.length - 1
                            ? <button type="button" onClick={() => set('phones')([...form.phones, { countryCode: '91', number: '' }])} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-brand-600"><Plus size={16} /></button>
                            : <button type="button" onClick={() => set('phones')(form.phones.filter((_, idx) => idx !== i))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-red-500"><X size={16} /></button>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div><label className="label">Email</label><input type="email" className="input" placeholder="contact@example.com" value={form.email} onChange={setEvt('email')} /></div>
                </div>
              </>
            )}
          </FormSection>

          {/* Services */}
          <FormSection title="Services" description="Meal plans and rooms along with check-in/out times and child's age range for extra bed.">
            <div><label className="label">Meal Plans</label><CreatableSelect category="mealPlan" isMulti value={form.mealPlans} onChange={set('mealPlans')} placeholder="Select meals..." /></div>

            <div>
              <p className="text-sm font-semibold text-slate-700">Room Types with Allowed Extra Bed(s)/Mattress(es)</p>
              <p className="mb-2 text-xs text-slate-400">Group room types that have the same number of allowed extra beds.</p>
              <div className="space-y-4">
                {form.roomGroups.map((g, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-1"><label className="label">Room Types</label><CreatableSelect category="roomType" isMulti value={g.roomTypes} onChange={(v) => setGroup(i, { roomTypes: v })} placeholder="Type to search..." /></div>
                      <div><label className="label">Allowed extra bed(s)</label><input type="number" className="input" value={g.allowedExtraBeds} onChange={(e) => setGroup(i, { allowedExtraBeds: e.target.value })} /></div>
                      <div><label className="label">No. of Rooms</label><input type="number" className="input" placeholder="e.g. 25" value={g.rooms} onChange={(e) => setGroup(i, { rooms: e.target.value })} /></div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-3">
                      <div><label className="label">AWEB(s)</label><input type="number" className="input" value={g.aweb} onChange={(e) => setGroup(i, { aweb: e.target.value })} /></div>
                      <div><label className="label">CWEB(s)</label><input type="number" className="input" value={g.cweb} onChange={(e) => setGroup(i, { cweb: e.target.value })} /></div>
                      <div><label className="label">CNB(s)</label><input type="number" className="input" placeholder="e.g. 0" value={g.cnb} onChange={(e) => setGroup(i, { cnb: e.target.value })} /></div>
                    </div>
                    {form.roomGroups.length > 1 && <button type="button" onClick={async () => { if (await confirm({ title: 'Remove this room group?', message: 'The selected room types and their extra-bed config will be removed.', confirmLabel: 'Remove' })) set('roomGroups')(form.roomGroups.filter((_, idx) => idx !== i)); }} className="btn-ghost mt-2 text-xs text-red-600"><Trash2 size={13} /> Remove group</button>}
                  </div>
                ))}
                <button type="button" onClick={() => set('roomGroups')([...form.roomGroups, emptyGroup()])} className="btn-secondary text-sm"><Plus size={14} /> Add Rooms with Different Extra Beds</button>
              </div>
            </div>
          </FormSection>

          {/* Stop Sale */}
          {!quickAdd && (
            <FormSection title="Stop Sale / Blackouts / Soldout Dates" description="Set the stop sell / blackout / soldout dates for the hotel.">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={form.applyRestrictionsToAll} onChange={(e) => set('applyRestrictionsToAll')(e.target.checked)} /> Apply the restrictions to all room types
              </label>
              {!form.applyRestrictionsToAll && (
                <div>
                  <label className="label">Room Types</label>
                  <CreatableSelect category="roomType" isMulti value={form.restrictionRoomTypes} onChange={set('restrictionRoomTypes')} placeholder="Type to search..." />
                  <p className="mt-1 text-xs text-slate-400">Restrictions below apply only to the selected room types.</p>
                </div>
              )}
              <div>
                <p className="mb-1 text-sm font-medium text-slate-700">
                  {form.applyRestrictionsToAll ? 'Block the quotation/bookings (soldout) for following dates' : 'Close on date intervals'}
                </p>
                <IntervalList value={form.soldoutDates} onChange={set('soldoutDates')} />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-slate-700">Make the rooms for high demand (blackouts), ask manual rates during quotation/bookings</p>
                <IntervalList value={form.blackoutDates} onChange={set('blackoutDates')} />
              </div>
            </FormSection>
          )}

          {/* Configuration */}
          <FormSection title="Configuration" description="Check-in/checkout time along with age of children for extra beds.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label">Checkin Time</label><input className="input" value={form.checkIn} onChange={setEvt('checkIn')} /></div>
              <div><label className="label">Checkout Time</label><input className="input" value={form.checkOut} onChange={setEvt('checkOut')} /></div>
            </div>
            <div>
              <label className="label">Children Age range for Charges on Child No Bed / Child Extra Bed/Mattress</label>
              <div className="flex items-center gap-2">
                <input type="number" className="input w-24" value={form.childFrom} onChange={setEvt('childFrom')} />
                <span className="text-slate-400">to</span>
                <input type="number" className="input w-24" value={form.childTo} onChange={setEvt('childTo')} />
              </div>
              <ul className="mt-2 ml-4 list-disc text-xs text-slate-500">
                <li>Below this range, children are counted as <b>complementary kids</b>.</li>
                <li>Above this range, children are counted as <b>Adults</b>.</li>
                <li>Between this range, charges for <b>no extra beds, extra beds or meal</b> will be applicable.</li>
              </ul>
            </div>
          </FormSection>

          {/* Payment + More */}
          <FormSection title="Payment Preferences" description="Select / create a payment preference by which this hotel accepts the payments.">
            <div><label className="label">Payment Preference <span className="label-optional">(optional)</span></label><CreatableSelect category="paymentPreference" value={form.paymentPreference} onChange={set('paymentPreference')} placeholder="Type to search..." /></div>
          </FormSection>
          <FormSection title="More Details" description="Attach more details such as hotel's details link etc.">
            <div><label className="label">Hotel Images / Details Link <span className="label-optional">(optional)</span></label><input className="input" placeholder="e.g. https://www.hotelname.com/images" value={form.detailsLink} onChange={setEvt('detailsLink')} /></div>
          </FormSection>
        </div>

        <div className="mt-6 flex items-center justify-center gap-4">
          <button type="submit" className="btn-primary px-8" disabled={saving}>{saving ? 'Saving…' : 'Save Hotel Details'}</button>
          <button type="button" onClick={() => navigate('/services/hotels')} className="text-sm font-medium text-slate-600 hover:text-slate-900">Cancel</button>
        </div>
      </form>
    </div>
  );
}
