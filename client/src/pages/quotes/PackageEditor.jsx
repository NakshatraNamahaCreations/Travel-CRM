import { useState, useRef, useEffect } from 'react';
import { Hotel, Bus, Plus, Trash2, Copy, Sparkles, Star, ChevronDown, RefreshCw, AlertTriangle, Ticket } from 'lucide-react';
import { addDays, format } from 'date-fns';
import toast from 'react-hot-toast';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import CreatableSelect from '../../components/form/CreatableSelect.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { hotelsApi, transportApi, activitiesApi } from '../../api/services.js';
import { lookupApi } from '../../api/quotes.js';
import { optionsApi } from '../../api/options.js';
import { hotelRowCost, hotelPerNight, computePackage, money } from '../../lib/pricing.js';
import { useConfirm } from '../../components/ui/ConfirmProvider.jsx';
import { cn } from '../../lib/cn.js';

const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const emptyHotel = () => ({ nights: [1], hotel: null, hotelName: '', city: '', mealPlan: '', roomType: '', paxPerRoom: 2, rooms: 1, aweb: 0, cweb: 0, cnb: 0, ratePerNight: 0, awebRate: 0, cwebRate: 0, cnbRate: 0, cardRate: 0 });
const emptyTransport = (days = [1]) => ({ days, serviceLocation: '', serviceType: '', startTime: '', durationMins: 60, items: [{ type: '', qty: 1, rate: 0, given: 0 }] });
const emptyActivity = (days = [1]) => ({ days, activity: null, name: '', ticketType: '', slot: '', durationMins: 60, items: [] });
const emptySharedItem = () => ({ type: '', qty: 1 });

