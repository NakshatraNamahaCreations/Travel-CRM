import { useState, useRef, useEffect } from 'react';
import { Hotel, Bus, Plus, Trash2, Copy, Sparkles, Star, ChevronDown, RefreshCw, AlertTriangle, Ticket, CalendarDays, Clock } from 'lucide-react';
import { addDays, format } from 'date-fns';
import toast from 'react-hot-toast';
import AsyncSelect from '../../components/form/AsyncSelect.jsx';
import CreatableSelect from '../../components/form/CreatableSelect.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { hotelsApi, transportApi, activitiesApi } from '../../api/services.js';
import { lookupApi } from '../../api/quotes.js';
import { optionsApi } from '../../api/options.js';
import { hotelRowCost, hotelPerNight, hotelsBilledTotal, computePackage, money } from '../../lib/pricing.js';
import { STD_TICKETS } from '../../lib/stdTickets.js';
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
  const hotelsTotal = hotelsBilledTotal(pkg.hotels);

  /* ----- Hotels ----- */
  const setHotel = (i, patch) => update({ hotels: pkg.hotels.map((h, idx) => (idx === i ? { ...h, ...patch } : h)) });
  // Only primary rows claim nights — alternatives share their primary's nights.
  const primaryNightsUsed = () => new Set((pkg.hotels || []).flatMap((x) => (x.isAlternative ? [] : x.nights || [])));
  // Rooms/beds implied by the trip's pax: 2 adults per room (min 1 room);
  // children above the age cutoff need their own extra bed (CWEB) but still
  // fit in that same room; children at/under the cutoff are complimentary,
  // no bed (CNB) — starting point only, the agent can still adjust freely.
  const CHILD_BED_AGE_CUTOFF = 5;
  const paxOccupancy = () => {
    const adults = pax?.adults || 0;
    const kids = pax?.children || [];
    const cweb = kids.filter((c) => (Number(c.age) || 0) > CHILD_BED_AGE_CUTOFF).length;
    const cnb = kids.filter((c) => (Number(c.age) || 0) <= CHILD_BED_AGE_CUTOFF).length;
    return { rooms: Math.max(1, Math.ceil(adults / 2)), aweb: 0, cweb, cnb };
  };
  // New rows start on the first night nobody has claimed yet (empty if all taken).
  const addHotel = () => {
    const used = primaryNightsUsed();
    const free = Array.from({ length: Math.max(1, nights) }, (_, k) => k + 1).find((n) => !used.has(n));
    update({ hotels: [...(pkg.hotels || []), { ...emptyHotel(), ...paxOccupancy(), nights: free ? [free] : [] }] });
  };
  // Nights already assigned to OTHER primary rows — one primary hotel per night.
  const nightsTakenByOthers = (i) => {
    if (pkg.hotels?.[i]?.isAlternative) return []; // alternatives may sit on any night
    return (pkg.hotels || []).flatMap((x, idx) => (idx === i || x.isAlternative ? [] : (x.nights || [])));
  };
  // Every night of the trip already belongs to a primary hotel row.
  const allNightsTaken = (() => {
    const used = primaryNightsUsed();
    return Array.from({ length: Math.max(1, nights) }, (_, k) => k + 1).every((n) => used.has(n));
  })();
  // Duplicate = alternative option for the SAME night(s): "Hotel A OR Hotel B".
  // Inserted right below the source row; excluded from package totals.
  const dupHotel = (i) => {
    const { _id, ...copy } = pkg.hotels[i];
    const next = [...pkg.hotels];
    next.splice(i + 1, 0, { ...copy, nights: [...(copy.nights || [])], isAlternative: true });
    update({ hotels: next });
  };
  // Next Night: same hotel/config on the first night nobody has claimed yet.
  const nextNight = (i) => {
    const used = primaryNightsUsed();
    const free = Array.from({ length: Math.max(1, nights) }, (_, k) => k + 1).find((n) => !used.has(n));
    if (!free) return toast.error('All nights are already assigned to a hotel');
    const { _id, ...copy } = pkg.hotels[i];
    update({ hotels: [...pkg.hotels, { ...copy, isAlternative: false, nights: [free] }] });
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
  // Fetch the rate automatically once hotel + room type + meal plan are all
  // chosen (patch = the field change that triggered this, applied together
  // with the fetched rates so the async update doesn't clobber it).
  const maybeAutoRate = async (i, patch) => {
    const h = { ...pkg.hotels[i], ...patch };
    if (!h.hotel || !h.roomType || !h.mealPlan) return;
    const r = await lookupApi.hotelRate({ hotel: h.hotel?._id || h.hotel, roomType: h.roomType, mealPlan: h.mealPlan, date: startDate }).catch(() => null);
    if (r) {
      setHotel(i, { ...patch, cardRate: r.basePrice, ratePerNight: r.basePrice, awebRate: r.aweb, cwebRate: r.cweb, cnbRate: r.cwoeb });
      toast.success(`Rate: ${money(r.basePrice, currency)}/night`);
    }
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

  /* ----- Multi service-type support -----
     The Service Type field is a multi-select: the row keeps one type, and every
     additional tick mirrors into its own transport row (same master/location/
     days) so each service keeps separate timings. The chips show every type of
     the same location+days family; unticking one removes that service row. */
  const trDaysKey = (t) => daysKey(t.days, [t.day || 1]);
  const trFamily = (t) => {
    const key = trDaysKey(t);
    return (x) => x === t || (!!t.serviceLocation && x.serviceLocation === t.serviceLocation && trDaysKey(x) === key);
  };
  const trServiceTypeValue = (t) => {
    const fam = (pkg.transports || []).filter(trFamily(t));
    const names = [t.serviceType, ...fam.filter((x) => x !== t).map((x) => x.serviceType)].filter(Boolean);
    return [...new Set(names)].map((n) => ({ _id: n, name: n }));
  };
  const setTrServiceTypes = async (ti, list) => {
    const src = pkg.transports || [];
    const t = src[ti];
    const inFam = trFamily(t);
    const names = [...new Set((list || []).map((o) => o?.name).filter(Boolean))];

    // Fetch the master service once so a newly-ticked type can auto-fill its
    // own Start Time / Duration from the master item (Excel import or
    // manually authored on the Transport Service master) instead of
    // defaulting to blank/60 mins.
    const serviceId = typeof t.service === 'object' ? t.service?._id : t.service;
    const master = serviceId ? await transportApi.get(serviceId).catch(() => null) : null;
    const norm = (s) => String(s || '').trim().toLowerCase();
    const timingFor = (name) => {
      const item = (master?.items || []).find((it) => norm(it.name) === norm(name));
      if (!item) return {};
      const extra = {};
      if (item.startTime) extra.startTime = item.startTime;
      if (item.durationMins) extra.durationMins = item.durationMins;
      return extra;
    };
    // Cab price for the newly-picked service type — same lookup as the
    // "Auto rate" button, using whichever cab type(s) are already configured
    // (the shared "Same Cab Type for All" list, or this row's own items).
    const dayNo = (Array.isArray(t.days) && t.days[0]) || t.day || 1;
    const rateDate = startDate ? format(addDays(new Date(startDate), dayNo - 1), 'yyyy-MM-dd') : undefined;
    const cabSource = pkg.sameCabType ? sharedItems : (t.items || []);
    const ratedItemsFor = async (name) => {
      const cabs = (cabSource || []).filter((it) => it?.type);
      if (!serviceId || !cabs.length) return null;
      const rated = [];
      for (const cab of cabs) {
        // eslint-disable-next-line no-await-in-loop
        const r = await lookupApi.transportRate({ service: serviceId, config: cab.type, item: name, date: rateDate }).catch(() => null);
        rated.push({ type: cab.type, qty: cab.qty || 1, rate: r?.price || 0, given: r?.price || 0 });
      }
      return rated;
    };
    // Standard sightseeing tickets (Cellular Jail, L&S, Baratang, Elephant
    // Beach, Ross Island, North Bay) auto-add a priced ticket row so the
    // fixed entry fee actually counts toward the total — but only when the
    // agent hasn't already got a matching ticket/activity for these days
    // (their own price always wins, no duplicate).
    const targetDays = Array.isArray(t.days) && t.days.length ? t.days : [t.day || 1];
    const pendingActs = [];
    const stdTicketCovered = (entry) => [...(pkg.activities || []), ...pendingActs].some((a) => {
      const days = Array.isArray(a.days) && a.days.length ? a.days : [1];
      if (!days.some((d) => targetDays.includes(d))) return false;
      return entry.act.test(`${a.name || ''} ${a.ticketType || ''} ${a.forService || ''}`);
    });
    const addStdTicketIfNeeded = (name) => {
      const entry = STD_TICKETS.find((e) => e.svc.test(name));
      if (!entry || stdTicketCovered(entry)) return;
      const qty = (pax?.adults || 0) + (pax?.children || []).filter((c) => (Number(c.age) || 0) >= entry.minAge).length;
      if (!qty) return;
      pendingActs.push({
        ...emptyActivity([...targetDays]),
        name: entry.label,
        ticketType: entry.label,
        forService: name,
        items: [{ type: 'Ticket', qty, rate: entry.price, given: entry.price }],
      });
    };

    const own = { ...t };
    if (own.serviceType && !names.includes(own.serviceType)) own.serviceType = '';

    // Drop family rows whose type was unticked (the edited row just clears).
    const kept = [];
    for (const x of src) {
      if (x === t) { kept.push(own); continue; }
      if (inFam(x) && x.serviceType && !names.includes(x.serviceType)) continue;
      kept.push(x);
    }

    // Types still present in the family after removals.
    const present = new Set(
      kept.filter((x) => x === own || inFam(x)).map((x) => x.serviceType).filter(Boolean)
    );

    const additions = [];
    for (const n of names) {
      if (present.has(n)) continue;
      if (!own.serviceType) {
        own.serviceType = n;
        Object.assign(own, timingFor(n));
        // eslint-disable-next-line no-await-in-loop
        const rated = await ratedItemsFor(n);
        if (rated) own.items = rated;
        addStdTicketIfNeeded(n);
        present.add(n); continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const rated = await ratedItemsFor(n);
      additions.push({
        ...emptyTransport([...(Array.isArray(t.days) && t.days.length ? t.days : [t.day || 1])]),
        service: t.service ?? null,
        serviceLocation: t.serviceLocation || '',
        serviceType: n,
        ...timingFor(n),
        // Each service type in the family keeps its own cab pricing (same cab
        // type/config, but the rate is looked up per item) so the price panel
        // can show a clearly divided row per service.
        items: rated || [],
      });
      addStdTicketIfNeeded(n);
      present.add(n);
    }
    update({
      transports: [...kept, ...additions],
      ...(pendingActs.length ? { activities: [...(pkg.activities || []), ...pendingActs] } : {}),
    });
  };
  const rmTrFamily = async (idxs) => {
    if (await confirm({ title: 'Remove this service?', message: 'This transport service (with all its service types) will be removed from the package.', confirmLabel: 'Remove' })) {
      update({ transports: pkg.transports.filter((_, idx) => !idxs.includes(idx)) });
    }
  };

  // Auto-fill cost rates from the Transport Prices master (needs a master
  // service picked). Runs across every service type in the family at once —
  // each prices independently against its own item name — with one toast.
  const autoTrRateFamily = async (idxs) => {
    let total = 0;
    for (const fi of idxs) {
      const t = pkg.transports[fi];
      const serviceId = typeof t.service === 'object' ? t.service?._id : t.service;
      if (!serviceId) continue;
      const dayNo = (Array.isArray(t.days) ? t.days[0] : t.day) || 1;
      const date = startDate ? format(addDays(new Date(startDate), dayNo - 1), 'yyyy-MM-dd') : undefined;
      const cabList = pkg.sameCabType ? sharedItems : (t.items || []);
      const updated = [...(t.items || [])];
      let hits = 0;
      for (let ii = 0; ii < cabList.length; ii++) {
        const type = cabList[ii]?.type;
        if (!type) continue;
        // eslint-disable-next-line no-await-in-loop
        const r = await lookupApi.transportRate({ service: serviceId, config: type, item: t.serviceType, date });
        if (r) {
          while (updated.length <= ii) updated.push({ type: '', qty: 1, rate: 0, given: 0 });
          const keepGiven = updated[ii].given && updated[ii].given !== updated[ii].rate;
          updated[ii] = { ...updated[ii], type, rate: r.price, given: keepGiven ? updated[ii].given : r.price };
          hits++;
        }
      }
      if (hits) { setTr(fi, { items: updated }); total += hits; }
    }
    if (total) toast.success(`Fetched ${total} rate(s) from price list`);
    else toast('No matching rate — enter manually', { icon: '✏️' });
  };

  /* ----- Activities / Tickets ----- */
  const setAct = (i, patch) => update({ activities: pkg.activities.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) });
  const addAct = (days = [1]) => update({ activities: [...(pkg.activities || []), emptyActivity(days)] });
  // Add an Activity/Ticket pre-scoped to ONE service type — its Name picker
  // then suggests only activities matching that service, and the PDF nests
  // the ticket under that service's itinerary block.
  const addActForService = (days = [1], serviceType = '') => {
    update({ activities: [...(pkg.activities || []), { ...emptyActivity([...days]), forService: serviceType }] });
    if (serviceType) toast(`Pick the ticket for “${serviceType}”`, { icon: '🎟️' });
  };
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

    // Auto-fill Slot + Duration from the ticket type's master entry (the
    // "Slots" / "Duration" fields authored on the activity, e.g. from the
    // Excel import: "11:00-12:00" → slot 11:00, duration 60).
    let master = a.activity;
    if (master && !master.ticketTypes) master = await activitiesApi.get(actId).catch(() => null);
    const norm = (s) => String(s || '').trim().toLowerCase();
    const tk = (master?.ticketTypes || []).find((t) => norm(t.name) === norm(name));
    const extra = { slotOptions: [] };
    if (tk?.slots) {
      // Slot is free text now (matches the master's own format, e.g. "11:00,
      // 13:00" or "10:00 AM-11:00 AM") — no HH:MM normalisation needed. A
      // comma-separated list of distinct times (not a "start-end" range)
      // becomes a dropdown of choices instead of a single auto-filled value.
      const commaOpts = String(tk.slots).split(',').map((s) => s.trim()).filter(Boolean);
      if (commaOpts.length > 1) {
        extra.slotOptions = commaOpts;
        extra.slot = commaOpts[0];
      } else {
        extra.slot = tk.slots;
      }
      // A "11:00-12:00" range implies the duration when none is authored.
      const range = String(tk.slots).match(/(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/);
      if (range && !tk.duration) {
        const mins = (+range[3] * 60 + +range[4]) - (+range[1] * 60 + +range[2]);
        if (mins > 0) extra.durationMins = mins;
      }
    }
    if (tk?.duration) {
      const unit = norm(tk.durationUnit);
      extra.durationMins = unit.startsWith('hour') ? tk.duration * 60 : unit.startsWith('day') ? tk.duration * 1440 : tk.duration;
    }
    // Master-authored service link: nests this ticket under its transport
    // service in the PDF (the 🎟 button's explicit link keeps priority).
    if (tk?.forService && !a.forService) extra.forService = tk.forService;

    // Child/infant ticket rows only when the trip actually has children.
    const hasChildren = (pax?.children?.length || 0) > 0;
    const configs = String(a.activity?.ageConfig || 'Adult, Child').split(',').map((s) => s.trim()).filter(Boolean)
      .filter((cfg) => hasChildren || !/child|infant|kid/i.test(cfg));

    // Default Qty from the trip's pax count instead of always 1: adult rows
    // get the adult count; child rows get the children whose age falls in
    // that config's range (e.g. "Child (2-12)"), or — for a config with no
    // explicit range — whatever children weren't claimed by a ranged one.
    const childAges = (pax?.children || []).map((c) => Number(c.age) || 0);
    const usedChildIdx = new Set();
    const qtyFor = (cfg) => {
      if (/adult/i.test(cfg)) return pax?.adults || 1;
      if (!/child|infant|kid/i.test(cfg)) return 1;
      const range = cfg.match(/(\d+)\s*-\s*(\d+)/);
      const [lo, hi] = range ? [Number(range[1]), Number(range[2])] : [-Infinity, Infinity];
      let n = 0;
      childAges.forEach((age, idx) => {
        if (usedChildIdx.has(idx) || age < lo || age > hi) return;
        usedChildIdx.add(idx); n++;
      });
      return n;
    };

    const items = [];
    let hits = 0;
    for (const cfg of configs) {
      // eslint-disable-next-line no-await-in-loop
      const r = await lookupApi.activityRate({ activity: actId, service: name, config: cfg, date: actDate(a) }).catch(() => null);
      if (r) hits++;
      items.push({ type: cfg, qty: qtyFor(cfg), rate: r?.price || 0, given: r?.price || 0 });
    }
    setAct(ai, { ticketType: name, items, ...extra });
    const filled = [hits && `${hits} rate(s)`, extra.slot && `slot ${extra.slot}`, extra.durationMins && `${extra.durationMins} mins`].filter(Boolean);
    if (filled.length) toast.success(`Auto-filled ${filled.join(' · ')} from the master`);
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
          <Sparkles size={12} className="text-amber-500" /> Tip: Use <b className="font-semibold text-gray-600">Next Night</b> to repeat a hotel on the next free night, or <b className="font-semibold text-gray-600">Duplicate</b> to offer an alternative hotel option for the same night (Hotel A or Hotel B).
        </p>
        <div className="space-y-4">
          {(pkg.hotels || []).map((h, i) => (
            <div key={i} className={cn('rounded-xl border p-4', h.isAlternative ? 'border-dashed border-amber-300 bg-amber-50/30' : 'border-slate-200')}>
              {h.isAlternative && (
                <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                  <Copy size={12} /> Alternative option — same night(s), guest picks this hotel OR the one above. The package bills the highest-priced option.
                </p>
              )}
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
                      <AsyncSelect
                        loadOptions={async (s) => {
                          // The picked hotel's own meal plans (from its rate sheet);
                          // generic options only when no hotel is linked yet.
                          let hotel = h.hotel;
                          const hid = hotel?._id || hotel;
                          if (hotel && !hotel.mealPlans && hid) hotel = await hotelsApi.get(hid).catch(() => null);
                          const term = (s || '').toLowerCase();
                          if (hotel?.mealPlans?.length) {
                            return hotel.mealPlans.filter((p) => p.toLowerCase().includes(term)).map((p) => ({ _id: p, name: p }));
                          }
                          const opts = await optionsApi.search('mealPlan', s).catch(() => []);
                          return opts.map((o) => ({ _id: o.value, name: o.value }));
                        }}
                        value={h.mealPlan ? { _id: h.mealPlan, name: h.mealPlan } : null}
                        onChange={(v) => { const val = v ? v._id : ''; setHotel(i, { mealPlan: val }); maybeAutoRate(i, { mealPlan: val }); }}
                        creatable
                        onCreate={async (name) => ({ _id: name, name })}
                        placeholder="Type to search..."
                      />
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
                        onChange={(v) => { const val = v ? v._id : ''; setHotel(i, { roomType: val }); maybeAutoRate(i, { roomType: val }); }}
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
                    <button type="button" onClick={() => dupHotel(i)} title="Add an alternative hotel option for the same night(s)" className="btn-secondary text-xs text-brand-700"><Copy size={12} /> Duplicate</button>
                    <button type="button" onClick={() => rmHotel(i)} className="btn-ghost ml-auto text-xs text-slate-500 hover:text-red-600"><Trash2 size={12} /> Remove</button>
                  </div>
                  <p className="mt-1.5 text-right text-xs">
                    <span className="text-slate-400">{h.isAlternative ? 'Alternative price: ' : 'Hotel cost: '}</span>
                    <span className={cn('font-semibold tabular-nums', h.isAlternative ? 'text-amber-700' : 'text-slate-700')}>{money(hotelRowCost(h), currency)}</span>
                  </p>
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
            <div key={g.key} className="overflow-hidden rounded-xl border-2 border-brand-200 bg-white shadow-sm">
              {/* Gradient day banner */}
              <div className="flex items-center gap-2.5 bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 px-4 py-2">
                <CalendarDays size={14} className="text-white/85" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  {g.days.map((d) => `Day ${d}`).join(' · ')}
                </span>
                {startDate && (
                  <span className="text-[11px] font-medium text-white/75">
                    {g.days.map((d) => format(addDays(new Date(startDate), d - 1), 'EEE, d MMM')).join('  ·  ')}
                  </span>
                )}
              </div>
              <div className="flex gap-0 divide-x divide-brand-100">
                {/* LEFT: Days — applies to every service in this group */}
                <div className="w-44 shrink-0 bg-slate-50/70 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-400">Days</p>
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

                {/* RIGHT: the day's services stacked inside one card. An
                    activity added for a specific service renders DIRECTLY
                    under that service's section (matched via a.forService);
                    unrelated activities go after all services. */}
                <div className="flex-1 divide-y divide-gray-100">
                  {(() => {
                  const renderTransport = (ti) => {
                    const t = pkg.transports[ti];
                    // Rows sharing this location+days form one family — only the
                    // first renders (as ONE card); the rest appear as timing
                    // lines inside it.
                    const famRows = t.serviceLocation
                      ? g.tIdx.filter((i) => pkg.transports[i].serviceLocation === t.serviceLocation)
                      : [ti];
                    if (famRows[0] !== ti) return null;
                    const tDays = Array.isArray(t.days) ? t.days : (t.day ? [t.day] : [1]);
                    const firstDay = tDays[0] || 1;
                    const firstDate = startDate ? format(addDays(new Date(startDate), firstDay - 1), 'EEEE, d MMM') : `Day ${firstDay}`;
                    return (
                      <div key={`t-${ti}`}>
                        <div className="flex items-center gap-2.5 border-b border-brand-100 bg-gradient-to-r from-brand-50 to-white px-4 py-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm"><Bus size={12} /></span>
                          <span className="text-xs font-bold uppercase tracking-wide text-brand-700">Transport Service</span>
                          {t.serviceLocation && <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">{t.serviceLocation}</span>}
                          {famRows.length === 1 && t.serviceType && (
                            <button type="button" title={`Add activity/ticket for ${t.serviceType}`} onClick={() => addActForService(g.days, t.serviceType)} className="ml-auto flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-600 transition hover:bg-violet-100"><Ticket size={12} /> Ticket</button>
                          )}
                          <button type="button" onClick={() => rmTrFamily(famRows)} title="Remove this service" className={cn('text-xs font-medium text-slate-400 hover:text-red-500', !(famRows.length === 1 && t.serviceType) && 'ml-auto')}>&#10005;</button>
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
                        onChange={(v) => update({
                          transports: pkg.transports.map((x, idx) => (famRows.includes(idx)
                            ? { ...x, service: v?.raw?._id || null, serviceLocation: v ? v.name : '' }
                            : x)),
                        })}
                        creatable onCreate={(name) => Promise.resolve({ _id: name, name })}
                        placeholder="Port Blair to Havelock"
                      />
                      {t.service && <p className="mt-1 text-[11px] text-green-600">✓ Linked to transport master — rates can auto-fill</p>}
                    </div>
                    <div>
                      <label className="label">Service Type <span className="text-[10.5px] font-normal normal-case text-slate-400">(select one or more — each gets its own timing row)</span></label>
                      <AsyncSelect
                        isMulti
                        loadOptions={async (q) => {
                          const sid = typeof t.service === 'object' ? t.service?._id : t.service;
                          if (!sid) return [];
                          const s = await transportApi.get(sid).catch(() => null);
                          return (s?.items || [])
                            .map((it) => ({ _id: it.name, name: it.name }))
                            .filter((o) => o.name.toLowerCase().includes((q || '').toLowerCase()));
                        }}
                        value={trServiceTypeValue(t)}
                        onChange={(list) => setTrServiceTypes(ti, list)}
                        creatable onCreate={(name) => Promise.resolve({ _id: name, name })}
                        placeholder={t.service ? 'Type to search...' : 'Pick a service location first'}
                      />
                    </div>
                    {famRows.length > 1 ? (
                      <div>
                        <label className="label">Service Timings <span className="text-[10.5px] font-normal normal-case text-slate-400">(per service type)</span></label>
                        <div className="space-y-1.5">
                          {famRows.map((fi) => {
                            const ft = pkg.transports[fi];
                            return (
                              <div key={fi} className="flex items-center gap-2.5 rounded-lg border border-brand-200 border-l-4 border-l-brand-500 bg-brand-50/50 px-3 py-1.5">
                                <Clock size={13} className="shrink-0 text-brand-400" />
                                <span className="flex-1 truncate text-xs font-semibold text-slate-700" title={ft.serviceType}>{ft.serviceType || '—'}</span>
                                <input type="text" className="input w-28 py-1.5 text-xs" placeholder="e.g. 10:00 AM" value={ft.startTime || ''} onChange={(e) => setTr(fi, { startTime: e.target.value })} />
                                <input type="number" min="0" className="input w-20 py-1.5 text-xs" placeholder="Mins" value={ft.durationMins} onChange={(e) => setTr(fi, { durationMins: Number(e.target.value) })} />
                                <button type="button" title={`Add activity/ticket for ${ft.serviceType || 'this service'}`} onClick={() => addActForService(g.days, ft.serviceType)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-600 transition hover:bg-violet-100"><Ticket size={13} /></button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Start Time</label>
                        <input type="text" className="input" placeholder="e.g. 10:00 AM" value={t.startTime || ''} onChange={(e) => setTr(ti, { startTime: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">Duration (Mins)</label>
                        <input type="number" min="0" className="input" placeholder="60 Mins" value={t.durationMins} onChange={(e) => setTr(ti, { durationMins: Number(e.target.value) })} />
                      </div>
                    </div>
                    )}
                          </div>

                          {/* Transportation and Prices */}
                          <div className="w-96 shrink-0 border-l-2 border-brand-100 bg-gradient-to-b from-brand-50/60 to-slate-50/40 p-4">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-brand-700">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] text-white">₹</span>
                        Transportation and Prices
                      </p>
                      <button type="button" onClick={() => autoTrRateFamily(famRows)} title="Fetch rates from the transport price list" className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100"><Sparkles size={11} /> Auto rate</button>
                    </div>
                    {firstDate && <p className="mb-2 inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">{firstDate}</p>}
                    {famRows.map((fi, fidx) => {
                      const ft = pkg.transports[fi];
                      const cabItems = pkg.sameCabType ? sharedItems : (ft.items || []);
                      return (
                        <div key={fi} className={fidx > 0 ? 'mt-3 border-t-2 border-brand-100 pt-3' : ''}>
                          {famRows.length > 1 && (
                            <p className="mb-1.5 truncate text-[11px] font-bold uppercase tracking-wide text-brand-600" title={ft.serviceType}>{ft.serviceType || 'Service'}</p>
                          )}
                          <table className="w-full table-fixed text-xs">
                            <thead>
                              <tr className="bg-brand-50 text-brand-700">
                                <th className="rounded-l-md py-1.5 pl-2 text-left font-bold">Transportation</th>
                                <th className="py-1.5 text-left font-bold w-12">Date</th>
                                <th className="py-1.5 text-left font-bold w-[4.5rem]">Rate</th>
                                <th className="py-1.5 text-left font-bold w-[4.5rem]">Given</th>
                                <th className="w-6 rounded-r-md" />
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {cabItems.map((cabIt, ii) => {
                                // Per-transport rate/given (always from ft.items)
                                const priceIt = (ft.items || [])[ii] || {};
                                return (
                                  <tr key={ii}>
                                    <td className="py-1.5 pr-2">
                                      {pkg.sameCabType ? (
                                        <span className="text-slate-700">{cabIt.qty > 1 ? `${cabIt.qty} - ` : ''}{cabIt.type || '—'}</span>
                                      ) : (
                                        <AsyncSelect
                                          loadOptions={(q) => optionsApi.search('vehicleType', q).then((r) => r.map((o) => ({ _id: o.value, name: o.value })))}
                                          value={cabIt.type ? { _id: cabIt.type, name: cabIt.type } : null}
                                          onChange={(v) => setTrItem(fi, ii, { type: v ? v.name : '' })}
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
                                          setTrItem(fi, ii, keepGiven ? { rate: v } : { rate: v, given: v });
                                        }}
                                      />
                                    </td>
                                    <td className="py-1.5">
                                      <input
                                        type="number"
                                        className="input w-16 text-xs"
                                        placeholder="0"
                                        value={priceIt.given ?? ''}
                                        onChange={(e) => setTrItem(fi, ii, { given: Number(e.target.value) })}
                                      />
                                      {tDays.length > 1 && Number(priceIt.given) > 0 && (
                                        <div className="mt-0.5 text-[10px] text-slate-400">× {tDays.length}d = {((Number(priceIt.given) || 0) * (Number(priceIt.qty) || 1) * tDays.length).toLocaleString('en-IN')}</div>
                                      )}
                                    </td>
                                    <td className="py-1.5 pl-1 text-center">
                                      {!pkg.sameCabType && (ft.items || []).length > 1 && (
                                        <button type="button" onClick={() => rmTrItem(fi, ii)} className="text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {!pkg.sameCabType && (
                            <button type="button" onClick={() => addTrItem(fi)} className="mt-2 btn-secondary text-xs"><Plus size={11} /> Add Item</button>
                          )}
                        </div>
                      );
                    })}
                          </div>
                        </div>
                      </div>
                    );
                  };
                  {/* Activity / Ticket sub-blocks of this day */}
                  const renderActivity = (ai) => {
                    const a = pkg.activities[ai];
                    const aDays = Array.isArray(a.days) && a.days.length ? a.days : [1];
                    const configOptions = String(a.activity?.ageConfig || 'Adult, Child').split(',').map((s) => s.trim()).filter(Boolean);
                    return (
                      <div key={`a-${ai}`}>
                        <div className="flex items-center gap-2.5 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white px-4 py-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white shadow-sm"><Ticket size={12} /></span>
                          <span className="text-xs font-bold uppercase tracking-wide text-violet-700">Activity/Ticket</span>
                          {a.name && <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">{a.name}</span>}
                          {a.forService && <span className="max-w-[280px] truncate rounded-full border border-violet-200 px-2.5 py-0.5 text-[11px] font-medium text-violet-500" title={a.forService}>for: {a.forService}</span>}
                          <button type="button" onClick={() => rmAct(ai)} title="Remove this activity" className="ml-auto text-xs font-medium text-slate-400 hover:text-red-500">&#10005;</button>
                        </div>
                        <div className="flex gap-0">
                          {/* Activity details */}
                          <div className="flex-1 p-4 space-y-3">
                    <div>
                      <label className="label">Name <span className="text-[10.5px] font-normal normal-case text-slate-400">(matched to this day's services)</span></label>
                      <AsyncSelect
                        loadOptions={async (qs) => {
                          const list = ((await activitiesApi.list({ search: qs })).data || [])
                            .map((x) => ({ _id: x._id, name: x.name, raw: x }));
                          // Scope suggestions to the day's transport services:
                          // an activity is relevant when its name shares a word
                          // with the group's service locations/types (e.g. a
                          // "Port Blair Arrival" day surfaces the Port Blair
                          // activity). Falls back to the full list when nothing
                          // matches so no activity is ever unreachable.
                          // A ticket added from a specific service type scopes
                          // to that service alone; otherwise the whole day.
                          const ctx = (a.forService || g.tIdx
                            .map((i2) => pkg.transports[i2])
                            .flatMap((t2) => [t2.serviceLocation, t2.serviceType])
                            .filter(Boolean).join(' ')).toLowerCase();
                          if (!ctx) return list;
                          const relevant = list.filter((o) =>
                            o.name.toLowerCase().split(/[^a-z0-9]+/).some((w) => w.length > 3 && ctx.includes(w)));
                          return relevant.length ? relevant : list;
                        }}
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
                        {a.slotOptions?.length > 1 ? (
                          <select className="input" value={a.slot || ''} onChange={(e) => setAct(ai, { slot: e.target.value })}>
                            {!a.slotOptions.includes(a.slot) && <option value={a.slot}>{a.slot || 'Select…'}</option>}
                            {a.slotOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <input type="text" className="input" placeholder="e.g. 10:00 AM" value={a.slot || ''} onChange={(e) => setAct(ai, { slot: e.target.value })} />
                        )}
                      </div>
                      <div>
                        <label className="label">Duration (Mins)</label>
                        <input type="number" className="input" placeholder="60 Mins" value={a.durationMins ?? ''} onChange={(e) => setAct(ai, { durationMins: Number(e.target.value) })} />
                      </div>
                    </div>
                          </div>

                          {/* Tickets and Prices */}
                          <div className="w-96 shrink-0 border-l-2 border-violet-100 bg-gradient-to-b from-violet-50/60 to-slate-50/40 p-4">
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-violet-700">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] text-white">₹</span>
                        Tickets and Prices
                      </p>
                      <button type="button" onClick={() => autoActRate(ai)} title="Fetch rates from the activity price list" className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 transition hover:bg-amber-100"><Sparkles size={11} /> Auto rate</button>
                    </div>
                    <table className="w-full table-fixed text-xs">
                      <thead>
                        <tr className="bg-violet-50 text-violet-700">
                          <th className="rounded-l-md py-1.5 pl-2 text-left font-bold">Type</th>
                          <th className="py-1.5 text-left font-bold w-10">Qty.</th>
                          <th className="py-1.5 text-left font-bold w-14">Date</th>
                          <th className="py-1.5 text-left font-bold w-14">Rate</th>
                          <th className="py-1.5 text-left font-bold w-14">Given</th>
                          <th className="w-6 rounded-r-md" />
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
                  };
                  // Activities created from a service (🎟 button) slot in right
                  // after that service's section; the rest go at the end.
                  const attachedByHost = new Map();
                  const looseActs = [];
                  g.aIdx.forEach((ai2) => {
                    const svc = pkg.activities[ai2]?.forService;
                    const hostTi = svc ? g.tIdx.find((ti2) => pkg.transports[ti2].serviceType === svc) : undefined;
                    if (hostTi !== undefined) {
                      if (!attachedByHost.has(hostTi)) attachedByHost.set(hostTi, []);
                      attachedByHost.get(hostTi).push(ai2);
                    } else looseActs.push(ai2);
                  });
                  return [
                    ...g.tIdx.flatMap((ti2) => [renderTransport(ti2), ...(attachedByHost.get(ti2) || []).map(renderActivity)]),
                    ...looseActs.map(renderActivity),
                  ];
                  })()}

                  {/* Add more services to this day */}
                  <div className="flex gap-2 bg-slate-50/50 p-4">
                    <button type="button" onClick={() => addTrToGroup(g.days)} className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"><Plus size={12} /> Transport Service</button>
                    <button type="button" onClick={() => addAct(g.days)} className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"><Plus size={12} /> Activity/Ticket</button>
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
      <Section title="Set Markup, Discount, Tax and Rounding">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.6fr_1fr]">
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

          {/* Discount */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-500">Discount</p>
            <div className="flex items-center gap-2">
              <select className="input w-36" value={pkg.discountType || 'flat'} onChange={(e) => update({ discountType: e.target.value })}>
                <option value="flat">Flat</option><option value="percent">Percentage</option>
              </select>
              <input type="number" min="0" className="input w-24 text-center" value={pkg.discountValue ?? 0} onChange={(e) => update({ discountValue: Number(e.target.value) })} />
              <span className="text-sm text-slate-400">{(pkg.discountType || 'flat') === 'percent' ? '%' : currency}</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">Discount amount: <span className="font-semibold text-emerald-600">&minus; {money(c.discountAmount, currency)}</span></p>
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
          <span className="text-slate-300">&minus;</span>
          <span><span className="text-xs text-slate-400">Discount&nbsp;&nbsp;</span><span className="font-semibold tabular-nums text-emerald-600">{money(c.discountAmount, currency)}</span></span>
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
