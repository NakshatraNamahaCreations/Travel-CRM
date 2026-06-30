import { useState, useRef, useEffect } from 'react';
import { Hotel, Bus, Plus, Trash2, Copy, Sparkles, Star, ChevronDown, RefreshCw, AlertTriangle } from 'lucide-react';
import { addDays, format } from 'date-fns';
import toast from 'react-hot-toast';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import CreatableSelect from '../../components/form/CreatableSelect.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { hotelsApi } from '../../api/services.js';
import { lookupApi } from '../../api/quotes.js';
import { citiesApi } from '../../api/locations.js';
import { optionsApi } from '../../api/options.js';
import { hotelRowCost, hotelPerNight, computePackage, money } from '../../lib/pricing.js';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';
import { cn } from '../../lib/cn.js';

const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const emptyHotel = () => ({ nights: [1], hotel: null, hotelName: '', city: '', mealPlan: '', roomType: '', paxPerRoom: 2, rooms: 1, aweb: 0, cweb: 0, cnb: 0, ratePerNight: 0, awebRate: 0, cwebRate: 0, cnbRate: 0, cardRate: 0 });
const emptyTransport = (days = [1]) => ({ days, serviceLocation: '', serviceType: '', startTime: '', durationMins: 60, items: [{ type: '', qty: 1, rate: 0, given: 0 }] });
const emptySharedItem = () => ({ type: '', qty: 1 });