export default function PackageEditor({ pkg, onChange, nights, startDate, currency, pax }) {
  const update = (patch) => onChange({ ...pkg, ...patch });
  const confirm = useConfirm();
  const [givenIdx, setGivenIdx] = useState(null);
  const c = computePackage(pkg);
  const hotelsTotal = (pkg.hotels || []).reduce((s, h) => s + hotelRowCost(h), 0);

  /* ----- Hotels ----- */
  const setHotel = (i, patch) => update({ hotels: pkg.hotels.map((h, idx) => (idx === i ? { ...h, ...patch } : h)) });
  // New rows start on the first night nobody has claimed yet (empty if all taken).
  const addHotel = () => {
    const used = new Set((pkg.hotels || []).flatMap((x) => x.nights || []));
    const free = Array.from({ length: Math.max(1, nights) }, (_, k) => k + 1).find((n) => !used.has(n));
    update({ hotels: [...(pkg.hotels || []), { ...emptyHotel(), nights: free ? [free] : [] }] });
  };
  // Nights already assigned to OTHER hotel rows — one hotel per night.
  const nightsTakenByOthers = (i) => (pkg.hotels || []).flatMap((x, idx) => (idx === i ? [] : (x.nights || [])));
  // Every night of the trip already belongs to a hotel row — no more rows needed.
  const allNightsTaken = (() => {
    const used = new Set((pkg.hotels || []).flatMap((x) => x.nights || []));
    return Array.from({ length: Math.max(1, nights) }, (_, k) => k + 1).every((n) => used.has(n));
  })();
  // Duplicate copies the config but not the nights (each night belongs to one row).
  const dupHotel = (i) => update({ hotels: [...pkg.hotels, { ...pkg.hotels[i], nights: [] }] });
  // Next Night: same hotel/config on the first night nobody has claimed yet.
  const nextNight = (i) => {
    const used = new Set((pkg.hotels || []).flatMap((x) => x.nights || []));
    const free = Array.from({ length: Math.max(1, nights) }, (_, k) => k + 1).find((n) => !used.has(n));
    if (!free) return toast.error('All nights are already assigned to a hotel');
    update({ hotels: [...pkg.hotels, { ...pkg.hotels[i], nights: [free] }] });
  };
  const rmHotel = async (i) => { if (await confirm({ title: 'Remove this hotel?', message: `${pkg.hotels[i]?.hotelName || 'This hotel'} will be removed from the package.`, confirmLabel: 'Remove' })) update({ hotels: pkg.hotels.filter((_, idx) => idx !== i) }); };
  const pickHotel = (i, h) => setHotel(i, { hotel: h, hotelName: h?.name || '', city: h?.location?.city || '', mealPlan: '', roomType: '', ratePerNight: 0 });

  const autoRate = async (i) => {
    const h = pkg.hotels[i];
    if (!h.hotel) return toast.error('Select a hotel first');
    const r = await lookupApi.hotelRate({ hotel: h.hotel?._id || h.hotel, roomType: h.roomType, mealPlan: h.mealPlan, date: startDate });
    if (r) { setHotel(i, { cardRate: r.basePrice, ratePerNight: r.basePrice, awebRate: r.aweb, cwebRate: r.cweb, cnbRate: r.cwoeb }); toast.success(`Rate: ${money(r.basePrice, currency)}/night`); }
    else toast('No matching rate — enter manually', { icon: '✏️' });
  };

  const toggleNight = (i, n) => {
    const cur = pkg.hotels[i].nights || [];
    if (!cur.includes(n) && nightsTakenByOthers(i).includes(n)) {
      return toast.error(`${ordinal(n)} night is already assigned to another hotel`);
    }
    setHotel(i, { nights: cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n].sort((a, b) => a - b) });
  };

  /* ----- Inclusions ----- */
  const setInc = (i, patch) => update({ inclusions: pkg.inclusions.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) });
  const addInc = () => update({ inclusions: [...(pkg.inclusions || []), { service: '', hotelName: '', night: 0, price: 0, comments: '' }] });
  const rmInc = (i) => update({ inclusions: pkg.inclusions.filter((_, idx) => idx !== i) });

  // Hotel options for inclusion rows: hotels already in this package first, then the master list.
  const inclusionHotelOptions = (q) => {
    const term = (q || '').toLowerCase();
    const inPkg = [...new Set((pkg.hotels || []).map((h) => h.hotelName).filter(Boolean))]
      .filter((n) => n.toLowerCase().includes(term))
      .map((n) => ({ _id: n, name: n }));
    return hotelsApi.list({ search: q }).then((r) => {
      const seen = new Set(inPkg.map((o) => o.name));
      const master = (r.data || []).filter((h) => h.name && !seen.has(h.name)).map((h) => ({ _id: h.name, name: h.name }));
      return [...inPkg, ...master];
    }).catch(() => inPkg);
  };

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

  // Auto-fill cost rates from the Transport Prices master (needs a master service picked).
  const autoTrRate = async (ti) => {
    const t = pkg.transports[ti];
    const serviceId = typeof t.service === 'object' ? t.service?._id : t.service;
    if (!serviceId) return toast.error('Pick a transport service from the master list first');
    const dayNo = (Array.isArray(t.days) ? t.days[0] : t.day) || 1;
    const date = startDate ? format(addDays(new Date(startDate), dayNo - 1), 'yyyy-MM-dd') : undefined;
    const cabList = pkg.sameCabType ? sharedItems : (t.items || []);
    const updated = [...(t.items || [])];
    let hits = 0;
    for (let ii = 0; ii < cabList.length; ii++) {
      const type = cabList[ii]?.type;
      if (!type) continue;
      // eslint-disable-next-line no-await-in-loop
      const r = await lookupApi.transportRate({ service: serviceId, config: type, date });
      if (r) {
        while (updated.length <= ii) updated.push({ type: '', qty: 1, rate: 0, given: 0 });
        // Given follows the fetched rate unless the user already customised it.
        const keepGiven = updated[ii].given && updated[ii].given !== updated[ii].rate;
        updated[ii] = { ...updated[ii], rate: r.price, given: keepGiven ? updated[ii].given : r.price };
        hits++;
      }
    }
    if (hits) { setTr(ti, { items: updated }); toast.success(`Fetched ${hits} rate(s) from price list`); }
    else toast('No matching rate — enter manually', { icon: '✏️' });
  };

  /* ----- Activities / Tickets ----- */
  const setAct = (i, patch) => update({ activities: pkg.activities.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) });
  const addAct = (days = [1]) => update({ activities: [...(pkg.activities || []), emptyActivity(days)] });
  const rmAct = async (i) => { if (await confirm({ title: 'Remove this activity?', message: `${pkg.activities[i]?.name || 'This activity'} will be removed from the package.`, confirmLabel: 'Remove' })) update({ activities: pkg.activities.filter((_, idx) => idx !== i) }); };
  const setActItem = (ai, ii, patch) => setAct(ai, { items: (pkg.activities[ai].items || []).map((it, idx) => (idx === ii ? { ...it, ...patch } : it)) });
  const addActItem = (ai) => setAct(ai, { items: [...(pkg.activities[ai].items || []), { type: '', qty: 1, rate: 0, given: 0 }] });
  const rmActItem = (ai, ii) => setAct(ai, { items: (pkg.activities[ai].items || []).filter((_, idx) => idx !== ii) });

  /* ----- Day groups: transports + activities sharing the same day(s) render
     inside ONE card, Sembark-style, with a single Days panel per group. ----- */
  const daysKey = (days, fb = [1]) => (Array.isArray(days) && days.length ? [...days] : fb).sort((a, b) => a - b).join(',');
  const dayGroups = (() => {
    const map = new Map();
    const groupFor = (key) => {
      if (!map.has(key)) map.set(key, { key, days: key.split(',').map(Number), tIdx: [], aIdx: [] });
      return map.get(key);
    };
    (pkg.transports || []).forEach((t, ti) => groupFor(daysKey(t.days, [t.day || 1])).tIdx.push(ti));
    (pkg.activities || []).forEach((a, ai) => groupFor(daysKey(a.days)).aIdx.push(ai));
    return [...map.values()].sort((x, y) => x.days[0] - y.days[0]);
  })();
  // Days = nights + 1 (a 4N trip has 5 days incl. the departure day).
  const dayOptionsAll = Array.from({ length: (Number(nights) || 1) + 1 }, (_, i) => ({
    n: i + 1,
    label: startDate ? `${ordinal(i + 1)} Day (${format(addDays(new Date(startDate), i), 'EEE d MMM')})` : `Day ${i + 1}`,
  }));
  const setGroupDays = (g, n) => {
    let next = g.days.includes(n) ? g.days.filter((d) => d !== n) : [...g.days, n].sort((a, b) => a - b);
    if (!next.length) next = [n];
    update({
      transports: (pkg.transports || []).map((t, ti) => (g.tIdx.includes(ti) ? { ...t, days: next } : t)),
      activities: (pkg.activities || []).map((a, ai) => (g.aIdx.includes(ai) ? { ...a, days: next } : a)),
    });
  };
  const addTrToGroup = (days) => update({ transports: [...(pkg.transports || []), emptyTransport([...days])] });
  const removeGroup = async (g) => {
    if (await confirm({ title: 'Remove this day?', message: 'All transport services and activities of this day will be removed from the package.', confirmLabel: 'Remove' })) {
      update({
        transports: (pkg.transports || []).filter((_, ti) => !g.tIdx.includes(ti)),
        activities: (pkg.activities || []).filter((_, ai) => !g.aIdx.includes(ai)),
      });
    }
  };
  // Every day of the trip (1..nights+1) is already covered by a service — no new day group needed.
  const allDaysTaken = (() => {
    const usedDays = new Set([...(pkg.transports || []), ...(pkg.activities || [])].flatMap((x) => (Array.isArray(x.days) && x.days.length ? x.days : [x.day || 1])));
    return Array.from({ length: (Number(nights) || 1) + 1 }, (_, i) => i + 1).every((d) => usedDays.has(d));
  })();
  const nextDayGroup = () => {
    const usedDays = new Set([...(pkg.transports || []), ...(pkg.activities || [])].flatMap((x) => (Array.isArray(x.days) && x.days.length ? x.days : [x.day || 1])));
    const nextDay = Array.from({ length: (Number(nights) || 1) + 1 }, (_, i) => i + 1).find((d) => !usedDays.has(d));
    if (!nextDay) return toast.error('All days already have services');
    update({ transports: [...(pkg.transports || []), emptyTransport([nextDay])] });
  };

  const actDate = (a) => {
    const dayNo = (Array.isArray(a.days) && a.days[0]) || 1;
    return startDate ? format(addDays(new Date(startDate), dayNo - 1), 'yyyy-MM-dd') : undefined;
  };

  // Picking a ticket/package type auto-builds the ticket rows (Adult/Child…)
  // with rates fetched from the Travel Activity Prices master.
  const pickTicketType = async (ai, name) => {
    const a = pkg.activities[ai];
    const actId = a.activity?._id || a.activity;
    if (!name || !actId) return setAct(ai, { ticketType: name || '' });
    // Child/infant ticket rows only when the trip actually has children.
    const hasChildren = (pax?.children?.length || 0) > 0;
    const configs = String(a.activity?.ageConfig || 'Adult, Child').split(',').map((s) => s.trim()).filter(Boolean)
      .filter((cfg) => hasChildren || !/child|infant|kid/i.test(cfg));
    const items = [];
    let hits = 0;
    for (const cfg of configs) {
      // eslint-disable-next-line no-await-in-loop
      const r = await lookupApi.activityRate({ activity: actId, service: name, config: cfg, date: actDate(a) }).catch(() => null);
      if (r) hits++;
      items.push({ type: cfg, qty: 1, rate: r?.price || 0, given: r?.price || 0 });
    }
    setAct(ai, { ticketType: name, items });
    if (hits) toast.success(`Fetched ${hits} rate(s) from the activity price list`);
    else toast('No matching rate — enter manually', { icon: '✏️' });
  };

  // Re-fetch rates for the current ticket rows.
  const autoActRate = async (ai) => {
    const a = pkg.activities[ai];
    const actId = a.activity?._id || a.activity;
    if (!actId) return toast.error('Pick an activity from the master list first');
    if (!a.ticketType) return toast.error('Pick a ticket/package type first');
    const items = [...(a.items || [])];
    let hits = 0;
    for (let ii = 0; ii < items.length; ii++) {
      if (!items[ii].type) continue;
      // eslint-disable-next-line no-await-in-loop
      const r = await lookupApi.activityRate({ activity: actId, service: a.ticketType, config: items[ii].type, date: actDate(a) }).catch(() => null);
      if (r) {
        const keepGiven = items[ii].given && items[ii].given !== items[ii].rate;
        items[ii] = { ...items[ii], rate: r.price, given: keepGiven ? items[ii].given : r.price };
        hits++;
      }
    }
    if (hits) { setAct(ai, { items }); toast.success(`Fetched ${hits} rate(s) from price list`); }
    else toast('No matching rate — enter manually', { icon: '✏️' });
  };

  /* ----- Shared Cab Types ----- */
  const sharedItems = pkg.sharedCabItems || [emptySharedItem()];
  const setSharedItem = (ii, patch) => update({ sharedCabItems: sharedItems.map((it, idx) => (idx === ii ? { ...it, ...patch } : it)) });
  const addSharedItem = () => update({ sharedCabItems: [...sharedItems, emptySharedItem()] });
  const rmSharedItem = (ii) => update({ sharedCabItems: sharedItems.filter((_, idx) => idx !== ii) });
  const setSameCab = (v) => update({ sameCabType: v });

  /* ----- Extras (special trip services) ----- */
  const setExtra = (i, patch) => update({ extras: pkg.extras.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });
  const addExtra = () => update({ extras: [...(pkg.extras || []), { label: '', price: 0, date: '', comments: '' }] });
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
              <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
                {/* ---- Left: hotel details ---- */}
                <div className="lg:border-r lg:border-slate-100 lg:pr-5">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="label">Stay Nights</label>
                      <NightSelect nights={nights} startDate={startDate} value={h.nights || []} onToggle={(n) => toggleNight(i, n)} disabledNights={nightsTakenByOthers(i)} />
                    </div>
                    <div>
                      <label className="label">Hotel</label>
                      <div className="flex gap-1.5">
                        <div className="min-w-0 flex-1">
                          <AsyncSelect
                            loadOptions={(s) => hotelsApi.list({ search: s }).then((r) => r.data)}
                            value={h.hotel ? { _id: h.hotel._id || h.hotel, name: h.hotel.name || h.hotelName || '' } : null}
                            onChange={(v) => pickHotel(i, v)}
                            placeholder="Type to search..."
                          />
                        </div>
                        <button type="button" onClick={() => autoRate(i)} title="Auto-fetch rate from the price master" className="btn-secondary shrink-0 px-2.5"><Sparkles size={14} /></button>
                      </div>
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
                        loadOptions={async (s) => {
                          // After a reload h.hotel is just an id — fetch the master for its room types.
                          let hotel = h.hotel;
                          const hid = hotel?._id || hotel;
                          if (hotel && !hotel.roomTypes && hid) hotel = await hotelsApi.get(hid).catch(() => null);
                          return (hotel?.roomTypes || []).filter((r) => r.name.toLowerCase().includes(s.toLowerCase())).map((r) => ({ _id: r.name, name: r.name }));
                        }}
                        value={h.roomType ? { _id: h.roomType, name: h.roomType } : null}
                        onChange={(v) => setHotel(i, { roomType: v ? v._id : '' })}
                        creatable
                        onCreate={async (name) => ({ _id: name, name })}
                        placeholder="Type to search..."
                      />
                      {!h.roomType && <RequiredHint>Room type field is required</RequiredHint>}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    <Num label="Pax/room (WoEB)" value={h.paxPerRoom} onChange={(v) => setHotel(i, { paxPerRoom: v })} />
                    {/* Extra beds only make sense inside rooms — zero & lock them until rooms ≥ 1. */}
                    <Num label="No. of rooms" value={h.rooms} onChange={(v) => setHotel(i, v > 0 ? { rooms: v } : { rooms: v, aweb: 0, cweb: 0, cnb: 0 })} />
                    <Num label="AWEB" value={h.aweb} onChange={(v) => setHotel(i, { aweb: v })} disabled={!(Number(h.rooms) > 0)} />
                    <Num label="CWEB" value={h.cweb} onChange={(v) => setHotel(i, { cweb: v })} disabled={!(Number(h.rooms) > 0)} />
                    <Num label="CNB" value={h.cnb} onChange={(v) => setHotel(i, { cnb: v })} disabled={!(Number(h.rooms) > 0)} />
                  </div>
                </div>

                {/* ---- Right: prices per night + row actions ---- */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800">Prices</p>
                    <button type="button" onClick={() => autoRate(i)} title="Refresh rates" className="text-slate-400 hover:text-brand-600"><RefreshCw size={13} /></button>
                  </div>
                  <div className="card card-flush overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
                        <tr><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Rate</th><th className="px-3 py-2.5">Given</th></tr>
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
                        {!(h.nights || []).length && <tr><td colSpan={3} className="px-3 py-3 text-center text-slate-400">Select stay night(s)</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button type="button" onClick={() => nextNight(i)} disabled={allNightsTaken} title={allNightsTaken ? 'All nights are already assigned to a hotel' : undefined} className="btn-secondary text-xs text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"><Plus size={13} /> Next Night</button>
                    <button type="button" onClick={() => dupHotel(i)} disabled={allNightsTaken} title={allNightsTaken ? 'All nights are already assigned to a hotel' : undefined} className="btn-secondary text-xs text-brand-700 disabled:cursor-not-allowed disabled:opacity-40"><Copy size={12} /> Duplicate</button>
                    <button type="button" onClick={() => rmHotel(i)} className="btn-ghost ml-auto text-xs text-slate-500 hover:text-red-600"><Trash2 size={12} /> Remove</button>
                  </div>
                  <p className="mt-1.5 text-right text-xs"><span className="text-slate-400">Hotel cost: </span><span className="font-semibold text-slate-700 tabular-nums">{money(hotelRowCost(h), currency)}</span></p>
                </div>
              </div>
            </div>
          ))}

          {givenIdx != null && pkg.hotels[givenIdx] && (
            <GivenPriceModal hotel={pkg.hotels[givenIdx]} currency={currency} onClose={() => setGivenIdx(null)}
              onSave={(patch) => { setHotel(givenIdx, patch); setGivenIdx(null); }} />
          )}
          <button type="button" onClick={addHotel} disabled={allNightsTaken} title={allNightsTaken ? 'All nights are already assigned to a hotel' : undefined} className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-40"><Plus size={14} /> Add Hotel</button>
        </div>

        {/* Inclusions */}
        <div className="mt-8 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <p className="text-sm font-bold text-slate-800">Any special inclusions in hotels</p>
          <p className="mb-3 text-xs text-slate-400">Add any extra services for hotels e.g. special dinner, honeymoon cake etc.</p>
          <div className="space-y-3">
            {(pkg.inclusions || []).length > 0 && (
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500">
                <span className="col-span-3">Service</span>
                <span className="col-span-3">Hotel</span>
                <span className="col-span-2">Night</span>
                <span className="col-span-2">Total Price ({currency})</span>
                <span className="col-span-2">Comments</span>
              </div>
            )}
            {(pkg.inclusions || []).map((inc, i) => (
              <div key={i} className="grid grid-cols-12 items-start gap-2">
                <div className="col-span-3">
                  <CreatableSelect category="hotelService" value={inc.service} onChange={(v) => setInc(i, { service: v })} placeholder="Select or add a service" />
                  {!inc.service && <RequiredHint>Service field is required</RequiredHint>}
                </div>
                <div className="col-span-3">
                  <AsyncSelect
                    loadOptions={inclusionHotelOptions}
                    value={inc.hotelName ? { _id: inc.hotelName, name: inc.hotelName } : null}
                    onChange={(v) => setInc(i, { hotelName: v ? v.name : '' })}
                    creatable onCreate={(name) => Promise.resolve({ _id: name, name })}
                    placeholder="Type to search…"
                  />
                </div>
                <div className="col-span-2">
                  <select className="input" value={inc.night || ''} onChange={(e) => setInc(i, { night: Number(e.target.value) })}>
                    <option value="">Select night…</option>
                    {Array.from({ length: Math.max(1, nights || 1) }, (_, k) => k + 1).map((n) => (
                      <option key={n} value={n}>
                        {startDate ? `${ordinal(n)} N (${format(addDays(new Date(startDate), n - 1), 'EEE d MMM')})` : `${ordinal(n)} N`}
                      </option>
                    ))}
                  </select>
                  {!inc.night && <RequiredHint>Please select a night</RequiredHint>}
                </div>
                <input type="number" className="input col-span-2" placeholder="e.g. 3000" value={inc.price} onChange={(e) => setInc(i, { price: Number(e.target.value) })} />
                <div className="col-span-2 flex items-start gap-1">
                  <input className="input flex-1" placeholder="Any comments" value={inc.comments} onChange={(e) => setInc(i, { comments: e.target.value })} />
                  <button type="button" onClick={() => rmInc(i)} className="pt-3 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
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
          {dayGroups.map((g) => (
            <div key={g.key} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex gap-0 divide-x divide-gray-100">
                {/* LEFT: Days — applies to every service in this group */}
                <div className="w-44 shrink-0 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Days</p>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {dayOptionsAll.map(({ n, label }) => (
                      <label key={n} className={cn('flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors', g.days.includes(n) ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50')}>
                        <input
                          type="checkbox"
                          className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-brand-600"
                          checked={g.days.includes(n)}
                          onChange={() => setGroupDays(g, n)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* RIGHT: the day's services stacked inside one card */}
                <div className="flex-1 divide-y divide-gray-100">
                  {g.tIdx.map((ti) => {
                    const t = pkg.transports[ti];
                    const tDays = Array.isArray(t.days) ? t.days : (t.day ? [t.day] : [1]);
                    const cabItems = pkg.sameCabType ? sharedItems : (t.items || []);
                    const firstDay = tDays[0] || 1;
                    const firstDate = startDate ? format(addDays(new Date(startDate), firstDay - 1), 'EEEE, d MMM') : `Day ${firstDay}`;
                    return (
                      <div key={`t-${ti}`}>
                        <div className="flex items-center gap-2 px-4 pt-3">
                          <Bus size={14} className="text-brand-500" />
                          <span className="text-xs font-semibold text-brand-600">Transport Service</span>
                          <button type="button" onClick={() => rmTr(ti)} title="Remove this service" className="ml-auto text-xs font-medium text-slate-300 hover:text-red-500">&#10005;</button>
                        </div>
                        <div className="flex gap-0">
                          {/* Service details */}
                          <div className="flex-1 p-4 space-y-3">
                    <div>
                      <label className="label">Service Locations</label>
                      <AsyncSelect
                        loadOptions={(q) => transportApi.list({ search: q }).then((r) =>
                          (r.data || []).map((s) => ({ _id: s._id, name: [s.from, s.to].filter(Boolean).join(' to ') || s.name, raw: s })))}
                        value={t.serviceLocation ? { _id: t.service || t.serviceLocation, name: t.serviceLocation } : null}
                        onChange={(v) => setTr(ti, { service: v?.raw?._id || null, serviceLocation: v ? v.name : '' })}
                        creatable onCreate={(name) => Promise.resolve({ _id: name, name })}
                        placeholder="Port Blair to Havelock"
                      />
                      {t.service && <p className="mt-1 text-[11px] text-green-600">✓ Linked to transport master — rates can auto-fill</p>}
                    </div>
                    <div>
                      <label className="label">Service Type</label>
                      <AsyncSelect
                        loadOptions={async (q) => {
                          const sid = typeof t.service === 'object' ? t.service?._id : t.service;
                          if (!sid) return [];
                          const s = await transportApi.get(sid).catch(() => null);
                          return (s?.items || [])
                            .map((it) => ({ _id: it.name, name: it.name }))
                            .filter((o) => o.name.toLowerCase().includes((q || '').toLowerCase()));
                        }}
                        value={t.serviceType ? { _id: t.serviceType, name: t.serviceType } : null}
                        onChange={(v) => setTr(ti, { serviceType: v ? v.name : '' })}
                        creatable onCreate={(name) => Promise.resolve({ _id: name, name })}
                        placeholder={t.service ? 'Type to search...' : 'Pick a service location first'}
                      />
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
                          </div>

                          {/* Transportation and Prices */}
                          <div className="w-80 shrink-0 border-l border-gray-100 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-700">Transportation and Prices{firstDate ? ` — ${firstDate}` : ''}</p>
                      <button type="button" onClick={() => autoTrRate(ti)} title="Fetch rates from the transport price list" className="btn-secondary px-2 py-1 text-[11px]"><Sparkles size={11} /> Auto rate</button>
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="pb-1 text-left font-semibold">Transportation</th>
                          <th className="pb-1 text-left font-semibold w-14">Date</th>
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
                              <td className="py-1.5 pr-1 whitespace-nowrap text-[11px] leading-5 text-slate-500">
                                {tDays.map((d) => (
                                  <div key={d}>{startDate ? format(addDays(new Date(startDate), d - 1), 'd MMM') : `Day ${d}`}</div>
                                ))}
                              </td>
                              <td className="py-1.5 pr-1">
                                <input
                                  type="number"
                                  className="input w-16 text-xs"
                                  placeholder="0"
                                  value={priceIt.rate ?? ''}
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    const keepGiven = priceIt.given && priceIt.given !== priceIt.rate;
                                    setTrItem(ti, ii, keepGiven ? { rate: v } : { rate: v, given: v });
                                  }}
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
                                {tDays.length > 1 && Number(priceIt.given) > 0 && (
                                  <div className="mt-0.5 text-[10px] text-slate-400">× {tDays.length}d = {((Number(priceIt.given) || 0) * (Number(priceIt.qty) || 1) * tDays.length).toLocaleString('en-IN')}</div>
                                )}
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
                      </div>
                    );
                  })}
                  {/* Activity / Ticket sub-blocks of this day */}
                  {g.aIdx.map((ai) => {
                    const a = pkg.activities[ai];
                    const aDays = Array.isArray(a.days) && a.days.length ? a.days : [1];
                    const configOptions = String(a.activity?.ageConfig || 'Adult, Child').split(',').map((s) => s.trim()).filter(Boolean);
                    return (
                      <div key={`a-${ai}`}>
                        <div className="flex items-center gap-2 px-4 pt-3">
                          <Ticket size={14} className="text-brand-500" />
                          <span className="text-xs font-semibold text-brand-600">Activity/Ticket</span>
                          <button type="button" onClick={() => rmAct(ai)} title="Remove this activity" className="ml-auto text-xs font-medium text-slate-300 hover:text-red-500">&#10005;</button>
                        </div>
                        <div className="flex gap-0">
                          {/* Activity details */}
                          <div className="flex-1 p-4 space-y-3">
                    <div>
                      <label className="label">Name</label>
                      <AsyncSelect
                        loadOptions={(q) => activitiesApi.list({ search: q }).then((r) => (r.data || []).map((x) => ({ _id: x._id, name: x.name, raw: x })))}
                        value={a.name ? { _id: a.activity?._id || a.activity || a.name, name: a.name } : null}
                        onChange={(v) => setAct(ai, { activity: v?.raw || null, name: v ? v.name : '', ticketType: '', items: [] })}
                        creatable onCreate={(name) => Promise.resolve({ _id: name, name })}
                        placeholder="Type to search..."
                      />
                      {a.activity && <p className="mt-1 text-[11px] text-green-600">✓ Linked to activity master — prices can auto-fill</p>}
                    </div>
                    <div>
                      <label className="label">Ticket/Package Type</label>
                      <AsyncSelect
                        loadOptions={async (q) => {
                          let act = a.activity;
                          const actId = act?._id || act;
                          if (act && !act.ticketTypes && actId) act = await activitiesApi.get(actId).catch(() => null);
                          return (act?.ticketTypes || [])
                            .map((tt) => ({ _id: tt.name, name: tt.name }))
                            .filter((o) => o.name.toLowerCase().includes((q || '').toLowerCase()));
                        }}
                        value={a.ticketType ? { _id: a.ticketType, name: a.ticketType } : null}
                        onChange={(v) => pickTicketType(ai, v ? v.name : '')}
                        creatable onCreate={(name) => Promise.resolve({ _id: name, name })}
                        placeholder={a.activity ? 'Type to search...' : 'Pick an activity first'}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Slot</label>
                        <input className="input" placeholder="14:00" value={a.slot || ''} onChange={(e) => setAct(ai, { slot: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">Duration (Mins)</label>
                        <input type="number" className="input" placeholder="60 Mins" value={a.durationMins ?? ''} onChange={(e) => setAct(ai, { durationMins: Number(e.target.value) })} />
                      </div>
                    </div>
                          </div>

                          {/* Tickets and Prices */}
                          <div className="w-96 shrink-0 border-l border-gray-100 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-700">Tickets and Prices</p>
                      <button type="button" onClick={() => autoActRate(ai)} title="Fetch rates from the activity price list" className="btn-secondary px-2 py-1 text-[11px]"><Sparkles size={11} /> Auto rate</button>
                    </div>
                    <table className="w-full table-fixed text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="pb-1 text-left font-semibold">Type</th>
                          <th className="pb-1 text-left font-semibold w-10">Qty.</th>
                          <th className="pb-1 text-left font-semibold w-14">Date</th>
                          <th className="pb-1 text-left font-semibold w-14">Rate</th>
                          <th className="pb-1 text-left font-semibold w-14">Given</th>
                          <th className="w-6" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(a.items || []).map((it, ii) => (
                          <tr key={ii}>
                            <td className="py-1.5 pr-2">
                              <AsyncSelect
                                loadOptions={(q) => Promise.resolve(configOptions.map((c) => ({ _id: c, name: c })).filter((o) => o.name.toLowerCase().includes((q || '').toLowerCase())))}
                                value={it.type ? { _id: it.type, name: it.type } : null}
                                onChange={(v) => setActItem(ai, ii, { type: v ? v.name : '' })}
                                creatable onCreate={(name) => Promise.resolve({ _id: name, name })}
                                placeholder="Adult…"
                              />
                            </td>
                            <td className="py-1.5 pr-1">
                              <input type="number" className="input w-full px-1 text-center text-xs" value={it.qty ?? ''} onChange={(e) => setActItem(ai, ii, { qty: Number(e.target.value) })} />
                            </td>
                            <td className="py-1.5 pr-1 whitespace-nowrap text-[11px] leading-5 text-slate-500">
                              {aDays.map((d) => (
                                <div key={d}>{startDate ? format(addDays(new Date(startDate), d - 1), 'd MMM') : `Day ${d}`}</div>
                              ))}
                            </td>
                            <td className="py-1.5 pr-1">
                              <input type="number" className="input w-full px-1 text-xs" placeholder="0" value={it.rate ?? ''} onChange={(e) => {
                                const v = Number(e.target.value);
                                const keepGiven = it.given && it.given !== it.rate;
                                setActItem(ai, ii, keepGiven ? { rate: v } : { rate: v, given: v });
                              }} />
                            </td>
                            <td className="py-1.5">
                              <input type="number" className="input w-full px-1 text-xs" placeholder="0" value={it.given ?? ''} onChange={(e) => setActItem(ai, ii, { given: Number(e.target.value) })} />
                              {Number(it.given) > 0 && ((Number(it.qty) || 1) > 1 || aDays.length > 1) && (
                                <div className="mt-0.5 text-[10px] text-slate-400">× {it.qty || 1}{aDays.length > 1 ? ` × ${aDays.length}d` : ''} = {((Number(it.given) || 0) * (Number(it.qty) || 1) * aDays.length).toLocaleString('en-IN')}</div>
                              )}
                            </td>
                            <td className="py-1.5 pl-1 text-center">
                              <button type="button" onClick={() => rmActItem(ai, ii)} title="Remove row" className="text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                            </td>
                          </tr>
                        ))}
                        {!(a.items || []).length && (
                          <tr><td colSpan={5} className="py-2 text-center text-slate-400">Pick a ticket/package type to fetch prices</td></tr>
                        )}
                      </tbody>
                    </table>
                    <button type="button" onClick={() => addActItem(ai)} className="mt-2 btn-secondary text-xs"><Plus size={11} /> Add Item</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add more services to this day */}
                  <div className="flex gap-2 p-4">
                    <button type="button" onClick={() => addTrToGroup(g.days)} className="btn-secondary text-xs"><Plus size={12} /> Transport Service</button>
                    <button type="button" onClick={() => addAct(g.days)} className="btn-secondary text-xs"><Plus size={12} /> Activity/Ticket</button>
                  </div>
                </div>
              </div>

              {/* Card footer */}
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-4 py-2">
                <button type="button" onClick={nextDayGroup} disabled={allDaysTaken} title={allDaysTaken ? 'All days already have services' : undefined} className="btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-40"><Plus size={12} /> Next Day</button>
                <button type="button" onClick={() => removeGroup(g)} className="text-xs font-medium text-red-500 hover:text-red-700">✕ Remove</button>
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <button type="button" onClick={nextDayGroup} disabled={allDaysTaken} title={allDaysTaken ? 'All days already have services' : undefined} className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-40"><Plus size={14} /> Add Day / Service</button>
          </div>
        </div>
      </Section>

      {/* Extras — special trip-level services */}
      <Section icon={Star} title="Any other special service for this trip" hint="Add any extra services like off road dinner, side treking etc that are associated with the overall trip package.">
        <div className="space-y-3">
          {(pkg.extras || []).length > 0 && (
            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500">
              <span className="col-span-4">Service</span>
              <span className="col-span-2">Total Price ({currency})</span>
              <span className="col-span-2">Date</span>
              <span className="col-span-4">Comments</span>
            </div>
          )}
          {(pkg.extras || []).map((e, i) => (
            <div key={i} className="grid grid-cols-12 items-start gap-2">
              <div className="col-span-4">
                <CreatableSelect category="tripService" value={e.label} onChange={(v) => setExtra(i, { label: v })} placeholder="Select or add a service" />
                {!e.label && <RequiredHint>Service field is required</RequiredHint>}
              </div>
              <input type="number" className="input col-span-2" placeholder="e.g. 3000" value={e.price} onChange={(ev) => setExtra(i, { price: Number(ev.target.value) })} />
              <input type="date" className="input col-span-2" value={e.date ? String(e.date).slice(0, 10) : ''} onChange={(ev) => setExtra(i, { date: ev.target.value })} />
              <div className="col-span-4 flex items-start gap-1">
                <input className="input flex-1" placeholder="Any comments regarding service" value={e.comments || ''} onChange={(ev) => setExtra(i, { comments: ev.target.value })} />
                <button type="button" onClick={() => rmExtra(i)} className="pt-3 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addExtra} className="btn-secondary text-sm"><Plus size={13} /> Add Service</button>
        </div>
      </Section>

      {/* Markup / Tax / Rounding */}
      <Section title="Set Markup, Tax and Rounding">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr_1fr]">
          {/* Markup */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Markup</p>
            <div className="flex items-center gap-2">
              <select className="input w-36" value={pkg.markupType} onChange={(e) => update({ markupType: e.target.value })}>
                <option value="percent">Percentage</option><option value="flat">Flat</option>
              </select>
              <input type="number" className="input w-24 text-center" value={pkg.markupValue} onChange={(e) => update({ markupValue: Number(e.target.value) })} />
              <span className="text-sm text-slate-400">{pkg.markupType === 'percent' ? '%' : currency}</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">Markup amount: <span className="font-semibold text-slate-600">{money(c.markupAmount, currency)}</span></p>
          </div>

          {/* Tax */}
          <div className="rounded-xl border border-slate-200 p-4">
            <label className="mb-3 flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <input type="checkbox" className="accent-brand-600" checked={!!pkg.taxApplied} onChange={(e) => update({ taxApplied: e.target.checked })} />
              Apply Tax
            </label>
            <div className={cn('flex items-center gap-2', !pkg.taxApplied && 'opacity-50')}>
              <select className="input w-24" value={pkg.taxName || 'GST'} onChange={(e) => update({ taxName: e.target.value })} disabled={!pkg.taxApplied}>
                {['GST', 'IGST', 'CGST', 'VAT'].map((t) => <option key={t}>{t}</option>)}
              </select>
              <input type="number" className="input w-20 text-center" value={pkg.taxPercent} onChange={(e) => update({ taxPercent: Number(e.target.value) })} disabled={!pkg.taxApplied} />
              <span className="text-sm text-slate-400">%</span>
              <select className="input flex-1" value={pkg.taxOn || 'cost_markup'} onChange={(e) => update({ taxOn: e.target.value })} disabled={!pkg.taxApplied}>
                <option value="cost_markup">On Cost + Markup</option><option value="markup">On Markup Only</option>
              </select>
            </div>
            <p className="mt-2 text-xs text-slate-400">Tax amount: <span className="font-semibold text-slate-600">{money(c.taxAmount, currency)}</span></p>
          </div>

          {/* Rounding */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Round Final Price</p>
            <select className="input w-40" value={pkg.rounding || 1} onChange={(e) => update({ rounding: Number(e.target.value) || 1 })}>
              {[1, 5, 10, 50, 100].map((r) => <option key={r} value={r}>Nearest {r}</option>)}
            </select>
            <p className="mt-2 text-xs text-slate-400">Final price is rounded to the nearest {pkg.rounding || 1}.</p>
          </div>
        </div>

        {/* Calculation strip */}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 px-5 py-3.5 text-sm">
          <span><span className="text-xs text-slate-400">Cost Price&nbsp;&nbsp;</span><span className="font-semibold tabular-nums text-slate-800">{money(c.costPrice, currency)}</span></span>
          <span className="text-slate-300">+</span>
          <span><span className="text-xs text-slate-400">Markup&nbsp;&nbsp;</span><span className="font-semibold tabular-nums text-slate-800">{money(c.markupAmount, currency)}</span></span>
          <span className="text-slate-300">+</span>
          <span><span className="text-xs text-slate-400">{pkg.taxApplied ? `${pkg.taxName || 'GST'} ${pkg.taxPercent || 0}%` : 'Tax'}&nbsp;&nbsp;</span><span className="font-semibold tabular-nums text-slate-800">{money(c.taxAmount, currency)}</span></span>
          <span className="ml-auto flex items-baseline gap-2 rounded-lg bg-brand-600 px-4 py-1.5 text-white">
            <span className="text-xs text-blue-100">Final Price</span>
            <span className="text-base font-bold tabular-nums">{money(c.sellingPrice, currency)}</span>
          </span>
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

// Each module renders as its own card so the builder doesn't read as one long congested block.
function Section({ icon: Icon, title, hint, children }) {
  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3 border-b border-slate-100 pb-4">
        {Icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm"><Icon size={17} /></span>}
        <div>
          <h4 className="text-[15px] font-bold text-slate-900">{title}</h4>
          {hint && <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{hint}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Num({ label, value, onChange, disabled = false, title }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className={`input ${disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400' : ''}`}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        title={disabled ? title || 'Enter no. of rooms first' : undefined}
      />
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
              <td className="py-2.5 text-center">
                {r.qty ? (
                  <input type="number" className="input mx-auto w-28 text-center" value={v[r.key]} onChange={(e) => setV((s) => ({ ...s, [r.key]: e.target.value }))} />
                ) : (
                  <span className="text-slate-400">&mdash;</span>
                )}
              </td>
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
function NightSelect({ nights, startDate, value, onToggle, disabledNights = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const opts = Array.from({ length: Math.max(1, nights) }, (_, i) => i + 1);
  const taken = new Set(disabledNights);
  const label = (n) => {
    if (startDate) { const dt = addDays(new Date(startDate), n - 1); return `${ordinal(n)} N (${format(dt, 'EEE d MMM')})`; }
    return `${ordinal(n)} N`;
  };
  return (
    <div ref={ref}>
      <div className="relative">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-200">
          <span className="text-slate-400">Select night(s)...</span>
          <ChevronDown size={16} className="shrink-0 text-slate-400" />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 max-h-56 w-full animate-scale-in overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {opts.map((n) => {
              const isTaken = taken.has(n) && !value.includes(n);
              return (
                <label key={n} className={`flex items-center gap-2 px-3 py-2 text-sm ${isTaken ? 'cursor-not-allowed text-slate-300' : 'cursor-pointer text-slate-700 hover:bg-slate-50'}`}>
                  <input type="checkbox" disabled={isTaken} checked={value.includes(n)} onChange={() => onToggle(n)} />
                  {label(n)}
                  {isTaken && <span className="ml-auto text-[10px] font-medium text-slate-300">already selected</span>}
                </label>
              );
            })}
          </div>
        )}
      </div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((n) => (
            <label key={n} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/70 px-2 py-1 text-xs font-medium text-brand-700" title="Untick to remove">
              <input type="checkbox" checked onChange={() => onToggle(n)} className="h-3.5 w-3.5 rounded border-brand-300 text-brand-600 focus:ring-brand-500" />
              {label(n)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
