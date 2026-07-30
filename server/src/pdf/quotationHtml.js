import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { company } from '../config/company.js';

// Local files under server/src/assets embedded as data URIs (badges, logos...).
const ASSETS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets');
const assetUri = (rel) => {
  try {
    const p = path.resolve(ASSETS_DIR, rel);
    const ext = path.extname(p).slice(1).toLowerCase();
    return `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${fs.readFileSync(p).toString('base64')}`;
  } catch { return ''; }
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad4 = (n) => { const s = String(n ?? '').trim(); return /^\d+$/.test(s) ? s.padStart(4, '0') : s; };
const inr = (n, dec = 0) => '&#8377;' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '&mdash;');
const fmtDateDM = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// "14:00" → "02:00 PM"; returns '' when unparsable.
const fmtTime = (hm) => {
  const m = String(hm || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '';
  let h = +m[1];
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m[2]} ${ap}`;
};
// Arrival = start time + duration minutes.
const arrTime = (hm, durMins) => {
  const m = String(hm || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m || !durMins) return '';
  const total = (+m[1]) * 60 + (+m[2]) + Number(durMins);
  const h24 = Math.floor(total / 60) % 24;
  return fmtTime(`${h24}:${String(total % 60).padStart(2, '0')}`);
};
const linkify = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
// Master descriptions may contain rich-text HTML; reduce to plain text for the PDF.
const stripHtml = (s) => String(s || '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n')
  .replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ')
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&quot;/gi, '"').replace(/&apos;/gi, "'")
  .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&')
  .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
// Renders text with a leading "Label: " prefix in bold when present.
const boldLabel = (x) => {
  const s = String(x ?? '');
  const idx = s.indexOf(': ');
  return idx > 0 && idx <= 45
    ? `<b>${esc(s.slice(0, idx + 1))}</b> ${esc(s.slice(idx + 2))}`
    : esc(s);
};

// Short place codes for the legend strips under the tables (PB | HL | NL ...).
const placeCode = (name) => {
  const t = String(name || '').trim();
  if (/^[A-Za-z]{2,3}$/.test(t)) return t.toUpperCase(); // already a short code (PB, HL, NL...)
  const s = t.toLowerCase();
  if (s.includes('port blair')) return 'PB';
  if (s.includes('havelock') || s.includes('swaraj')) return 'HL';
  if (s.includes('neil') || s.includes('shaheed')) return 'NL';
  if (s.includes('baratang')) return 'BT';
  if (s.includes('diglipur')) return 'DG';
  return String(name || '').split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 3);
};

// Page letterhead — brand block uses the org profile's uploaded logo when
// available (the wordmark image carries the name, so the text is dropped),
// falling back to the palm icon + name from the static config.
const letterhead = (brandHtml) => `
  <div class="lh">
    <div class="brand">${brandHtml}</div>
    <div class="lh-col">
      <div class="lh-head"><span class="lh-ic">&#128205;</span><b>Address</b></div>
      <div class="lh-val">${company.address.map(esc).join('<br/>')}</div>
    </div>
    <div class="lh-col wide">
      <div class="lh-head"><span class="lh-ic">&#9993;</span><b>Email</b></div>
      <div class="lh-val">${company.emails.map(esc).join('<br/>')}</div>
    </div>
    <div class="lh-col">
      <div class="lh-head"><span class="lh-ic">&#128222;</span><b>Phone</b></div>
      <div class="lh-val">${company.phones.map(esc).join('<br/>')}</div>
    </div>
  </div>`;

const BOTTOMBAR = '<div class="bottombar"></div>';

// Build the self-contained HTML for a populated quote document.
export function quotationHtml(q, org = null) {
  const orgLogo = org?.images?.logo || null;
  const brandHtml = orgLogo
    ? `<img class="logoimg" src="${orgLogo}"/>`
    : `<div class="logo">&#127796;</div>
      <div>
        <div class="bn">${esc(company.name)}</div>
        <div class="bsub">${esc(company.tagline)}</div>
      </div>`;
  const LETTERHEAD = letterhead(brandHtml);
  const logoIcon = orgLogo ? `<img class="logoimg" src="${orgLogo}"/>` : '<div class="logo">&#127796;</div>';
  const qlogoIcon = orgLogo ? `<img class="logoimg lg" src="${orgLogo}"/>` : '<div class="qlogo">&#127796;</div>';
  const pkg = (q.packages || [])[q.selectedPackageIndex || 0] || {};
  const guest = q.query?.guest || {};
  const paxAdults = q.pax?.adults || 0;
  const paxChildren = q.pax?.children?.length || 0;
  const pax = paxAdults + paxChildren;
  const start = q.startDate ? new Date(q.startDate) : null;
  const end = start ? addDays(start, q.nights || 0) : null;
  const tripTitle = `${q.nights}N${(q.nights || 0) + 1}D ${pkg.name || 'Package'} Tour to Andaman`;

  const cats = { hotel: 0, tour: 0, permits: 0, ferry: 0, misc: 0 };
  (q.costItems || []).forEach((it) => {
    const label = String(it.label || '').toLowerCase();
    const amt = it.amount || 0;
    if (it.category === 'hotel') cats.hotel += amt;
    else if (/ferry|cruise|makruzz|nautika|green ocean|itt|sea ?link|catamaran/.test(label)) cats.ferry += amt;
    else if (/permit|boat|entry|jetty/.test(label)) cats.permits += amt;
    else if (it.category === 'transport') cats.tour += amt;
    else cats.misc += amt;
  });
  const p = q.pricing || {};
  const servicePct = p.subtotal ? Math.round((p.markup / p.subtotal) * 100) : 0;
  const gstPct = pkg.taxPercent || (p.subtotal + p.markup ? Math.round((p.tax / (p.subtotal + p.markup)) * 100) : 0);
  const taxable = (p.subtotal || 0) + (p.markup || 0);
  const perPerson = pax ? Math.round((p.total || 0) / pax) : 0;
  const advance = Math.round(((p.total || 0) * company.advancePercent) / 100);

  const inclusions = q.inclusions?.length ? q.inclusions : company.defaultInclusions;
  const exclusions = q.exclusions?.length ? q.exclusions : company.defaultExclusions;
  const tcSections = Array.isArray(company.termsAndConditions) ? company.termsAndConditions : [];
  const whyUs = company.whyUs || {};
  const gallery = company.galleryImages || [];

  // ---- Ferry / transfer table ----
  // Static schedule fallback: match ferry name keyword + sector code (PB>HL ...)
  // against company.ferrySchedule when the transfer has no start time entered.
  const sectorKey = (loc) => {
    const parts = String(loc || '').split(/\s+to\s+|\s*(?:>|&gt;|→|—|–)\s*|\s+-\s+/i).filter(Boolean);
    return parts.length >= 2 ? `${placeCode(parts[0])}>${placeCode(parts[parts.length - 1])}` : '';
  };
  const staticTimes = (name, loc) => {
    const n = String(name || '').toLowerCase();
    const entry = (company.ferrySchedule || []).find((f) => n.includes(f.match));
    return entry?.times?.[sectorKey(loc)] || null;
  };
  const transports = pkg.transports || [];
  // Ferries/cruises are authored as Activities (name = sector, ticket type =
  // "Makruzz Ferry : Premium"), and occasionally as ferry-named transports.
  // Cab pickups and land transfers do NOT belong in this table.
  const FERRY_RX = /ferry|cruise|makruzz|nautika|green ocean|itt|sea ?link|catamaran/i;
  const splitCategory = (s) => {
    const [name, ...rest] = String(s || '').split(':');
    return [name.trim(), rest.join(':').trim()];
  };
  const ferries = [];
  (pkg.activities || []).forEach((a) => {
    if (!FERRY_RX.test(`${a.name} ${a.ticketType}`)) return;
    const [fname, category] = splitCategory(a.ticketType);
    ferries.push({ name: fname || a.name, sector: a.name, category, start: a.slot, dur: a.durationMins });
  });
  transports.forEach((t) => {
    if (!FERRY_RX.test(`${t.serviceType} ${t.serviceLocation}`)) return;
    const [fname, category] = splitCategory(t.serviceType);
    ferries.push({ name: fname || t.serviceLocation, sector: t.serviceLocation, category, start: t.startTime, dur: t.durationMins });
  });
  const splitSector = (loc) => String(loc || '').split(/\s+to\s+|\s*(?:>|&gt;|→|—|–)\s*|\s+-\s+/i).map((s) => s.trim()).filter(Boolean);
  const transferRows = ferries.map((f) => {
    const sched = staticTimes(`${f.name} ${f.category}`, f.sector);
    const dep = fmtTime(f.start) || (sched ? fmtTime(sched[0]) : '') || '&mdash;';
    const arr = arrTime(f.start, f.dur) || (sched ? fmtTime(sched[1]) : '') || '&mdash;';
    const parts = splitSector(f.sector);
    const chip = parts.length >= 2
      ? `<span class="schip"><span class="sc-pin">&#128205;</span>${esc(parts[0])}<span class="sc-ship">&#9972;</span>${esc(parts[parts.length - 1])}</span>`
      : `<span class="schip">${esc(f.sector)}</span>`;
    const cat = f.category
      ? `<span class="pill ${/premium|royal|luxury/i.test(f.category) ? 'purple' : 'navy'}">${/premium|royal|luxury/i.test(f.category) ? '&#128081; ' : ''}${esc(f.category)}</span>`
      : '&mdash;';
    return `<tr>
      <td class="bcell fname"><span class="fship">&#9972;</span>${esc(f.name)}</td>
      <td>${chip}</td>
      <td>${cat}</td>
      <td>${dep}</td>
      <td>${arr}</td>
    </tr>`;
  }).join('');
  const ferryLegend = ferries
    .map((f) => { const p = splitSector(f.sector); return p.length >= 2 ? `${esc(p[0])} to ${esc(p[p.length - 1])}` : esc(f.sector); })
    .filter(Boolean).join(' &nbsp;&#124;&nbsp; ');

  // ---- Hotels tables (summary page) — one card per package option with the
  // option's name + price in the heading so options compare at a glance. ----
  const hotels = pkg.hotels || [];
  // Alternatives ("Hotel A OR Hotel B" for the same night) show in hotel tables/
  // cards but must not shape the route, night counts, or day-to-city mapping.
  const primaryHotels = hotels.filter((h) => !h.isAlternative);
  const starRow = (n) => `<span class="tstars">${'&#9733;'.repeat(Math.min(n || 3, 5))}</span>`;
  // Alternatives ("Hotel A OR Hotel B") render INSIDE their primary's row —
  // options stacked in the name cell, differing values joined with " / " —
  // never as separate rows.
  const hotelRowsOf = (list) => {
    const overlap = (a, b) => (a.nights || []).some((n) => (b.nights || []).includes(n));
    const primaries = list.filter((h) => !h.isAlternative);
    const grouped = [
      ...primaries.map((p) => [p, list.filter((x) => x.isAlternative && overlap(p, x))]),
      ...list.filter((x) => x.isAlternative && !primaries.some((p) => overlap(p, x))).map((o) => [o, []]),
    ];
    const uniq = (vals) => [...new Set(vals.filter((v) => v || v === 0))];
    return grouped.map(([h, alts], rowIdx) => {
      const opts = [h, ...alts];
      const nameCell = opts.map((o, i) => {
        const master = o.hotel && typeof o.hotel === 'object' ? o.hotel : {};
        return `${i ? '<div style="margin:2px 0;color:#6b7684;font-weight:800">/</div>' : ''}
          <div class="hname-row">
            ${master.imageUrl ? `<img class="hthumb2" src="${esc(master.imageUrl)}" alt=""/>` : ''}
            <div><div class="hname">${esc(o.hotelName)}</div>${starRow(master.stars)}</div>
          </div>`;
      }).join('');
      const joined = (get) => uniq(opts.map(get)).map((v) => esc(String(v))).join(' / ') || '&mdash;';
      const roomChips = uniq(opts.map((o) => o.roomType))
        .map((r) => `<span class="rtchip rt${rowIdx % 3}">&#128716; ${esc(r)}</span>`).join(' ') || '&mdash;';
      const placeCell = uniq(opts.map((o) => o.city))
        .map((c) => `<span class="placecell"><span class="pc-pin">&#128205;</span>${esc(c)}</span>`).join(' / ') || '&mdash;';
      return `<tr>
        <td class="bcell hcell">${nameCell}</td>
        <td>${roomChips}</td><td>${placeCell}</td>
        <td>${joined((o) => o.rooms || 0)}</td><td>${(h.nights || []).length || 1}</td>
        <td>${joined((o) => o.aweb || 0)}</td><td>${joined((o) => o.cnb || 0)}</td>
        <td>${uniq(opts.map((o) => o.mealPlan)).map((m) => `<span class="pill navy">&#127860; ${esc(m)}</span>`).join(' ')}</td>
      </tr>`;
    }).join('');
  };
  const hotelOptionCards = (q.packages || [])
    .filter((p) => (p.hotels || []).length)
    .map((p, i, arr) => {
      const label = arr.length > 1 ? `Option ${i + 1}: ${esc(p.name || `Package ${i + 1}`)}` : `Hotel Information &mdash; ${esc(p.name || 'Package')}`;
      // Payment strip under the hotel table (replaces the old place-code
      // legend): total incl. GST, then the highlighted 50% booking amount.
      const gstPct = p.taxApplied ? (p.taxPercent || 5) : 5;
      const totalWithGst = p.taxApplied ? (p.sellingPrice || 0) : Math.round((p.sellingPrice || 0) * (1 + gstPct / 100));
      const payable = Math.round(totalWithGst / 2);
      return `<div class="seccard">
        <div class="sechead teal"><span class="shic">&#127976;</span><span class="shnum">2</span> ${label}</div>
        <div class="tbl flat"><table>
          <thead><tr><th>Hotel Name</th><th>Type of Room</th><th>Place</th><th>&#35; Rooms</th><th>&#35; Nights</th><th>Extra<br/>Mattress</th><th>W/O<br/>Mattress</th><th>Meal Plan</th></tr></thead>
          <tbody>${hotelRowsOf(p.hotels)}</tbody></table>
          <div class="psrow"><span>Total Tour Cost with these Hotels (incl. ${gstPct}% ${esc(p.taxName || 'GST')})</span><span class="psval">${inr(totalWithGst)}</span></div>
          <div class="psrow pshl"><span>Total Payable Amount to Confirm Booking (50%)</span><span class="psval">${inr(payable)}</span></div>
        </div>
      </div>`;
    })
    // Divider between option cards — a dashed line so the packages read as
    // separate choices.
    .join('<div class="ordivide"></div>');

  // ---- Hotels / Accommodations cards (own section — image + details) ----
  const ordinalPdf = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const hotelCards = hotels.map((h) => {
    const master = h.hotel && typeof h.hotel === 'object' ? h.hotel : {};
    const nightsArr = (h.nights || []).length ? h.nights : [1];
    const badges = nightsArr.map((n) => `<span class="nbadge">${ordinalPdf(n)}</span>`).join(' ');
    const checkIn = start ? fmtDate(addDays(start, nightsArr[0] - 1)) : '';
    const nameHtml = master.detailsLink
      ? `<a href="${esc(linkify(master.detailsLink))}" class="cardname">${esc(h.hotelName)} <span class="ext">&#8599;</span></a>`
      : `<span class="cardname">${esc(h.hotelName)}</span>`;
    const st = Math.min(master.stars || 3, 5);
    const desc = master.notes || master.address || '';
    const paxTotal = (Number(h.paxPerRoom) || 2) * (Number(h.rooms) || 1);
    return `<div class="hcard">
      <div class="hinfo">
        <div class="hnights">${h.isAlternative ? 'Alternative Option &mdash; ' : ''}${badges} Night${nightsArr.length > 1 ? 's' : ''} at <b>${esc(h.city || master.location?.city || '')}</b></div>
        ${checkIn ? `<div class="hcheckin">Check-in on ${checkIn}</div>` : ''}
        <div>${nameHtml}</div>
        <div class="cardstars">${'&#9733;'.repeat(st)}<span class="dim">${'&#9734;'.repeat(5 - st)}</span></div>
        ${desc ? `<div class="carddesc">${esc(String(desc).slice(0, 140))}</div>` : ''}
        <div class="hmeta">
          <div>
            <p class="k">ROOMS</p>
            <p class="v">${h.rooms || 1} ${esc(h.roomType || 'Room')}</p>
            <p class="s">${paxTotal} Pax${h.aweb ? ` + ${h.aweb} AWEB` : ''}${h.cnb ? ` + ${h.cnb} CNB` : ''}</p>
          </div>
          <div>
            <p class="k">MEAL PLAN</p>
            <p class="v">${esc(h.mealPlan || '—')}</p>
          </div>
        </div>
      </div>
      ${master.imageUrl ? `<img class="hphoto" src="${esc(master.imageUrl)}" alt=""/>` : ''}
    </div>`;
  }).join('');
  const hotelLegend = primaryHotels.map((h) => placeCode(h.city)).filter(Boolean).join(' &nbsp;&#124;&nbsp; ');

  // ---- Cover page data ----
  const fmtDateWD = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }) : '');
  const destCovered = (() => {
    const m = new Map();
    primaryHotels.forEach((h) => { const c = h.city || ''; if (c) m.set(c, (m.get(c) || 0) + ((h.nights || []).length || 1)); });
    return [...m.entries()].map(([c, n]) => `<b>${esc(c)} - ${n}</b>`).join(' &nbsp;<span class="pin">&#128205;</span>&nbsp; ');
  })();
  const heroImg = company.heroImage || gallery[2] || gallery[0] || '';

  // City a given trip day belongs to (from hotel night assignments).
  const cityOfDay = (n) => {
    const h = primaryHotels.find((x) => (x.nights || []).includes(n));
    return h?.city || primaryHotels[primaryHotels.length - 1]?.city || '';
  };

  // ---- Itinerary introduction (day list) ----
  // Each row: day title plus that day's services, e.g. "Port Blair Arrival - Cellular Jail Visit with Sound & Light Show".
  const introRows = (q.days || []).map((d) => {
    const onDay = (x, fallback) => (Array.isArray(x.days) && x.days.length ? x.days : [x.day || fallback]).includes(d.dayNumber);
    const title = (d.title && !/^day\s*\d+$/i.test(d.title.trim()) && d.title.trim()) || '';
    const norm = (s) => String(s || '').trim().toLowerCase();
    const svcNames = [
      ...(pkg.transports || []).filter((t) => onDay(t, 1)).map((t) => t.serviceType),
      ...(pkg.activities || []).filter((a) => onDay(a, 1)).map((a) => a.name),
    ].filter(Boolean).filter((s, i, arr) => norm(s) !== norm(title) && arr.findIndex((x) => norm(x) === norm(s)) === i);
    const headline = [title, svcNames.join(' + ')].filter(Boolean).join(' - ')
      || String(d.description || '').split(/\n|·|•/).map((x) => x.trim()).filter(Boolean).join(' + ')
      || 'Leisure day';
    return `<div class="introrow"><span class="introday">Day ${d.dayNumber}</span>${esc(headline)}</div>`;
  }).join('');

  // ---- Day wise itinerary (full-width day bands + hotel strip) ----
  const normName = (s) => String(s || '').trim().toLowerCase();
  // Photo for a service, matched by keyword against company.itineraryImages.
  const svcImage = (text) => {
    const s = String(text || '').toLowerCase();
    const hit = (company.itineraryImages || []).find((e) => String(e.match).split('|').some((k) => k && s.includes(k)));
    return hit?.image || '';
  };
  const activities = pkg.activities || [];
  // "Sightseeing" heading + place chips inside a day block (from the day's
  // sightseeing field, comma-separated — authored on the itinerary page).
  const sightBlock = (d) => {
    const places = String(d.sightseeing || '').split(/,|•|\n/).map((s) => s.trim()).filter(Boolean);
    if (!places.length) return '';
    return `<div class="dwsight">
      <p class="dwsighthead">Sightseeing</p>
      <div>${places.map((s) => `<span class="spill">${esc(s)}</span>`).join('')}</div>
    </div>`;
  };
  // Key for matching an auto-built description line ("Cellular Jail Visit ·
  // 09:00") back to the service/activity it came from: drop the time and any
  // trailing separators before comparing.
  const lineKey = (l) => normName(String(l).replace(/\d{1,2}:\d{2}.*$/, '').replace(/[\s·•|–—-]+$/g, ''));
  // Timeline rail icon by service keyword (ferry / flight / cab / sightseeing).
  const tlIcon = (text) => {
    const s = String(text || '').toLowerCase();
    if (/ferry|cruise|catamaran|makruzz|nautika|green ocean|itt|sea ?link|jetty|boat/.test(s)) return '&#9972;';
    if (/flight|airport|departure|drop/.test(s)) return '&#9992;';
    if (/cab|pickup|transfer|arrival/.test(s)) return '&#128663;';
    return '&#128247;';
  };
  const tlChip = (icon, label, value) => (value
    ? `<div class="tchip"><div class="tclab"><span>${icon}</span>${label}</div><div class="tcval">${value}</div></div>`
    : '');
  const tlRow = (icon, photo, inner) => `
    <div class="tlrow">
      <div class="tlicon"><span class="tlcirc">${icon}</span></div>
      <div class="tlbody">
        ${photo ? `<img class="tlphoto" src="${esc(photo)}" alt=""/>` : ''}
        <div class="tlinfo">${inner}</div>
      </div>
    </div>`;

  const dayBlocks = (q.days || []).map((d) => {
    const n = d.dayNumber || 1;
    const date = d.date || (start ? addDays(start, n - 1) : null);
    // Rich service rows: service name + "Day Schedule" description from the
    // transport master (imported from the Transport Excel), when available.
    const dayTs = transports.filter((t) => (Array.isArray(t.days) ? t.days : [t.day]).includes(n));
    const svcBlocks = dayTs.map((t) => {
      const master = t.service && typeof t.service === 'object' ? t.service : null;
      const item = (master?.items || []).find((it) => normName(it.name) === normName(t.serviceType));
      const desc = stripHtml(item?.description || '');
      // Photo for the sightseeing/service (Cellular Jail, Light & Sound show,
      // Radhanagar...) — item image first, route master image, then the
      // keyword-matched stock photo from company.itineraryImages.
      const photo = item?.imageUrl || master?.imageUrl || svcImage(`${t.serviceType} ${t.serviceLocation}`);
      if (!desc && !photo) return '';
      const paras = desc.split('\n').filter(Boolean)
        .map((p) => `<div class="tldesc">${esc(p)}</div>`).join('');
      const chips = [
        tlChip('&#128205;', 'Route', esc(t.serviceLocation || '')),
        tlChip('&#128336;', 'Start Time', fmtTime(t.startTime)),
        tlChip('&#8986;', 'Duration', t.durationMins ? `${t.durationMins} mins` : ''),
      ].join('');
      const inner = `<div class="tltitle">${esc(t.serviceType || t.serviceLocation || '')}</div>${paras}${chips ? `<div class="tchips">${chips}</div>` : ''}`;
      return tlRow(tlIcon(`${t.serviceType} ${t.serviceLocation}`), photo, inner);
    }).filter(Boolean).join('');
    // Activity rows (scuba, ferry tickets...) — photo from the activity
    // master + details from the matching ticket type (or activity-level).
    const dayActs = activities.filter((a) => (Array.isArray(a.days) && a.days.length ? a.days : [1]).includes(n));
    const actBlocks = dayActs.map((a) => {
      const master = a.activity && typeof a.activity === 'object' ? a.activity : null;
      const tk = (master?.ticketTypes || []).find((t2) => normName(t2.name) === normName(a.ticketType));
      const desc = stripHtml(tk?.details || master?.details || '');
      const photo = master?.imageUrl || svcImage(`${a.name} ${a.ticketType}`);
      if (!desc && !photo) return '';
      // Title shows the ferry/operator name without its category suffix; the
      // full ticket type stays in the chip below.
      const tkName = String(a.ticketType || '').split(':')[0].trim();
      const title2 = [a.name, tkName].filter(Boolean).join(' &mdash; ');
      const paras = desc.split('\n').filter(Boolean)
        .map((p) => `<div class="tldesc">${esc(p)}</div>`).join('');
      const chips = [
        tlChip('&#127915;', 'Ticket / Package', esc(a.ticketType || '')),
        tlChip('&#128336;', 'Slot', fmtTime(a.slot)),
        tlChip('&#8986;', 'Duration', a.durationMins ? `${a.durationMins} mins` : ''),
      ].join('');
      const inner = `<div class="tltitle">${title2}</div>${paras}${chips ? `<div class="tchips">${chips}</div>` : ''}`;
      return tlRow(tlIcon(`${a.name} ${a.ticketType}`), photo, inner);
    }).filter(Boolean).join('');
    const richBlocks = svcBlocks + actBlocks;
    const describedKeys = new Set([
      ...dayTs
        .filter((t) => {
          const master = t.service && typeof t.service === 'object' ? t.service : null;
          const item = (master?.items || []).find((it) => normName(it.name) === normName(t.serviceType));
          return stripHtml(item?.description || '') || item?.imageUrl || master?.imageUrl || svcImage(`${t.serviceType} ${t.serviceLocation}`);
        })
        .map((t) => normName(t.serviceType)),
      ...dayActs
        .filter((a) => {
          const master = a.activity && typeof a.activity === 'object' ? a.activity : null;
          const tk = (master?.ticketTypes || []).find((t2) => normName(t2.name) === normName(a.ticketType));
          return stripHtml(tk?.details || master?.details || '') || master?.imageUrl || svcImage(`${a.name} ${a.ticketType}`);
        })
        .flatMap((a) => [normName(a.name), normName([a.name, a.ticketType].filter(Boolean).join(' — '))]),
    ]);
    const lines = String(d.description || '').split(/\n|·|•/).filter((x) => x.trim())
      .filter((l) => !describedKeys.has(lineKey(l)))
      .filter((l) => !(richBlocks && /^\s*\d{1,2}:\d{2}\s*$/.test(l)))
      .map((l) => `<div class="ditem">&bull;&nbsp; ${esc(l.trim())}</div>`).join('')
      || (richBlocks ? '' : '<div class="ditem">&bull;&nbsp; Leisure day &mdash; enjoy the island at your own pace.</div>');
    const title = d.title && !/^day\s*\d+$/i.test(d.title.trim()) && !richBlocks ? d.title : '';
    // Leftover free-text lines (day title, custom bullets) get their own
    // timeline row so everything hangs off the icon rail.
    const lineRow = (title || lines)
      ? tlRow(tlIcon(`${title} ${d.description || ''}`), '', `${title ? `<div class="tltitle">${esc(title)}</div>` : ''}${lines}`)
      : '';
    const nightHotels = hotels.filter((h) => (h.nights || []).includes(n));
    const hotelRows = nightHotels.map((h) => {
      const master = h.hotel && typeof h.hotel === 'object' ? h.hotel : {};
      const st = Math.min(master.stars || 3, 5);
      const det = `<div class="hdet">
        <div class="hdr"><span class="hlab">&#127991; Category</span><span class="cardstars" style="font-size:12px;margin:0">${'&#9733;'.repeat(st)}<span class="dim">${'&#9734;'.repeat(5 - st)}</span></span></div>
        <div class="hdr"><span class="hlab">&#128716; Room Type</span><span class="hval">${esc(h.roomType || '—')}</span></div>
        <div class="hdr"><span class="hlab">&#127860; Meal Plan</span><span class="hval">${esc(h.mealPlan || '—')}</span></div>
        <div class="hdr"><span class="hlab">&#128682; Rooms</span><span class="hval">${h.rooms || 1} Room${(h.rooms || 1) > 1 ? 's' : ''}${h.aweb ? ` + ${h.aweb} AWEB` : ''}${h.cnb ? ` + ${h.cnb} CNB` : ''}</span></div>
      </div>`;
      const inner = `<div class="tltitle">Hotel${h.isAlternative ? ' (Alternative Option)' : ''}</div>
        <div class="tlname">${esc(h.hotelName)}</div>${det}`;
      return tlRow('&#128716;', master.imageUrl || '', inner);
    }).join('');
    const sight = sightBlock(d);
    return `<div class="dayblk">
      <div class="dwhead">
        <span class="daytab">Day ${n}</span>
        <span class="daycity">${esc(cityOfDay(n))}</span>
        ${date ? `<span class="dayhr"></span><span class="daydate">&#128197;&nbsp; ${fmtDateWD(date)}</span>` : ''}
      </div>
      <div class="tlwrap">${hotelRows}${richBlocks}${lineRow}</div>
      ${sight ? `<div class="tlextra">${sight}</div>` : ''}
    </div>`;
  }).join('') || '<p class="muted">No day-wise itinerary added.</p>';

  // ---- Optional activities (poster-style card grid) ----
  const optActs = (company.optionalActivities || []).map((a) => {
    const src = a.image ? (/^https?:/i.test(a.image) ? a.image : assetUri(a.image)) : '';
    return `<div class="oacard2">
      ${src ? `<img class="oa-img" src="${esc(src)}" alt=""/>` : ''}
      <div class="oa-label"><span class="oa-ic">${a.icon || '&#127754;'}</span><span class="oa-name">${esc(a.name)}</span></div>
      <div class="oa-cost">${a.onRequest ? '<span class="oa-req">On Request</span>' : `Adult Cost : <b>${inr(a.adult)}</b>`}</div>
    </div>`;
  }).join('');

  // ---- Terms & Conditions sections (numbered, reference-styled) ----
  // Config shape: { heading: 'N. Title', intro?, table? {headers, rows},
  // boxTitle?, items[] }. A section with a table renders its items in a light
  // box below the table; text-only sections render dotted-left paragraphs.
  // The "Important Notes" section gets the pill + bar treatment.
  const tcSectionsHtml = tcSections.map((s) => {
    const heading = String(s.heading || '');
    if (/important note/i.test(heading)) {
      return `<div class="tcnotes">
        <div class="tcnotes-pill">IMPORTANT NOTES</div>
        <div class="tcnotes-body">${(s.items || []).map((x) => `<div>${boldLabel(x)}</div>`).join('')}</div>
      </div>`;
    }
    const num = (heading.match(/^(\d+)\./) || [])[1] || '';
    const title = heading.replace(/^\d+\.\s*/, '');
    const tbl = s.table && s.table.rows?.length
      ? `<table class="tctbl2${(s.table.headers || []).length >= 3 ? ' navyhead' : ''}">
          <thead><tr>${(s.table.headers || []).map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
          <tbody>${s.table.rows.map((r) => `<tr>${r.map((c, ci) => `<td${ci === 0 ? ' class="c0"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>`
      : '';
    const items = s.items || [];
    const body = tbl
      ? (items.length ? `<div class="tcbox">
          ${s.boxTitle ? `<div class="tcbox-t">&#9881; ${esc(s.boxTitle)}</div>` : ''}
          ${items.map((x) => `<div class="tcbox-i">${s.boxTitle ? '&bull;&nbsp; ' : ''}${boldLabel(x)}</div>`).join('')}
        </div>` : '')
      : items.map((x) => `<div class="tcp">${boldLabel(x)}</div>`).join('');
    return `<div class="tcsec">
      <div class="tcsec-h">${num ? `<span class="tcnum">${num}</span>` : ''}${esc(title)}</div>
      ${s.intro ? `<div class="tcsec-intro">${esc(s.intro)}</div>` : ''}
      ${tbl}${body}
    </div>`;
  }).join('');

  // ---- Additional information page pieces ----
  const aiCard = (title, cls, items) => `
    <div class="aicard ${cls}">
      <div class="aihead">${title}</div>
      <div class="aibody">${(items || []).map((x) => `<div class="aiitem"><span class="dot"></span><span>${esc(x)}</span></div>`).join('')}</div>
    </div>`;
  const paymentQr = company.paymentQrImage
    ? (/^https?:/i.test(company.paymentQrImage) ? company.paymentQrImage : assetUri(company.paymentQrImage))
    : '';
  const ecRows = (company.emergencyContacts || []).map((c) => `<tr>
    <td>${esc(c.name)}</td><td>${esc(c.phone)}</td>
    <td>${esc(c.email)}</td><td>${esc(c.availableOn)}</td>
  </tr>`).join('');
  const socialIcons = (company.social || []).map((s) => `
    <a class="soc" href="${esc(s.url)}">
      <span class="socicon" style="background:${esc(s.color)}">${s.short}</span>
      <span class="soclbl">${esc(s.label)}</span>
    </a>`).join('');

  const extras = (pkg.extras || []).map((e) => e.label || e.name).filter(Boolean).join(', ');

  // ---- Client review posters (Why Us + closing pages) ----
  // Asset filenames are embedded as data URIs; http(s) URLs pass through.
  const reviewImgs = (whyUs.reviewImages || [])
    .map((f) => (/^https?:/i.test(f) ? f : assetUri(f)))
    .filter(Boolean);
  const reviewCell = (src) => `<div class="rimg"><img src="${esc(src)}" alt=""/></div>`;
  const reviewGrid = reviewImgs.slice(0, 4).map(reviewCell).join('');
  const reviewRow = reviewImgs.slice(4).map(reviewCell).join('');

  const reviewRows = (whyUs.reviewLinks || []).map((rl) => `
    <div class="rm-row"><b>${esc(rl.label)}:</b><span class="rm-url">${esc(rl.url)}</span></div>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet"/>
<style>
  :root {
    --blue: #1577bd; --blue-dark: #0e5fa0; --navy: #14498f;
    --deep: #16295c; --orange: #f36f21;
    --lblue: #d9ecf9; --lblue2: #eef6fc; --line: #cfdae5;
    --yellow: #fdefad; --green: #18a24b; --ink: #16212e;
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
  /* Page stays white; the soft sky tint lives INSIDE the cards/tables. */
  body { font-family: 'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif; color: var(--ink); font-size: 13px; background: #fff; -webkit-font-smoothing: antialiased; }

  /* ---- page wrapper: flex column so the blue bar pins to the bottom ---- */
  .page { min-height: 272mm; display: flex; flex-direction: column; }
  .pb { page-break-after: always; }
  .bottombar { margin-top: auto; height: 7px; background: linear-gradient(90deg, var(--blue-dark), var(--blue) 45%, #f6a83b); border-radius: 2px; }
  .grow { flex: 1; }

  /* ---- letterhead: brand + icon columns (Address | Email | Phone) ---- */
  .lh { display: flex; align-items: center; margin-bottom: 8px; }
  .brand { display: flex; align-items: center; justify-content: flex-start; gap: 9px; width: 30%; flex-shrink: 0; padding-right: 12px; }
  .logo { width: 38px; height: 38px; border-radius: 10px; background: var(--deep); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 19px; flex-shrink: 0; }
  .logoimg { height: 62px; max-width: 100%; object-fit: contain; }
  .logoimg.lg { height: 64px; max-width: 260px; }
  .bn { font-size: 14.5px; font-weight: 800; color: var(--deep); line-height: 1.2; white-space: nowrap; }
  .bsub { font-size: 7.5px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-top: 2px; }
  .lh-col { flex: 1; padding: 1px 12px; border-left: 1px solid #dfe6ee; }
  .lh-col.wide { flex: 1.2; }
  .lh-head { display: flex; align-items: center; gap: 7px; margin-bottom: 4px; }
  .lh-head b { font-size: 11.5px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--deep); }
  .lh-ic { width: 24px; height: 24px; flex-shrink: 0; border-radius: 50%; background: var(--deep); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; }
  .lh-val { font-size: 9.8px; color: #445468; line-height: 1.5; }

  /* ---- blue band heading ---- */
  .band { background: linear-gradient(90deg, var(--blue-dark), var(--blue) 55%, #2f96dd); color: #fff; padding: 10px 16px; font-weight: 800; font-size: 17px; border-radius: 5px; margin-bottom: 14px; }

  /* ---- page-1 quotation panels ---- */
  .panels { display: flex; justify-content: space-between; gap: 56px; margin: 2px 0 4px; }
  .panel { flex: 1; border: 1.5px solid var(--blue-dark); border-radius: 10px; overflow: hidden; }
  .ph { background: var(--blue); color: #fff; padding: 8px 14px; font-weight: 700; font-size: 14px; }
  .pc { background: var(--lblue); padding: 8px 14px 9px; min-height: 48px; }
  .pill { display: inline-block; border-radius: 999px; padding: 2.5px 11px; color: #fff; font-size: 11px; font-weight: 700; white-space: nowrap; }
  .pill.navy { background: var(--navy); }
  .pill.pl0 { background: #3565d6; } .pill.pl1 { background: #8b3fd1; } .pill.pl2 { background: #0e6b50; }

  /* ---- section headings ---- */
  .h1 { font-size: 21px; font-weight: 800; color: var(--ink); margin: 10px 0 4px; }

  /* ---- tables ---- */
  .tbl { border: 1px solid var(--line); border-radius: 9px; overflow: hidden; margin-top: 7px; background: #fff; }
  .tbl table { width: 100%; border-collapse: collapse; }
  .tbl thead th { background: #f4f8fc; color: var(--deep); padding: 7px 6px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.03em; text-align: center; font-weight: 800; border-bottom: 1px solid #dfe9f2; }
  .tbl td { padding: 7px 6px; text-align: center; font-size: 12.5px; font-weight: 600; color: var(--deep); border-top: 1px solid #eaf0f6; }
  .tbl tbody tr:first-child td { border-top: 0; }

  /* ---- section cards (summary page) ---- */
  .seccard { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; margin-top: 9px; background: #fff; break-inside: avoid; page-break-inside: avoid; }
  .ordivide { border-top: 2px dashed #9fbddd; margin: 18px 0; }
  .sechead { display: flex; align-items: center; gap: 10px; background: linear-gradient(90deg, #1259c9, #2f97ec 60%, #4fa9f2); padding: 7px 14px; font-weight: 800; font-size: 13.5px; color: #fff; text-transform: uppercase; letter-spacing: 0.03em; }
  .sechead.teal { background: linear-gradient(90deg, #0b8f80, #2bbfae 55%, #6fd6c3); }
  .sechead.navy { background: var(--deep); }
  .sechead .shic { width: 28px; height: 28px; flex-shrink: 0; border-radius: 50%; background: #fff; color: var(--deep); display: flex; align-items: center; justify-content: center; font-size: 14px; }
  .sechead .shnum { width: 20px; height: 20px; flex-shrink: 0; border-radius: 50%; background: #fff; color: var(--deep); display: flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 800; }
  .secprice { margin-left: auto; background: var(--yellow); color: var(--ink); border: 1px solid #e6d98f; border-radius: 999px; padding: 2px 13px; font-size: 12.5px; font-weight: 800; letter-spacing: 0; text-transform: none; }
  .tbl.flat { border: 0; border-radius: 0; margin-top: 0; }
  .tbl.flat.sep { border-top: 1px solid var(--line); }

  /* ---- ferry sector chips + category pills ---- */
  .fname { white-space: nowrap; }
  .fname .fship { margin-right: 4px; }
  .schip { display: inline-flex; align-items: center; gap: 6px; border: 1.3px solid #bcd6f2; background: #fff; border-radius: 999px; padding: 3px 13px; font-size: 11.5px; font-weight: 800; color: var(--deep); white-space: nowrap; }
  .schip .sc-pin, .schip .sc-ship { font-size: 10px; }
  .pill.purple { background: #7c3aed; }

  /* ---- hotel rows: thumbnail + name + stars, room chips ---- */
  .hname-row { display: flex; align-items: center; gap: 9px; text-align: left; }
  .hthumb2 { width: 52px; height: 40px; object-fit: cover; border-radius: 7px; flex-shrink: 0; }
  .hname { font-weight: 800; font-size: 12.5px; color: var(--deep); line-height: 1.3; }
  .rtchip { display: inline-block; border-radius: 8px; padding: 3.5px 10px; font-size: 11px; font-weight: 700; color: var(--deep); }
  .rtchip.rt0 { background: #e3f0fd; } .rtchip.rt1 { background: #e6f6ec; } .rtchip.rt2 { background: #fdf5dc; }
  .placecell { white-space: nowrap; }
  .placecell .pc-pin { color: var(--blue); font-size: 10.5px; margin-right: 2px; }

  /* ---- fare summary row icons ---- */
  .fic { display: inline-flex; align-items: center; justify-content: center; width: 21px; height: 21px; border: 1px solid #d5e0ea; border-radius: 6px; background: #fff; font-size: 11px; margin-right: 9px; vertical-align: -5px; }

  /* ---- fare summary ---- */
  .fare { width: 100%; border-collapse: collapse; }
  .fare td { padding: 4.5px 16px; font-size: 12.5px; border-top: 1px dashed #cddcea; color: #2c3d51; }
  .fare tr:first-child td { border-top: 0; }
  .fare td.k { font-weight: 700; color: var(--ink); }
  .fare td.v { text-align: right; font-weight: 700; color: var(--blue-dark); }
  .fare tr.final td { background: linear-gradient(90deg, #fde68a, #fdf3c0); border-top: 1px solid var(--line); font-weight: 800; color: var(--ink); font-size: 14px; }
  .tbl td.bcell { font-weight: 700; }
  .tbl td.dkcell { color: var(--ink); }
  .tbl .legend { background: #fff; border-top: 1px solid var(--line); padding: 5.5px; text-align: center; font-size: 11px; font-weight: 800; color: var(--blue); }
  .tbl .legend .lgwave { color: #7fb4e8; letter-spacing: -2px; }
  /* Payment strip under hotel option tables — same table idiom (row +
     dashed divider), with the 50% booking line highlighted in brand blue
     and the amount in the yellow price pill. */
  .psrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: #f2f6fa; border-top: 1px dashed #cddcea; padding: 6px 14px; font-size: 12px; font-weight: 700; color: var(--navy); }
  .psrow .psval { font-weight: 800; font-size: 13px; color: var(--blue-dark); }
  .psrow.pshl { background: linear-gradient(90deg, var(--blue), var(--blue-dark)); color: #fff; font-size: 13px; font-weight: 800; letter-spacing: 0.01em; padding: 8px 14px; }
  .psrow.pshl .psval { background: var(--yellow); color: var(--ink); border: 1px solid #e6d98f; border-radius: 999px; padding: 2.5px 13px; font-size: 13px; }
  .tbl td.hl { background: var(--yellow); color: var(--ink); font-weight: 800; font-size: 14px; }
  .muted { color: #94a3b8; text-align: center; padding: 8px; font-weight: 500; }
  .tbl td.hcell { text-align: left; }
  .tstars { color: #f5a623; font-size: 11px; letter-spacing: 1px; }
  .ext { font-size: 8px; }

  /* ---- Hotels / Accommodations cards ---- */
  .hcard { display: flex; align-items: stretch; gap: 16px; border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; background: #f8fbfe; }
  .hinfo { flex: 1; min-width: 0; }
  .nbadge { display: inline-block; border: 1.4px solid var(--blue); color: var(--blue-dark); font-weight: 800; font-size: 10.5px; border-radius: 6px; padding: 1.5px 7px; }
  .hnights { font-size: 14.5px; color: #2c3d51; margin-bottom: 2px; }
  .hnights b { font-size: 15.5px; color: var(--ink); }
  .hcheckin { font-size: 11px; color: #64748b; margin-bottom: 7px; }
  .cardname { font-size: 16.5px; font-weight: 800; color: var(--blue-dark); text-decoration: none; }
  a.cardname { text-decoration: underline; }
  .cardstars { color: #f5a623; font-size: 14px; letter-spacing: 1.5px; margin: 2px 0 4px; }
  .cardstars .dim { color: #d7dde5; }
  .carddesc { font-size: 11px; color: #64748b; line-height: 1.5; margin-bottom: 6px; }
  .hmeta { display: flex; gap: 34px; margin-top: 6px; }
  .hmeta .k { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: #8fa0b3; }
  .hmeta .v { font-size: 13px; font-weight: 700; color: var(--ink); margin-top: 1px; }
  .hmeta .s { font-size: 10.5px; color: #64748b; }
  .hphoto { width: 225px; height: 130px; object-fit: cover; border-radius: 9px; flex-shrink: 0; align-self: center; }

  /* ---- cost breakage + confirm bar ---- */
  .breakrow { display: flex; gap: 14px; margin-top: 10px; }
  .cb { flex: 1; display: flex; border: 1px solid var(--line); border-radius: 9px; overflow: hidden; }
  .cb .l { background: var(--blue); color: #fff; font-weight: 800; font-size: 16px; line-height: 1.35; display: flex; align-items: center; justify-content: center; text-align: center; width: 38%; padding: 10px; }
  .cb .rows { flex: 1; display: flex; flex-direction: column; }
  .cb .row { flex: 1; display: flex; }
  .cb .row + .row { border-top: 1px solid var(--line); }
  .cb .k { flex: 1.25; display: flex; align-items: center; justify-content: flex-end; padding: 5px 12px; font-weight: 700; font-size: 12px; text-transform: uppercase; }
  .cb .v { flex: 1; background: var(--yellow); border-left: 1px solid var(--line); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13.5px; }
  .cb .row { min-height: 26px; }
  .cb .v.tv { background: #e4f6ea; color: #0e7a38; font-weight: 800; }
  .confirm { display: flex; margin-top: 8px; border-radius: 9px; overflow: hidden; }
  .confirm .lab { flex: 1; background: var(--blue); color: #fff; font-weight: 800; font-size: 15.5px; display: flex; align-items: center; justify-content: center; padding: 8px; }
  .confirm .amt { background: var(--green); color: #fff; font-weight: 800; font-size: 22px; padding: 8px 36px; display: flex; align-items: center; white-space: nowrap; }
  .notebox { margin-top: 6px; border: 1px solid var(--line); border-radius: 9px; padding: 5px 14px; font-size: 10.5px; color: #37475a; text-align: center; line-height: 1.5; }

  /* ---- cover page ---- */
  .hero2 { position: relative; border-radius: 14px; overflow: hidden; height: 136mm; border: 2.5px solid var(--deep); }
  .hero2-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .hero2-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,24,54,0.30) 0%, rgba(10,24,54,0.10) 32%, rgba(10,24,54,0.55) 62%, rgba(9,21,48,0.88) 100%); }
  .hero2-body { position: absolute; inset: 0; display: flex; flex-direction: column; color: #fff; padding: 26px 30px 22px; }
  .hx-script { font-family: 'Dancing Script', 'Segoe Script', cursive; font-size: 46px; font-weight: 700; line-height: 0.85; text-shadow: 0 2px 10px rgba(0,0,0,0.45); }
  .hx-script::after { content: ''; display: block; width: 92px; height: 4px; margin: 6px 0 2px 4px; border-radius: 99px; background: var(--orange); }
  .hx-title { font-size: 62px; font-weight: 800; letter-spacing: 3px; line-height: 1.05; text-shadow: 0 3px 12px rgba(0,0,0,0.5); }
  .hx-why { margin-top: auto; font-size: 19px; font-weight: 800; text-shadow: 0 2px 8px rgba(0,0,0,0.55); }
  .hx-why span { color: var(--orange); }
  .hx-point { margin-top: 6px; font-size: 12.5px; font-weight: 700; text-shadow: 0 1px 6px rgba(0,0,0,0.65); }
  .hx-check { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; margin-right: 7px; border-radius: 50%; background: var(--orange); color: #fff; font-size: 9px; vertical-align: 1px; }
  .hx-pillwrap { margin-top: 13px; }
  .hx-pill { display: inline-block; background: #fff; color: var(--deep); font-weight: 800; font-size: 13px; letter-spacing: 0.06em; padding: 6px 30px; border-radius: 999px; box-shadow: 0 2px 8px rgba(0,0,0,0.35); }
  .hx-icons { display: flex; justify-content: space-between; gap: 6px; margin-top: 12px; }
  .hx-item { flex: 1; text-align: center; min-width: 0; }
  .hx-circle { width: 52px; height: 52px; margin: 0 auto; border-radius: 50%; background: #fff; color: var(--deep); display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.35); }
  .hx-lbl { margin-top: 6px; font-size: 8.4px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; line-height: 1.3; text-shadow: 0 1px 5px rgba(0,0,0,0.7); }
  .hx-sub { display: block; color: var(--orange); }
  .coverband { display: flex; align-items: center; gap: 10px; background: var(--deep); color: #fff; font-weight: 800; font-size: 18px; letter-spacing: 0.02em; padding: 11px 18px; margin-top: 10px; border-radius: 8px; text-transform: uppercase; }
  .coverband .cb-ic { font-size: 17px; }
  .coverband .cb-route { color: var(--orange); font-size: 15px; margin-left: 2px; }
  .covermeta { display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 600; color: #37475a; margin: 10px 2px 4px; }
  .stats { display: flex; align-items: stretch; margin-top: 12px; text-align: center; }
  .stat { flex: 1; min-width: 0; padding: 2px 8px; }
  .stat + .stat { border-left: 1px solid #dfe6ee; }
  .statico { width: 38px; height: 38px; margin: 0 auto 7px; border-radius: 50%; background: #edf1f7; color: var(--deep); display: flex; align-items: center; justify-content: center; font-size: 18px; }
  .stat .sk { font-size: 10.5px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: #46566a; }
  .stat .sv { font-size: 15px; font-weight: 800; color: var(--deep); margin-top: 3px; }
  .destcov { position: relative; text-align: center; border-top: 1px solid #dfe6ee; margin-top: 14px; padding-top: 21px; }
  .destcov .statico { position: absolute; top: -16px; left: 50%; transform: translateX(-50%); width: 32px; height: 32px; font-size: 15px; margin: 0; border: 3px solid #fff; }
  .destcov .sk { font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #46566a; }
  .destcov .sv { font-size: 14px; font-weight: 700; margin-top: 5px; color: var(--deep); }
  .stat .ss { font-size: 10.5px; color: #64748b; margin-top: 2px; }

  /* ---- Ratings + award badge cards on the cover ---- */
  .recogrow { margin-top: 22px; display: flex; align-items: stretch; gap: 22px; }
  .ratecard { position: relative; flex: 1.15; border: 1px solid var(--line); border-radius: 13px; background: #f6f8fb; padding: 17px 24px 11px; }
  .ratecard:last-child { flex: 1; }
  .rcpill { position: absolute; top: -11px; left: 34px; background: var(--deep); color: #fff; font-weight: 800; font-size: 10.5px; letter-spacing: 0.09em; padding: 4px 20px; border-radius: 999px; white-space: nowrap; }
  .rcitems { display: flex; justify-content: center; margin-top: 4px; }
  .rcitem { flex: 1; text-align: center; }
  .rcitem + .rcitem { border-left: 1px solid #dfe6ee; }
  .rcitem .rclogo { height: 44px; object-fit: contain; }
  .rccap { margin-top: 4px; font-size: 11.5px; color: #37475a; }
  .rccap b { font-size: 12.5px; color: var(--ink); }
  .bottombar.navy { background: var(--deep); }
  .awardrow { display: flex; justify-content: center; align-items: stretch; gap: 14px; margin-top: 8px; }
  .awardrow .rbadge { min-width: 0; min-height: 0; border: 0; box-shadow: none; padding: 0 6px; }
  .awardrow .rbadge img { max-height: 78px; }
  .rbadge { min-width: 140px; max-width: 220px; min-height: 96px; border: 1px solid var(--line); border-radius: 10px; background: #fff; display: flex; align-items: center; justify-content: center; padding: 8px 14px; box-shadow: 0 1px 3px rgba(15,45,80,0.08); }
  .rbadge img { max-width: 100%; max-height: 120px; object-fit: contain; }
  .aato { text-align: center; }
  .aatoring { display: inline-block; border: 3px double #1577bd; border-radius: 50%; color: #1577bd; font-weight: 800; font-size: 17px; letter-spacing: 0.14em; padding: 9px 20px; }
  .aatosub { margin-top: 4px; font-size: 6.8px; font-weight: 700; letter-spacing: 0.06em; color: #2c5f8a; line-height: 1.4; }
  .andmn { text-align: center; }
  .andmn .a1 { font-family: 'Segoe Script', 'Brush Script MT', cursive; font-size: 23px; color: #1577bd; line-height: 1.1; }
  .andmn .a2 { margin-top: 3px; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; color: #0e8a4e; }
  .goog { text-align: center; }
  .goog .g1 { font-size: 21px; font-weight: 700; letter-spacing: -0.5px; line-height: 1; }
  .goog .g2 { font-size: 12px; font-weight: 800; color: var(--ink); margin-top: 2px; }
  .goog .g3 { color: #f5a623; font-size: 13px; letter-spacing: 2px; margin-top: 1px; }
  .destcov .pin { font-size: 11px; }

  /* ---- itinerary introduction ---- */
  .introrow { font-size: 12.8px; color: #2c3d51; padding: 7px 4px; border-bottom: 1px dashed #d5e0ea; line-height: 1.5; }
  .introrow:last-child { border-bottom: 0; }
  .introday { display: inline-block; min-width: 52px; font-weight: 800; color: var(--blue-dark); }

  /* ---- day-wise itinerary (timeline cards) ---- */
  .dayblk { break-inside: avoid; page-break-inside: avoid; margin-bottom: 14px; border: 1px solid #e2e9f0; border-radius: 12px; overflow: hidden; background: #fff; }
  .dwhead { display: flex; align-items: center; gap: 13px; background: #f7f9fc; border-bottom: 1px solid #e8eef5; padding: 8px 16px 8px 8px; }
  .daytab { background: var(--deep); color: #fff; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 17px; border-radius: 8px; white-space: nowrap; }
  .daycity { color: var(--blue); font-weight: 800; font-size: 15.5px; text-transform: uppercase; letter-spacing: 0.05em; }
  .dayhr { width: 1px; align-self: stretch; background: #d5dfe9; margin: 3px 2px; }
  .daydate { font-size: 12px; font-weight: 600; color: #37475a; }
  .tlwrap { position: relative; padding: 11px 16px 11px 8px; }
  .tlwrap::before { content: ''; position: absolute; left: 29px; top: 30px; bottom: 30px; border-left: 2px dotted #b9cbe0; }
  .tlrow { position: relative; display: flex; gap: 13px; padding: 9px 0; }
  .tlicon { width: 44px; flex-shrink: 0; display: flex; justify-content: center; }
  .tlcirc { position: relative; z-index: 1; width: 36px; height: 36px; border-radius: 50%; background: var(--deep); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 0 0 3px #fff; }
  .tlbody { flex: 1; min-width: 0; display: flex; gap: 15px; align-items: flex-start; }
  .tlphoto { width: 168px; height: 118px; object-fit: cover; border-radius: 10px; flex-shrink: 0; box-shadow: 0 1px 4px rgba(15,45,80,0.15); }
  .tlinfo { flex: 1; min-width: 0; }
  .tltitle { color: var(--blue); font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; line-height: 1.5; }
  .tlname { color: var(--blue); font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.03em; }
  .tldesc { font-size: 12px; color: #2c3d51; line-height: 1.7; text-align: justify; margin-top: 6px; }
  .hdet { margin-top: 7px; }
  .hdr { display: flex; align-items: center; gap: 10px; padding: 4.5px 0; border-top: 1px solid #eef2f7; font-size: 11.5px; color: var(--ink); }
  .hdr:first-child { border-top: 0; }
  .hlab { min-width: 112px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--blue); }
  .hval { font-weight: 600; }
  .tchips { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
  .tchip { border: 1px solid #e2e9f0; background: #fbfcfe; border-radius: 10px; padding: 7px 15px; min-width: 96px; }
  .tclab { display: flex; align-items: center; gap: 6px; font-size: 9px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--blue); }
  .tcval { margin-top: 3px; font-size: 11.5px; font-weight: 700; color: var(--ink); }
  .ditem { font-size: 12.5px; color: #2c3d51; line-height: 1.65; margin-top: 3px; }
  .tlextra { padding: 0 16px 12px; }
  .dwsight { border-top: 1px dashed #d5e0ea; padding-top: 8px; }
  .dwsighthead { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--navy); margin-bottom: 4px; }
  .spill { display: inline-block; background: #eaf3fb; color: var(--blue-dark); border: 1px solid #cfe2f1; border-radius: 999px; padding: 2.5px 11px; font-size: 10.5px; font-weight: 700; margin: 0 5px 4px 0; }
  /* "Please note" strip under the itinerary */
  .notestrip { display: flex; align-items: center; gap: 11px; margin-top: 10px; background: #eef4fb; border: 1px solid #d8e6f5; border-radius: 10px; padding: 8px 15px; font-size: 11px; color: #2c3d51; line-height: 1.5; }
  .notestrip b { color: var(--deep); font-size: 10.5px; letter-spacing: 0.05em; white-space: nowrap; }
  .notestrip .ni { width: 22px; height: 22px; flex-shrink: 0; border-radius: 50%; background: var(--deep); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; font-style: normal; }
  .notestrip .nsdiv { width: 1px; align-self: stretch; background: #c9d9ea; }

  /* ---- optional activities (poster-style cards) ---- */
  .oa-title { display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 27px; font-weight: 800; letter-spacing: 1.5px; margin-top: 2px; }
  .oa-title::before, .oa-title::after { content: ''; width: 76px; height: 3px; border-radius: 3px; background: var(--deep); }
  .oa-t1 { color: var(--deep); } .oa-t2 { color: #1e88e5; }
  .oa-sub { text-align: center; font-size: 11.5px; font-weight: 700; color: #22303f; margin-top: 5px; }
  .oagrid2 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 11px; margin-top: 12px; }
  .oacard2 { border: 1px solid #dfe6ee; border-radius: 10px; overflow: hidden; background: #fff; break-inside: avoid; page-break-inside: avoid; }
  .oa-img { width: 100%; height: 44mm; object-fit: cover; display: block; }
  .oa-label { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 7px 8px 6px; min-height: 40px; }
  .oa-ic { width: 27px; height: 27px; flex-shrink: 0; border-radius: 50%; background: var(--deep); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; }
  .oa-name { font-weight: 800; font-size: 11px; text-transform: uppercase; color: var(--ink); letter-spacing: 0.02em; line-height: 1.3; }
  .oa-cost { text-align: center; padding: 5px 6px 8px; font-size: 10.8px; font-weight: 700; color: var(--deep); border-top: 1px solid #eef2f7; }
  .oa-cost b, .oa-req { color: #1e88e5; }
  .oa-notes { margin-top: 12px; border: 1px solid #dfe6ee; border-radius: 10px; background: #f4f8fd; padding: 3px 15px; }
  .oa-note { display: flex; gap: 12px; align-items: center; padding: 8px 0; font-size: 10.8px; color: #22303f; line-height: 1.55; }
  .oa-note + .oa-note { border-top: 1px solid #e2e9f2; }
  .oa-nic { width: 27px; height: 27px; flex-shrink: 0; border-radius: 50%; background: var(--deep); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-style: normal; }

  /* ---- social + end of document ---- */
  .socialrow { display: flex; justify-content: center; gap: 46px; margin-top: 14px; }
  .soc { text-align: center; text-decoration: none; }
  .socicon { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; color: #fff; font-weight: 800; font-size: 13px; margin: 0 auto 5px; }
  .soclbl { font-size: 10.5px; font-weight: 700; color: var(--blue-dark); text-decoration: underline; }
  .eod { display: flex; align-items: center; gap: 14px; margin-top: 20px; color: #46566a; font-weight: 700; letter-spacing: 0.35em; font-size: 13px; }
  .eod::before, .eod::after { content: ''; flex: 1; border-top: 1.4px solid #9db8d2; }
  .extra { display: flex; margin-top: 14px; border-radius: 11px; overflow: hidden; }
  .extra .el { background: var(--blue-dark); color: #fff; font-weight: 800; font-size: 14px; padding: 15px 18px; display: flex; align-items: center; white-space: nowrap; }
  .extra .er { flex: 1; background: var(--blue); color: #fff; font-size: 13px; padding: 15px 16px; display: flex; align-items: center; }

  /* ---- info boxes (note / inclusions / exclusions) ---- */
  .dl { font-size: 12.5px; color: #2c3d51; line-height: 1.6; }

  /* ---- Additional Information page ---- */
  .ai-banner { width: fit-content; margin: 0 auto 12px; background: var(--deep); color: #fff; font-weight: 800; font-size: 18px; letter-spacing: 0.04em; text-transform: uppercase; padding: 8px 42px; border-radius: 10px; border: 2.5px solid #0c1c44; box-shadow: 0 2px 0 #0c1c44; }
  .ai3col { display: flex; gap: 12px; align-items: stretch; }
  .aicard { flex: 1; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; }
  .aicard.navy { border: 1.5px solid var(--deep); } .aicard.green { border: 1.5px solid #188038; } .aicard.red { border: 1.5px solid #c62828; }
  .aihead { color: #fff; font-weight: 800; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; text-align: center; padding: 7px 8px; }
  .aicard.navy .aihead { background: var(--deep); } .aicard.green .aihead { background: #188038; } .aicard.red .aihead { background: #c62828; }
  .aibody { padding: 4px 12px 8px; background: #fff; flex: 1; }
  .aiitem { display: flex; gap: 8px; padding: 7px 0; font-size: 10.6px; color: #22303f; line-height: 1.55; border-bottom: 1px solid #edf1f6; }
  .aiitem:last-child { border-bottom: 0; }
  .aiitem .dot { width: 5px; height: 5px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
  .aicard.navy .dot { background: var(--deep); } .aicard.green .dot { background: #188038; } .aicard.red .dot { background: #c62828; }
  /* payment info + scan-to-pay row */
  .payrow { display: flex; gap: 12px; margin-top: 12px; align-items: stretch; }
  .paycard { flex: 1.15; border: 1.5px solid var(--deep); border-radius: 10px; overflow: hidden; background: #fff; display: flex; flex-direction: column; }
  .paycard .payh { background: var(--deep); color: #fff; font-weight: 800; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; text-align: center; padding: 7px 10px; }
  .paytbl { width: 100%; border-collapse: collapse; }
  .paytbl td { border-bottom: 1px solid #e4eaf1; padding: 11px 16px; font-size: 11.5px; color: #22303f; font-weight: 600; }
  .paytbl td.pk { width: 38%; background: var(--deep); color: #fff; font-weight: 700; border-bottom: 1px solid #2b3f77; }
  .paynote { display: flex; gap: 9px; margin: 10px 12px 12px; background: #eef4fb; border-left: 3px solid var(--blue); border-radius: 6px; padding: 9px 12px; font-size: 10.6px; color: #2c3d51; line-height: 1.6; }
  .scancard { flex: 1; border-color: #d84315; }
  .scancard .payh { background: linear-gradient(90deg, #d84315, #f4511e); }
  .scanbody { flex: 1; display: flex; align-items: center; justify-content: center; padding: 6px 8px; }
  .scanbody img { max-width: 100%; max-height: 66mm; object-fit: contain; }
  /* emergency contacts */
  .emcard { margin-top: 12px; border: 1.5px solid #c62828; border-radius: 10px; overflow: hidden; }
  .emcard .emh { background: #c62828; color: #fff; font-weight: 800; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; text-align: center; padding: 7px 10px; }
  .emtbl { width: 100%; border-collapse: collapse; }
  .emtbl th { background: #b71c1c; color: #fff; font-size: 9.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; padding: 5px 10px; text-align: left; }
  .emtbl td { padding: 6.5px 10px; font-size: 11px; color: #22303f; font-weight: 600; border-bottom: 1px solid #f0e2e2; }
  .emtbl tr:last-child td { border-bottom: 0; }
  /* thank-you footer */
  .thanks { margin-top: 12px; border: 1.5px solid var(--deep); border-radius: 10px; padding: 8px 14px 10px; text-align: center; }
  .thanks .th1 { display: flex; align-items: center; gap: 12px; color: var(--deep); font-weight: 800; font-size: 15px; letter-spacing: 0.04em; }
  .thanks .th1::before, .thanks .th1::after { content: ''; flex: 1; border-top: 2.5px solid var(--deep); }
  .thanks .th2 { margin-top: 3px; font-size: 11px; font-weight: 600; color: #37475a; }
  .infobox { margin-top: 14px; border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; font-size: 11px; color: #37475a; text-align: center; line-height: 2; }

  /* ---- company & contact page (banner, card, support strip) ---- */
  .secban { display: flex; align-items: center; gap: 12px; background: var(--deep); color: #fff; font-weight: 800; font-size: 16px; letter-spacing: 0.03em; text-transform: uppercase; padding: 10px 16px; border-radius: 12px; margin-bottom: 12px; }
  .secban .sbic { width: 30px; height: 30px; flex-shrink: 0; border-radius: 50%; background: #fff; color: var(--deep); display: flex; align-items: center; justify-content: center; font-size: 15px; }
  .cocard2 { border: 1px solid var(--line); border-radius: 12px; padding: 14px 18px; display: flex; align-items: center; background: #fff; }
  .co-brand { width: 32%; text-align: center; padding-right: 14px; }
  .co-brand .logo { margin: 0 auto 6px; width: 46px; height: 46px; font-size: 23px; }
  .co-brand .logoimg { height: 52px; }
  .co-name { margin-top: 6px; font-size: 15px; font-weight: 800; color: var(--orange); }
  .co-name::after { content: ''; display: block; width: 130px; height: 1.5px; margin: 5px auto 0; background: #f2c9ab; }
  .co-web { margin-top: 7px; font-size: 11px; font-weight: 600; color: #2c3d51; }
  .co-col { flex: 1; border-left: 1px solid #dfe6ee; padding: 4px 18px; }
  .co-h { display: flex; align-items: center; gap: 9px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--deep); margin-bottom: 7px; }
  .co-ic { width: 30px; height: 30px; flex-shrink: 0; border-radius: 50%; background: #ffe9da; color: var(--orange); display: flex; align-items: center; justify-content: center; font-size: 14px; }
  .co-v { font-size: 11.5px; color: #2c3d51; line-height: 1.9; }
  .co-v .cv-ic { display: inline-block; width: 18px; color: var(--deep); }
  .support2 { display: flex; align-items: center; gap: 13px; background: #e9f1fb; border-radius: 12px; padding: 10px 16px; margin-top: 12px; font-size: 11.5px; color: #2c3d51; line-height: 1.75; }
  .support2 .sup-ic { width: 38px; height: 38px; flex-shrink: 0; border-radius: 50%; background: var(--deep); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; }
  .support2 b { color: var(--deep); }

  /* ---- T&C (numbered sections) ---- */
  .tcintro2 { font-size: 12px; color: #2c3d51; margin: 2px 2px 10px; }
  .tcsec { break-inside: avoid; page-break-inside: avoid; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #d9e2ec; }
  .tcsec:first-of-type { border-top: 0; padding-top: 0; }
  .tcsec-h { display: flex; align-items: center; gap: 9px; color: var(--blue); font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.02em; }
  .tcnum { width: 21px; height: 21px; flex-shrink: 0; border-radius: 50%; background: var(--deep); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; }
  .tcsec-intro { margin: 5px 0 0 30px; font-size: 11.5px; color: #2c3d51; }
  .tcp { border-left: 2px dotted #b9cbe0; padding-left: 12px; margin: 6px 0 0 30px; font-size: 11.3px; color: #2c3d51; line-height: 1.65; }
  .tctbl2 { width: calc(100% - 30px); margin: 7px 0 0 30px; border-collapse: separate; border-spacing: 0; border: 1px solid #d8e2ee; border-radius: 8px; overflow: hidden; }
  .tctbl2 th { background: #e8f0fb; color: var(--deep); font-weight: 800; font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase; text-align: left; padding: 6px 11px; }
  .tctbl2.navyhead th { background: var(--deep); color: #fff; }
  .tctbl2 td { padding: 6px 11px; font-size: 11px; color: #2c3d51; border-top: 1px solid #e8eef5; }
  .tctbl2 td.c0 { font-weight: 700; color: var(--ink); white-space: nowrap; }
  .tcbox { margin: 8px 0 0 30px; background: #eef4fb; border-radius: 8px; padding: 8px 13px; }
  .tcbox-t { font-size: 10.5px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; color: var(--deep); margin-bottom: 4px; }
  .tcbox-i { font-size: 11px; color: #2c3d51; line-height: 1.65; margin-top: 2px; }
  .tcnotes { margin-top: 14px; }
  .tcnotes-pill { display: inline-block; background: var(--deep); color: #fff; font-weight: 800; font-size: 11px; letter-spacing: 0.06em; padding: 5px 18px; border-radius: 8px 8px 0 0; }
  .tcnotes-body { background: #eef4fb; border-left: 3px solid var(--deep); border-radius: 0 8px 8px 8px; padding: 9px 14px; font-size: 11.3px; font-weight: 600; color: #22303f; line-height: 1.7; }

  /* ---- why us / client review posters ---- */
  .script { font-size: 14.5px; font-weight: 500; color: var(--ink); margin: 4px 0 12px; }
  .rgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .rgrid .rimg img { height: 118mm; }
  .rrow { display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 12px; }
  .rrow .rimg img { height: 70mm; }
  .rimg { display: flex; align-items: center; justify-content: center; break-inside: avoid; page-break-inside: avoid; }
  .rimg img { max-width: 100%; width: auto; object-fit: contain; display: block; border: 1px solid var(--line); border-radius: 10px; }
  .readmore { background: #f2f5f8; border: 1px solid var(--line); border-radius: 11px; padding: 14px 18px; margin-top: 14px; display: flex; align-items: center; }
  .readmore .rm-left { flex: 1; }
  .readmore h3 { font-size: 13px; font-weight: 800; margin-bottom: 8px; }
  .rm-row { font-size: 12.5px; margin: 4px 0; color: #2c3d51; }
  .rm-row b { display: inline-block; min-width: 86px; }
  .rm-url { color: var(--blue-dark); }
  .searchpill { background: #e4e9ee; border-radius: 999px; padding: 9px 16px; font-size: 11px; color: #37475a; display: flex; align-items: center; gap: 8px; min-width: 220px; justify-content: space-between; }
  .disclaimer { margin-top: 14px; border: 1px solid var(--line); border-radius: 10px; padding: 9px 16px; font-size: 10.2px; color: #5b6b7d; text-align: center; line-height: 1.8; }

  /* ---- closing page ---- */
  .qcard { border: 1px solid var(--line); border-radius: 12px; padding: 22px; text-align: center; margin-top: 14px; }
  .qcard .qlogo { font-size: 26px; margin-bottom: 8px; }
  .qcard .qtag { font-size: 16.5px; font-weight: 700; letter-spacing: 0.14em; color: var(--ink); text-transform: uppercase; }
  .cpr { margin-top: auto; background: var(--blue); color: #fff; text-align: center; font-size: 10.5px; font-weight: 600; padding: 7px; border-radius: 2px; }
</style>
</head>
<body>

<!-- ===== COVER PAGE ===== -->
<div class="page pb">
  ${LETTERHEAD}
  ${heroImg ? `
  <div class="hero2">
    <img class="hero2-img" src="${esc(heroImg)}" alt=""/>
    <div class="hero2-shade"></div>
    <div class="hero2-body">
      <div class="hx-script">Explore</div>
      <div class="hx-title">ANDAMAN</div>
      <div class="hx-why">Why Travel with <span>${esc(company.name)}?</span></div>
      ${(company.coverPoints || []).map((p) => `<div class="hx-point"><span class="hx-check">&#10004;</span>${esc(p)}</div>`).join('')}
      ${(company.coverIncludes || []).length ? `
      <div class="hx-pillwrap"><span class="hx-pill">YOUR PACKAGE INCLUDES</span></div>
      <div class="hx-icons">
        ${company.coverIncludes.map((it) => `
        <div class="hx-item">
          <div class="hx-circle">${it.icon}</div>
          <div class="hx-lbl">${esc(it.label)}${it.sub ? `<span class="hx-sub">${esc(it.sub)}</span>` : ''}</div>
        </div>`).join('')}
      </div>` : ''}
    </div>
  </div>` : ''}
  <div class="coverband"><span class="cb-ic">&#128197;</span> ${q.nights} Nights ${(q.nights || 0) + 1} Days ${esc(pkg.name || 'Package')} Tour to Andaman</div>
  <div class="covermeta">
    <span>Quotation Proposal</span>
    <span>Query ID:- &nbsp;M${esc(pad4(q.query?.queryNumber))}</span>
  </div>
  <div class="stats">
    <div class="stat">
      <div class="statico">&#128100;</div>
      <div class="sk">GUEST</div>
      <div class="sv">${esc([guest.salutation, guest.name].filter(Boolean).join(' ') || 'Guest')}</div>
      ${guest.phones?.[0] ? `<div class="ss">+${esc(guest.phones[0].countryCode)} ${esc(guest.phones[0].number)}</div>` : ''}
    </div>
    <div class="stat">
      <div class="statico">&#128197;</div>
      <div class="sk">Tour Start Date</div><div class="sv">${fmtDate(start)}</div>
    </div>
    <div class="stat">
      <div class="statico">&#128336;</div>
      <div class="sk">DURATION</div><div class="sv">${q.nights} Nights / ${(q.nights || 0) + 1} Days</div>
    </div>
    <div class="stat">
      <div class="statico">&#128101;</div>
      <div class="sk">TRAVELLERS</div>
      <div class="sv">${paxAdults} Adult${paxAdults === 1 ? '' : 's'}${paxChildren ? `, ${paxChildren} Child${paxChildren === 1 ? '' : 'ren'}` : ''}</div>
      <div class="ss">${pax} Pax total</div>
    </div>
  </div>
  ${destCovered ? `<div class="destcov">
    <div class="statico" style="width:30px;height:30px;font-size:14px;margin-bottom:5px">&#128506;</div>
    <div class="sk">DESTINATION COVERED</div><div class="sv">${destCovered}</div>
  </div>` : ''}

  <div class="recogrow">
    <div class="ratecard">
      <div class="rcpill">HIGHEST RATED</div>
      <div class="rcitems">
        <div class="rcitem">
          <img class="rclogo" src="${assetUri('ta-logo.png')}" alt=""/>
          <div class="rccap"><b>4.5+</b> (200+ Reviews)</div>
        </div>
        <div class="rcitem">
          <img class="rclogo" src="${assetUri('google-logo.png')}" alt=""/>
          <div class="rccap"><b>5.0 &#9733;</b> (400+ Reviews)</div>
        </div>
      </div>
    </div>
    ${(company.recognisedBy || []).length ? `
    <div class="ratecard">
      <div class="rcpill">AWARDED</div>
      <div class="awardrow">
        ${company.recognisedBy.map((r) => `<div class="rbadge"><img src="${esc(/^https?:/i.test(r) ? r : assetUri(r))}" alt=""/></div>`).join('')}
      </div>
    </div>` : ''}
  </div>
  ${BOTTOMBAR.replace('bottombar', 'bottombar navy')}
</div>

<!-- ===== PAGE 2 — Quote summary ===== -->
<div class="page pb">
  ${LETTERHEAD}

  ${transferRows ? `<div class="seccard">
    <div class="sechead"><span class="shic">&#9972;</span><span class="shnum">1</span> Cruise &amp; Ferry Information</div>
    <div class="tbl flat"><table>
      <thead><tr><th style="width:24%">Ferry</th><th style="width:26%">Ferry Sector</th><th style="width:16%">Category</th><th>Departure</th><th>Arrival</th></tr></thead>
      <tbody>${transferRows}</tbody></table>
      ${ferryLegend ? `<div class="legend"><span class="lgwave">&#8776;</span>&nbsp; ${ferryLegend} &nbsp;<span class="lgwave">&#8776;</span></div>` : ''}
    </div>
  </div>` : ''}

  ${hotelOptionCards}

  <div class="seccard">
    <div class="sechead navy"><span class="shic">&#128181;</span><span class="shnum">3</span> ${pkg.name ? `${esc(pkg.name)} &mdash; ` : ''}Fare Summary</div>
    <table class="fare">
      <tr><td class="k"><span class="fic">&#129534;</span>Total Cost (without tax)</td><td class="v">${inr(taxable, 2)}</td></tr>
      <tr><td class="k"><span class="fic">&#128100;</span>Total Cost Per Person</td><td class="v">${inr(perPerson)}</td></tr>
      <tr><td class="k"><span class="fic">&#127991;</span>Discount</td><td class="v">${p.discount ? `&minus; ${inr(p.discount, 2)}` : inr(0)}</td></tr>
      <tr><td class="k"><span class="fic">&#128176;</span>Tour Cost After Discount</td><td class="v">${inr(taxable - (p.discount || 0), 2)}</td></tr>
      <tr><td class="k"><span class="fic">&#128101;</span>No. of Travellers</td><td class="v">${pax}${paxChildren ? ` &nbsp;(${paxAdults} Adult + ${paxChildren} Child)` : ''}</td></tr>
      <tr><td class="k"><span class="fic">&#129518;</span>Tour Total Cost</td><td class="v">${inr(taxable - (p.discount || 0), 2)}</td></tr>
      <tr><td class="k"><span class="fic">&#128202;</span>GST (${gstPct}%)</td><td class="v">${inr(p.tax, 2)}</td></tr>
      <tr class="final"><td class="k">Final Cost</td><td class="v">${inr(p.total, 2)}</td></tr>
    </table>
  </div>

  <div class="confirm">
    <div class="lab">Total Payable Amount to Confirm Booking:</div>
    <div class="amt">${inr(advance)}</div>
  </div>

  <div class="notebox">
    <div>Costing here is for your reference; the GST invoice is provided after tour completion. Misc Cost covers CNB, water sports or any additional requested service.</div>
    <div><b>BOOKING TERMS:</b>&nbsp; ${esc(company.bookingTerms)}</div>
  </div>
  ${BOTTOMBAR}

  <!-- Itinerary continues in the same flow — no forced page break -->
  ${introRows ? `<div class="band" style="margin-top:14px">Itinerary Introduction</div>
  <div style="margin-bottom:16px">${introRows}</div>` : ''}
  <div class="band">${q.nights}N${(q.nights || 0) + 1}D Day Wise Itinerary:</div>
  <div class="grow">${dayBlocks}
  ${company.itineraryNote ? `<div class="notestrip"><span class="ni">&#8505;</span><b>PLEASE NOTE</b><span class="nsdiv"></span><span>${esc(company.itineraryNote)}</span></div>` : ''}</div>
  ${extras ? `<div class="extra">
    <div class="el">EXTRA INCLUSIONS:</div>
    <div class="er">${esc(extras)}</div>
  </div>` : ''}
  ${BOTTOMBAR}
</div>

<!-- ===== Hotels / Accommodations — details with images ===== -->
${hotelCards ? `<div class="page pb">
  <div class="band">Hotels / Accommodations:</div>
  ${hotelCards}
  ${BOTTOMBAR}
</div>` : ''}

<!-- ===== Optional Activities — poster-style card grid ===== -->
${optActs ? `<div class="page pb">
  <div class="oa-title"><span class="oa-t1">OPTIONAL</span>&nbsp;<span class="oa-t2">ACTIVITIES</span></div>
  <div class="oa-sub">&mdash;&nbsp; On Request &mdash; Not Included in Package Cost &nbsp;&mdash;</div>
  <div class="oagrid2">${optActs}</div>
  <div class="oa-notes">
    <div class="oa-note"><span class="oa-nic">&#8505;</span><div><b>Want to add any of these experiences to your trip?</b><br/>Let your travel consultant know and we will include it in your final itinerary.</div></div>
    <div class="oa-note"><span class="oa-nic">&#9925;</span><div>All water activities are subject to weather conditions and slot availability on the day of the activity.</div></div>
  </div>
  ${BOTTOMBAR}
</div>` : ''}

<!-- ===== PAGE 3 — Additional Info / Payment ===== -->
<div class="page pb">
  <div class="ai-banner">Additional Information</div>
  <div class="ai3col">
    ${aiCard('Note', 'navy', company.notes)}
    ${aiCard('Inclusions', 'green', inclusions)}
    ${aiCard('Exclusions', 'red', exclusions)}
  </div>
  <div class="payrow">
    <div class="paycard">
      <div class="payh">Payment Information</div>
      <table class="paytbl">
        <tr><td class="pk">Account Name</td><td>${esc(company.bank.holder)}</td></tr>
        <tr><td class="pk">Account Number</td><td>${esc(company.bank.accNo)}</td></tr>
        <tr><td class="pk">IFSC Code</td><td>${esc(company.bank.ifsc)}</td></tr>
        <tr><td class="pk">Branch</td><td>${esc(company.bank.address)}</td></tr>
        <tr><td class="pk">Bank Name</td><td>${esc(company.bank.bank)}</td></tr>
      </table>
      <div class="paynote"><span>For payment made through bank transfer, please give us at least 30 minutes so we can confirm payment with the bank.</span></div>
    </div>
    ${paymentQr ? `<div class="paycard scancard">
      <div class="payh">Scan to Pay</div>
      <div class="scanbody"><img src="${esc(paymentQr)}" alt=""/></div>
    </div>` : ''}
  </div>
  ${ecRows ? `<div class="emcard">
    <div class="emh">Emergency Contact Information</div>
    <table class="emtbl">
      <thead><tr><th>Contact Name</th><th>Mobile Number</th><th>Email Id</th><th>Available On</th></tr></thead>
      <tbody>${ecRows}</tbody>
    </table>
  </div>` : ''}
  <div class="thanks">
    <div class="th1">THANK YOU!</div>
    <div class="th2">Thank you for choosing ${esc(company.name)}!</div>
  </div>
  ${BOTTOMBAR}
</div>

<!-- ===== PAGE 4 — Company info + Terms & Conditions ===== -->
<div class="page pb">
  <div class="secban"><span class="sbic">&#127970;</span> Company &amp; Contact Information</div>
  <div class="cocard2">
    <div class="co-brand">
      ${logoIcon}
      <div class="co-name">${esc(company.name)}</div>
      <div class="co-web">&#127760; ${esc(company.website)}</div>
    </div>
    <div class="co-col">
      <div class="co-h"><span class="co-ic">&#128205;</span> Address</div>
      <div class="co-v">${company.address.map(esc).join('<br/>')}</div>
    </div>
    <div class="co-col">
      <div class="co-h"><span class="co-ic">&#128222;</span> Contact</div>
      <div class="co-v">
        ${company.phones.map((ph) => `<span class="cv-ic">&#128222;</span>${esc(ph)}`).join('<br/>')}<br/>
        <span class="cv-ic">&#9993;</span>${esc(company.emails[0])}
      </div>
    </div>
  </div>
  <div class="support2">
    <span class="sup-ic">&#127911;</span>
    <div>For any support, changes or requests regarding this itinerary, please contact your assigned representative.
    For any complaints or grievances, please email us at <b>${esc(company.emails[0])}</b> or call us at <b>${esc(company.phones[0])}</b>.</div>
  </div>

  <div class="secban" style="margin-top:14px"><span class="sbic">&#128196;</span> Terms &amp; Conditions</div>
  <div class="tcintro2">These terms and conditions apply to all services and bookings provided by ${esc(company.name)}.</div>
  ${tcSectionsHtml}
  ${BOTTOMBAR}
</div>

<!-- ===== PAGE 5 — Why Us (client review posters) ===== -->
<div class="page pb">
  <div class="band">WHY US:</div>
  ${whyUs.headline ? `<div class="script">${esc(whyUs.headline)}</div>` : ''}
  ${reviewGrid ? `<div class="rgrid">${reviewGrid}</div>` : '<p class="muted" style="margin-top:12px">No review images configured.</p>'}
  ${BOTTOMBAR}
</div>

<!-- ===== PAGE 6 — More reviews + closing ===== -->
<div class="page">
  <div class="band">An Experience that you will Never Forget:</div>
  ${reviewRow ? `<div class="rrow">${reviewRow}</div>` : ''}
  ${reviewRows ? `
  <div class="readmore">
    <div class="rm-left">
      <h3>Read More Reviews:</h3>
      ${reviewRows}
    </div>
    <div class="searchpill"><span><b style="color:#4285f4">G</b>&nbsp; ${esc(company.name)}</span><span>&#128269;</span></div>
  </div>` : ''}
  <div class="disclaimer">The information contained in this document and electronic transmission can be privileged, and not available for disclosure. All information contained is owned by ${esc(company.name)}. Any unauthorized sharing and upload are prohibited. Terms &amp; Conditions: ${esc(company.website)}/terms-and-conditions</div>
  <div class="qcard">
    ${qlogoIcon}
    <div class="qtag">${esc(company.tagline)}</div>
    ${socialIcons ? `<div style="font-size:10px;color:#46566a;margin-top:14px;font-weight:700">Find us in the Social World:</div>
    <div class="socialrow">${socialIcons}</div>` : ''}
  </div>
  <div class="eod">End&nbsp;of&nbsp;Document</div>
  <div class="cpr">&copy; ${esc(company.name)} &nbsp;&#124;&nbsp; ${esc(company.website)}</div>
</div>

</body></html>`;
}