export default function PackageEditor({ pkg, onChange, nights, startDate, currency }) {
  const update = (patch) => onChange({ ...pkg, ...patch });
  const confirm = useConfirm();
  const [givenIdx, setGivenIdx] = useState(null);
  const c = computePackage(pkg);
  const hotelsTotal = (pkg.hotels || []).reduce((s, h) => s + hotelRowCost(h), 0);

  /* ----- Hotels ----- */
  const setHotel = (i, patch) => update({ hotels: pkg.hotels.map((h, idx) => (idx === i ? { ...h, ...patch } : h)) });
  const addHotel = () => update({ hotels: [...(pkg.hotels || []), emptyHotel()] });
  const dupHotel = (i) => update({ hotels: [...pkg.hotels, { ...pkg.hotels[i] }] });
  const rmHotel = async (i) => { if (await confirm({ title: 'Remove this hotel?', message: `${pkg.hotels[i]?.hotelName || 'This hotel'} will be removed from the package.`, confirmLabel: 'Remove' })) update({ hotels: pkg.hotels.filter((_, idx) => idx !== i) }); };
  const pickHotel = (i, h) => setHotel(i, { hotel: h, hotelName: h?.name || '', city: h?.location?.city || '', mealPlan: '', roomType: '', ratePerNight: 0 });

  const autoRate = async (i) => {
    const h = pkg.hotels[i];
    if (!h.hotel) return toast.error('Select a hotel first');
    const r = await lookupApi.hotelRate({ hotel: h.hotel._id, roomType: h.roomType, mealPlan: h.mealPlan, date: startDate });
    if (r) { setHotel(i, { cardRate: r.basePrice, ratePerNight: r.basePrice, awebRate: r.aweb, cwebRate: r.cweb, cnbRate: r.cwoeb }); toast.success(`Rate: ${money(r.basePrice, currency)}/night`); }
    else toast('No matching rate — enter manually', { icon: '✏️' });
  };

  const toggleNight = (i, n) => {
    const cur = pkg.hotels[i].nights || [];
    setHotel(i, { nights: cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort((a, b) => a - b) });
  };

  /* ----- Inclusions ----- */
  const setInc = (i, patch) => update({ inclusions: pkg.inclusions.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) });
  const addInc = () => update({ inclusions: [...(pkg.inclusions || []), { service: '', hotelName: '', night: 1, price: 0, comments: '' }] });
  const rmInc = (i) => update({ inclusions: pkg.inclusions.filter((_, idx) => idx !== i) });

  /* ----- Transports ----- */
  const [collapsedTr, setCollapsedTr] = useState({});
  const toggleTrOpen = (i) => setCollapsedTr((s) => ({ ...s, [i]: !s[i] }));
  const setTr = (i, patch) => update({ transports: pkg.transports.map((t, idx) => (idx === i ? { ...t, ...patch } : t)) });
  const addTr = () => { update({ transports: [...(pkg.transports || []), emptyTransport([(pkg.transports?.length || 0) + 1])] }); };
  const rmTr = async (i) => { if (await confirm({ title: 'Remove this day?', message: 'This transport day and its services will be removed from the package.', confirmLabel: 'Remove' })) update({ transports: pkg.transports.filter((_, idx) => idx !== i) }); };
  // Ensures t.items array is long enough, then patches index ii
  const setTrItem = (ti, ii, patch) => {
    const existing = pkg.transports[ti].items || [];
    const items = [...existing];
    while (items.length <= ii) items.push({ type: '', qty: 1, rate: 0, given: 0 });
    setTr(ti, { items: items.map((it, idx) => (idx === ii ? { ...it, ...patch } : it)) });
  };
  const addTrItem = (ti) => setTr(ti, { items: [...pkg.transports[ti].items, { type: '', qty: 1, rate: 0, given: 0 }] });
  const rmTrItem = (ti, ii) => setTr(ti, { items: pkg.transports[ti].items.filter((_, idx) => idx !== ii) });

  /* ----- Shared Cab Types ----- */
  const sharedItems = pkg.sharedCabItems || [emptySharedItem()];
  const setSharedItem = (ii, patch) => update({ sharedCabItems: sharedItems.map((it, idx) => (idx === ii ? { ...it, ...patch } : it)) });
  const addSharedItem = () => update({ sharedCabItems: [...sharedItems, emptySharedItem()] });
  const rmSharedItem = (ii) => update({ sharedCabItems: sharedItems.filter((_, idx) => idx !== ii) });
  const setSameCab = (v) => update({ sameCabType: v });

  /* ----- Extras ----- */
  const setExtra = (i, patch) => update({ extras: pkg.extras.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });
  const addExtra = () => update({ extras: [...(pkg.extras || []), { label: '', price: 0 }] });
  const rmExtra = (i) => update({ extras: pkg.extras.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-6">
      {/* Hotels */}
      <Section icon={Hotel} title="Hotels" hint="Please add hotels details (if included in package) with services provided for each hotels and the selling cost price.">
        <p className="mb-3 flex items-center gap-1 text-xs text-gray-400">
          <Sparkles size={12} className="text-amber-500" /> Tip: To speed up the process of adding multiple hotels, use <b className="font-semibold text-gray-600">Next Night</b> or <b className="font-semibold text-gray-600">Duplicate</b> actions.
        </p>
        <div className="space-y-4">
          {(pkg.hotels || []).map((h, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="label">Stay Nights</label>
                  <NightSelect nights={nights} startDate={startDate} value={h.nights || []} onToggle={(n) => toggleNight(i, n)} />
                </div>
                <div>
                  <label className="label">Hotel</label>
                  <AsyncSelect loadOptions={(s) => hotelsApi.list({ search: s }).then((r) => r.data)} value={h.hotel} onChange={(v) => pickHotel(i, v)} placeholder="Type to search..." />
                  {!h.hotel && <RequiredHint>Hotel field is required</RequiredHint>}
                </div>
                <div>
                  <label className="label">Meal Plan</label>
                  <CreatableSelect category="mealPlan" value={h.mealPlan} onChange={(v) => setHotel(i, { mealPlan: v })} placeholder="Type to search..." />
                  {!h.mealPlan && <RequiredHint>Meal Plan field is required</RequiredHint>}
                </div>
                <div>
                  <label className="label">Room Type</label>
                  <AsyncSelect
                    loadOptions={(s) => Promise.resolve((h.hotel?.roomTypes || []).filter((r) => r.name.toLowerCase().includes(s.toLowerCase())).map((r) => ({ _id: r.name, name: r.name })))}
                    value={h.roomType ? { _id: h.roomType, name: h.roomType } : null}
                    onChange={(v) => setHotel(i, { roomType: v ? v._id : '' })}
                    creatable
                    onCreate={async (name) => ({ _id: name, name })}
                    placeholder="Type to search..."
                  />
                  {!h.roomType && <RequiredHint>Room type field is required</RequiredHint>}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
                <Num label="Pax/room (WoEB)" value={h.paxPerRoom} onChange={(v) => setHotel(i, { paxPerRoom: v })} />
                <Num label="No. of rooms" value={h.rooms} onChange={(v) => setHotel(i, { rooms: v })} />
                <Num label="AWEB" value={h.aweb} onChange={(v) => setHotel(i, { aweb: v })} />
                <Num label="CWEB" value={h.cweb} onChange={(v) => setHotel(i, { cweb: v })} />
                <Num label="CNB" value={h.cnb} onChange={(v) => setHotel(i, { cnb: v })} />
                <div>
                  <label className="label">Comp Child</label>
                  <p className="pt-2.5 text-sm text-slate-600">Upto {h.hotel?.childEbAge?.from ?? 5}y</p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <button type="button" onClick={() => autoRate(i)} className="btn-secondary text-xs"><Sparkles size={13} /> Auto rate</button>
                <button type="button" onClick={() => dupHotel(i)} className="btn-ghost text-xs text-brand-700"><Plus size={12} /> Add Similar Hotels</button>
              </div>

              {/* Prices per night */}
              <div className="mt-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-700">Prices</p>
                  <button type="button" onClick={() => autoRate(i)} title="Refresh rates" className="text-slate-400 hover:text-brand-600"><RefreshCw size={13} /></button>
                </div>
                <div className="card card-flush overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
                      <tr><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Rate <span className="font-normal text-slate-400">(cost)</span></th><th className="px-3 py-2.5">Given <span className="font-normal text-slate-400">(selling)</span></th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(h.nights || []).map((n) => {
                        const dt = startDate ? addDays(new Date(startDate), n - 1) : null;
                        const given = hotelPerNight(h);
                        return (
                          <tr key={n}>
                            <td className="px-3 py-2.5">{dt ? format(dt, 'd MMM') : `Night ${n}`}<div className="text-xs text-slate-400">{dt ? format(dt, 'EEEE') : `${ordinal(n)} night`}</div></td>
                            <td className="px-3 py-2.5 text-slate-500 tabular-nums">{h.cardRate ? money(h.cardRate, currency) : 'N/A'}</td>
                            <td className="px-3 py-2.5">
                              <button type="button" onClick={() => setGivenIdx(i)} className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold tabular-nums ${given > 0 ? 'bg-brand-50 text-brand-700' : 'bg-amber-100 text-amber-700'}`}>
                                {given > 0 ? null : <AlertTriangle size={12} />} {money(given, currency)}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!(h.nights || []).length && <tr><td colSpan={3} className="px-3 py-3 text-center text-slate-400">Select stay night(s) above</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                <p className="text-sm"><span className="text-slate-500">Hotel cost: </span><span className="font-semibold text-slate-900 tabular-nums">{money(hotelRowCost(h), currency)}</span></p>
                <button type="button" onClick={() => rmHotel(i)} className="btn-secondary text-xs text-red-600"><Trash2 size={12} /> Remove</button>
              </div>
            </div>
          ))}

          {givenIdx != null && pkg.hotels[givenIdx] && (
            <GivenPriceModal hotel={pkg.hotels[givenIdx]} currency={currency} onClose={() => setGivenIdx(null)}
              onSave={(patch) => { setHotel(givenIdx, patch); setGivenIdx(null); }} />
          )}
          <button type="button" onClick={addHotel} className="btn-primary text-sm"><Plus size={14} /> Add Hotel</button>
        </div>

        {/* Inclusions */}
        <div className="mt-5 border-t border-gray-100 pt-4">
          <p className="text-sm font-semibold text-gray-700">Any special inclusions in hotels</p>
          <p className="mb-2 text-xs text-gray-400">Add any extra services for hotels e.g. special dinner, honeymoon cake etc.</p>
          <div className="space-y-2">
            {(pkg.inclusions || []).map((inc, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <input className="input col-span-3" placeholder="Service e.g. Candle Light Dinner" value={inc.service} onChange={(e) => setInc(i, { service: e.target.value })} />
                <input className="input col-span-3" placeholder="Hotel" value={inc.hotelName} onChange={(e) => setInc(i, { hotelName: e.target.value })} />
                <input type="number" className="input col-span-1" placeholder="Night" value={inc.night} onChange={(e) => setInc(i, { night: Number(e.target.value) })} />
                <input type="number" className="input col-span-2" placeholder="Price" value={inc.price} onChange={(e) => setInc(i, { price: Number(e.target.value) })} />
                <input className="input col-span-2" placeholder="Comments" value={inc.comments} onChange={(e) => setInc(i, { comments: e.target.value })} />
                <button type="button" onClick={() => rmInc(i)} className="col-span-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={addInc} className="btn-secondary text-sm"><Plus size={13} /> Add Service</button>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
            Accommodations Total: {hotelsTotal > 0 ? money(hotelsTotal, currency) : 'N/A'}
          </span>
        </div>
      </Section>

      {/* Transport & Activities */}
      <Section icon={Bus} title="Transports & Activities" hint="Add transfers and activities per day with selling price.">
        {/* Same Cab Type for All */}
        <div className={cn('mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3', pkg.sameCabType ? 'border-brand-200 bg-brand-50' : 'border-slate-200 bg-slate-50')}>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={!!pkg.sameCabType} onChange={(e) => setSameCab(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
            Same Cab Type for All
          </label>
          {pkg.sameCabType && (
            <div className="flex flex-wrap items-center gap-2">
              {sharedItems.filter((si) => si.type).map((si, ii) => (
                <span key={ii} className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1 text-sm font-medium text-brand-700">
                  {si.qty} - {si.type}
                </span>
              ))}
              <button
                type="button"
                onClick={() => {
                  const next = sharedItems.length ? [...sharedItems] : [emptySharedItem()];
                  update({ sharedCabItems: next, _editShared: true });
                }}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-500 hover:bg-slate-50"
              >
                ✏️ Edit
              </button>
            </div>
          )}
        </div>

        {/* Shared cab editor (inline, shown when editing) */}
        {pkg.sameCabType && pkg._editShared && (
          <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase text-brand-600 mb-2">Set Cab Types</p>
            {sharedItems.map((si, ii) => (
              <div key={ii} className="flex items-center gap-2">
                <div className="flex-1">
                  <AsyncSelect
                    loadOptions={(q) => optionsApi.search('vehicleType', q).then((r) => r.map((o) => ({ _id: o.value, name: o.value })))}
                    value={si.type ? { _id: si.type, name: si.type } : null}
                    onChange={(v) => setSharedItem(ii, { type: v ? v.name : '' })}
                    creatable onCreate={(name) => Promise.resolve({ _id: name, name })}
                    placeholder="17 Seater Tempo Traveller"
                  />
                </div>
                <input type="number" className="input w-20" placeholder="Qty" value={si.qty} onChange={(e) => setSharedItem(ii, { qty: Number(e.target.value) })} />
                {sharedItems.length > 1 && <button type="button" onClick={() => rmSharedItem(ii)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>}
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={addSharedItem} className="btn-secondary text-xs"><Plus size={12} /> Add More</button>
              <button type="button" onClick={() => update({ _editShared: false })} className="btn-primary text-xs">Set Cab Types</button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {(pkg.transports || []).map((t, ti) => {
            const tDays = Array.isArray(t.days) ? t.days : (t.day ? [t.day] : [1]);
            const dayOptions = Array.from({ length: nights || 1 }, (_, i) => ({
              n: i + 1,
              label: startDate ? `${ordinal(i + 1)} Day (${format(addDays(new Date(startDate), i), 'EEE d MMM')})` : `Day ${i + 1}`,
            }));
            const cabItems = pkg.sameCabType ? sharedItems : (t.items || []);
            const firstDay = tDays[0] || 1;
            const firstDate = startDate ? format(addDays(new Date(startDate), firstDay - 1), 'EEEE, d MMM') : `Day ${firstDay}`;

            return (
              <div key={ti} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                {/* Card label */}
                <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2">
                  <Bus size={14} className="text-brand-500" />
                  <span className="text-xs font-semibold text-brand-600">Transport Service</span>
                </div>

                <div className="flex gap-0 divide-x divide-gray-100">
                  {/* LEFT: Days */}
                  <div className="w-44 shrink-0 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Days</p>
                    {dayOptions.length ? (
                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                        {dayOptions.map(({ n, label }) => (
                          <label key={n} className={cn('flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors', tDays.includes(n) ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50')}>
                            <input
                              type="checkbox"
                              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-brand-600"
                              checked={tDays.includes(n)}
                              onChange={() => {
                                const next = tDays.includes(n) ? tDays.filter((d) => d !== n) : [...tDays, n].sort((a, b) => a - b);
                                setTr(ti, { days: next.length ? next : [n] });
                              }}
                            />
                            {label}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Select day(s)…</p>
                    )}
                  </div>

                  {/* MIDDLE: Service details */}
                  <div className="flex-1 p-4 space-y-3">
                    <div>
                      <label className="label">Service Locations</label>
                      <AsyncSelect
                        loadOptions={(q) => citiesApi.search(q)}
                        value={t.serviceLocation ? { _id: t.serviceLocation, name: t.serviceLocation } : null}
                        onChange={(v) => setTr(ti, { serviceLocation: v ? v.name : '' })}
                        creatable onCreate={(name) => Promise.resolve({ _id: name, name })}
                        placeholder="Port Blair to Havelock"
                      />
                    </div>
                    <div>
                      <label className="label">Service Type</label>
                      <input className="input" placeholder="Transfer and Radhanagar Beach" value={t.serviceType} onChange={(e) => setTr(ti, { serviceType: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Start Time</label>
                        <input className="input" placeholder="14:00" value={t.startTime} onChange={(e) => setTr(ti, { startTime: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">Duration (Mins)</label>
                        <input type="number" className="input" placeholder="60 Mins" value={t.durationMins} onChange={(e) => setTr(ti, { durationMins: Number(e.target.value) })} />
                      </div>
                    </div>
                    {/* sub-actions */}
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={addTr} className="btn-secondary text-xs"><Plus size={12} /> Transport Service</button>
                    </div>
                  </div>

                  {/* RIGHT: Transportation and Prices */}
                  <div className="w-80 shrink-0 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-700">Transportation and Prices{firstDate ? ` — ${firstDate}` : ''}</p>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="pb-1 text-left font-semibold">Transportation</th>
                          <th className="pb-1 text-left font-semibold w-16">Rate</th>
                          <th className="pb-1 text-left font-semibold w-16">Given</th>
                          <th className="w-5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {cabItems.map((cabIt, ii) => {
                          // Per-transport rate/given (always from t.items)
                          const priceIt = (t.items || [])[ii] || {};
                          return (
                            <tr key={ii}>
                              <td className="py-1.5 pr-2">
                                {pkg.sameCabType ? (
                                  <span className="text-slate-700">{cabIt.qty > 1 ? `${cabIt.qty} - ` : ''}{cabIt.type || '—'}</span>
                                ) : (
                                  <AsyncSelect
                                    loadOptions={(q) => optionsApi.search('vehicleType', q).then((r) => r.map((o) => ({ _id: o.value, name: o.value })))}
                                    value={cabIt.type ? { _id: cabIt.type, name: cabIt.type } : null}
                                    onChange={(v) => setTrItem(ti, ii, { type: v ? v.name : '' })}
                                    creatable onCreate={(name) => Promise.resolve({ _id: name, name })}
                                    placeholder="Cab type…"
                                  />
                                )}
                              </td>
                              <td className="py-1.5 pr-1">
                                <input
                                  type="number"
                                  className="input w-16 text-xs"
                                  placeholder="0"
                                  value={priceIt.rate ?? ''}
                                  onChange={(e) => setTrItem(ti, ii, { rate: Number(e.target.value) })}
                                />
                              </td>
                              <td className="py-1.5">
                                <input
                                  type="number"
                                  className="input w-16 text-xs"
                                  placeholder="0"
                                  value={priceIt.given ?? ''}
                                  onChange={(e) => setTrItem(ti, ii, { given: Number(e.target.value) })}
                                />
                              </td>
                              <td className="py-1.5 pl-1 text-center">
                                {!pkg.sameCabType && (t.items || []).length > 1 && (
                                  <button type="button" onClick={() => rmTrItem(ti, ii)} className="text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!pkg.sameCabType && (
                      <button type="button" onClick={() => addTrItem(ti)} className="mt-2 btn-secondary text-xs"><Plus size={11} /> Add Item</button>
                    )}
                  </div>
                </div>

                {/* Card footer */}
                <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-4 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      const usedDays = new Set((pkg.transports || []).flatMap((tr) => Array.isArray(tr.days) ? tr.days : [tr.day || 1]));
                      const nextDay = Array.from({ length: nights || 1 }, (_, i) => i + 1).find((d) => !usedDays.has(d)) || ((pkg.transports?.length || 0) + 1);
                      update({ transports: [...(pkg.transports || []), emptyTransport([nextDay])] });
                    }}
                    className="btn-secondary text-xs"
                  >
                    <Plus size={12} /> Next Day
                  </button>
                  <button type="button" onClick={() => rmTr(ti)} className="text-xs font-medium text-red-500 hover:text-red-700">✕ Remove</button>
                </div>
              </div>
            );
          })}
          <button type="button" onClick={addTr} className="btn-primary text-sm"><Plus size={14} /> Add Day / Service</button>
        </div>
      </Section>

      {/* Extras */}
      <Section icon={Star} title="Other Services" hint="Any other services or add-ons for this package.">
        <div className="space-y-2">
          {(pkg.extras || []).map((e, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <input className="input col-span-8" placeholder="Service label" value={e.label} onChange={(ev) => setExtra(i, { label: ev.target.value })} />
              <input type="number" className="input col-span-3" placeholder="Price" value={e.price} onChange={(ev) => setExtra(i, { price: Number(ev.target.value) })} />
              <button type="button" onClick={() => rmExtra(i)} className="col-span-1 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" onClick={addExtra} className="btn-secondary text-sm"><Plus size={13} /> Add Service</button>
        </div>
      </Section>

      {/* Markup / Tax / Rounding table */}
      <Section title="Set Markup, Tax and Rounding">
        <div className="card card-flush overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-100 text-left align-bottom text-xs font-semibold text-slate-600">
              <tr>
                <th className="px-3 py-2.5">Cost Price ({currency})</th>
                <th className="px-3 py-2.5">
                  <div className="mb-1 text-center">Markup</div>
                  <select className="input" value={pkg.markupType} onChange={(e) => update({ markupType: e.target.value })}>
                    <option value="percent">Percentage</option><option value="flat">Flat</option>
                  </select>
                </th>
                <th className="px-3 py-2.5">
                  <div className="mb-1 text-center">Tax Applied On</div>
                  <select className="input" value={pkg.taxOn || 'cost_markup'} onChange={(e) => update({ taxOn: e.target.value })} disabled={!pkg.taxApplied}>
                    <option value="cost_markup">Cost + Markup</option><option value="markup">Only Markup</option>
                  </select>
                </th>
                <th className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    <input type="checkbox" checked={!!pkg.taxApplied} onChange={(e) => update({ taxApplied: e.target.checked })} />
                    <select className="input w-[4.5rem]" value={pkg.taxName || 'GST'} onChange={(e) => update({ taxName: e.target.value })} disabled={!pkg.taxApplied}>
                      {['GST', 'IGST', 'CGST', 'VAT'].map((t) => <option key={t}>{t}</option>)}
                    </select>
                    <input type="number" className="input w-14" value={pkg.taxPercent} onChange={(e) => update({ taxPercent: Number(e.target.value) })} disabled={!pkg.taxApplied} />
                    <span className="text-slate-400">%</span>
                  </div>
                </th>
                <th className="px-3 py-2.5 text-right">Total ({currency})</th>
                <th className="px-3 py-2.5 text-center">
                  <div className="mb-1">Round</div>
                  <select className="input w-16" value={pkg.rounding || 1} onChange={(e) => update({ rounding: Number(e.target.value) || 1 })}>
                    {[1, 5, 10, 50, 100].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-amber-50/50 align-middle font-medium">
                <td className="px-3 py-3 italic text-slate-500">Total</td>
                <td className="px-3 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <input type="number" className="input w-24 text-center" value={pkg.markupValue} onChange={(e) => update({ markupValue: Number(e.target.value) })} />
                    {pkg.markupType === 'percent' && <span className="text-slate-400">%</span>}
                  </div>
                  <div className="mt-1 text-center text-xs text-slate-400">= {money(c.markupAmount, currency)}</div>
                </td>
                <td className="px-3 py-3 text-center text-slate-600">{pkg.taxOn === 'markup' ? 'Only Markup' : 'Cost + Markup'}</td>
                <td className="px-3 py-3 text-center tabular-nums">{money(c.taxAmount, currency)}</td>
                <td className="px-3 py-3 text-right text-base font-bold tabular-nums text-slate-900">{money(c.costPrice + c.markupAmount + c.taxAmount, currency)}</td>
                <td className="px-3 py-3 text-center text-base font-bold tabular-nums text-slate-900">{money(c.sellingPrice, currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Any internal comments regarding selling price <span className="label-optional">(optional)</span></label>
            <textarea rows={2} className="input" value={pkg.internalComments || ''} onChange={(e) => update({ internalComments: e.target.value })} />
          </div>
          <div>
            <label className="label">Remarks for Agent/Customer <span className="label-optional">(optional)</span></label>
            <textarea rows={2} className="input" placeholder="Any special remarks for the customer." value={pkg.customerRemarks || ''} onChange={(e) => update({ customerRemarks: e.target.value })} />
            <p className="mt-1 text-xs text-slate-400">These remarks will be shared with the customer.</p>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ icon: Icon, title, hint, children }) {
  return (
    <div className="border-t border-gray-100 pt-5 first:border-0 first:pt-0">
      <div className="mb-3 flex items-center gap-2">
        {Icon && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Icon size={15} /></span>}
        <div><h4 className="font-semibold text-gray-900">{title}</h4>{hint && <p className="text-xs text-gray-400">{hint}</p>}</div>
      </div>
      {children}
    </div>
  );
}

function Num({ label, value, onChange }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" className="input" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function RequiredHint({ children }) {
  return <p className="mt-1 inline-block rounded-md bg-red-500 px-2 py-0.5 text-[11px] font-medium text-white">{children}</p>;
}

// Per-component selling-price editor (matches Sembark's "Given Price" modal).
function GivenPriceModal({ hotel, currency, onClose, onSave }) {
  const [v, setV] = useState({
    room: hotel.ratePerNight || 0, aweb: hotel.awebRate || 0, cweb: hotel.cwebRate || 0, cnb: hotel.cnbRate || 0,
  });
  const rows = [
    { key: 'room', label: `/Room (${hotel.paxPerRoom || 2}P)`, qty: hotel.rooms || 0 },
    { key: 'aweb', label: '/AWEB', qty: hotel.aweb || 0 },
    { key: 'cweb', label: '/CWEB', qty: hotel.cweb || 0 },
    { key: 'cnb', label: '/CNB', qty: hotel.cnb || 0 },
  ];
  const total = rows.reduce((s, r) => s + (Number(v[r.key]) || 0) * r.qty, 0);
  return (
    <Modal open onClose={onClose} title="Given Price" width="max-w-lg">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500">
          <tr><th className="py-2" /><th className="py-2 text-center">Price ({currency})</th><th className="py-2 text-center">Quantity</th><th className="py-2 text-right">Total</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="py-2.5 font-medium text-slate-800">{r.label}</td>
              <td className="py-2.5 text-center"><input type="number" className="input mx-auto w-28 text-center" value={v[r.key]} onChange={(e) => setV((s) => ({ ...s, [r.key]: e.target.value }))} /></td>
              <td className="py-2.5 text-center text-slate-600 tabular-nums">{r.qty}</td>
              <td className="py-2.5 text-right tabular-nums">{r.qty ? money((Number(v[r.key]) || 0) * r.qty, currency) : '—'}</td>
            </tr>
          ))}
          <tr className="border-t border-slate-200 font-bold text-slate-900"><td className="py-2.5 text-right" colSpan={3}>Total</td><td className="py-2.5 text-right tabular-nums">{money(total, currency)}</td></tr>
        </tbody>
      </table>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={() => onSave({ ratePerNight: Number(v.room) || 0, awebRate: Number(v.aweb) || 0, cwebRate: Number(v.cweb) || 0, cnbRate: Number(v.cnb) || 0 })} className="btn-primary">Save</button>
      </div>
    </Modal>
  );
}

// Multi-select dropdown of nights with dated labels — "1st N (Thu 25 Jun)".
function NightSelect({ nights, startDate, value, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const opts = Array.from({ length: Math.max(1, nights) }, (_, i) => i + 1);
  const label = (n) => {
    if (startDate) { const dt = addDays(new Date(startDate), n - 1); return `${ordinal(n)} N (${format(dt, 'EEE d MMM')})`; }
    return `${ordinal(n)} N`;
  };
  const summary = value.length ? value.map((n) => `${ordinal(n)} N`).join(', ') : '';
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-200">
        <span className={summary ? 'truncate text-slate-800' : 'text-slate-400'}>{summary || 'Select night(s)...'}</span>
        <ChevronDown size={16} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 max-h-56 w-full animate-scale-in overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {opts.map((n) => (
            <label key={n} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <input type="checkbox" checked={value.includes(n)} onChange={() => onToggle(n)} />
              {label(n)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
