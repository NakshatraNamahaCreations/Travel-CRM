import { company } from '../config/company.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad4 = (n) => { const s = String(n ?? '').trim(); return /^\d+$/.test(s) ? s.padStart(4, '0') : s; };
const inr = (n, dec = 0) => '&#8377;' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '&mdash;');
const fmtDateDM = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const stars = (n) => '&#9733;'.repeat(Math.min(n || 5, 5));

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
const dash = (arr) => (arr || []).map((x) => `<div class="dl">- ${esc(x)}</div>`).join('');

// Like dash(), but renders a leading "Label: " prefix in bold.
const tcDash = (arr) => (arr || []).map((x) => {
  const s = String(x ?? '');
  const idx = s.indexOf(': ');
  const body = idx > 0 && idx <= 45
    ? `<b>${esc(s.slice(0, idx + 1))}</b> ${esc(s.slice(idx + 2))}`
    : esc(s);
  return `<div class="dl">- ${body}</div>`;
}).join('');

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

const LETTERHEAD = `
  <div class="lh">
    <div class="brand">
      <div class="logo">&#127796;</div>
      <div>
        <div class="bn">${esc(company.name)}</div>
        <div class="bsub">${esc(company.tagline)}</div>
      </div>
    </div>
    <div class="lh-col"><b>Address:</b>${company.address.map(esc).join('<br/>')}</div>
    <div class="lh-col wide"><b>Email:</b>${company.emails.map(esc).join('<br/>')}</div>
    <div class="lh-col"><b>Phone:</b>${company.phones.map(esc).join('<br/>')}</div>
  </div>`;

const BOTTOMBAR = '<div class="bottombar"></div>';

// Build the self-contained HTML for a populated quote document.
export function quotationHtml(q) {
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
  const pillCls = (i) => 'pl' + (i % 3);
  const transports = pkg.transports || [];
  const transferRows = transports.map((t, i) => {
    const days = Array.isArray(t.days) ? t.days : (t.day ? [t.day] : []);
    const dayLabel = days.length > 0 ? `Day ${days.join(', ')}` : '—';
    const sched = staticTimes(t.serviceType, t.serviceLocation);
    const dep = fmtTime(t.startTime) || (sched ? fmtTime(sched[0]) : '') || esc(t.startTime) || '&mdash;';
    const arr = arrTime(t.startTime, t.durationMins) || (sched ? fmtTime(sched[1]) : '') || '&mdash;';
    return `<tr>
      <td class="bcell">${esc(t.serviceType || t.serviceLocation || dayLabel)}</td>
      <td><span class="pill ${pillCls(i)}">${esc(t.serviceLocation || dayLabel)}</span></td>
      <td>${dep}</td>
      <td>${arr}</td>
    </tr>`;
  }).join('');
  const ferryLegend = transports.map((t) => esc(t.serviceLocation)).filter(Boolean).join(' &nbsp;&#124;&nbsp; ');

  // ---- Hotels table (page 1 — compact, with star rating under the name) ----
  const hotels = pkg.hotels || [];
  const starRow = (n) => `<span class="tstars">${'&#9733;'.repeat(Math.min(n || 3, 5))}</span>`;
  const hotelRows = hotels.map((h) => {
    const master = h.hotel && typeof h.hotel === 'object' ? h.hotel : {};
    return `<tr>
      <td class="bcell hcell">
        <div>${esc(h.hotelName)}</div>
        ${starRow(master.stars)}
      </td>
      <td>${esc(h.roomType)}</td><td>${esc(h.city)}</td>
      <td>${h.rooms || 0}</td><td>${(h.nights || []).length || 1}</td>
      <td>${h.aweb || 0}</td><td>${h.cnb || 0}</td>
      <td><span class="pill navy">${esc(h.mealPlan)}</span></td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" class="muted">No hotels added.</td></tr>';

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
        <div class="hnights">${badges} Night${nightsArr.length > 1 ? 's' : ''} at <b>${esc(h.city || master.location?.city || '')}</b></div>
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
  const hotelLegend = hotels.map((h) => placeCode(h.city)).filter(Boolean).join(' &nbsp;&#124;&nbsp; ');

  // ---- Cover page data ----
  const fmtDateWD = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }) : '');
  const routeCode = hotels.map((h) => `${(h.nights || []).length || 1}${placeCode(h.city)}`).join('&gt;');
  const destCovered = (() => {
    const m = new Map();
    hotels.forEach((h) => { const c = h.city || ''; if (c) m.set(c, (m.get(c) || 0) + ((h.nights || []).length || 1)); });
    return [...m.entries()].map(([c, n]) => `<b>${esc(c)} - ${n}</b>`).join(' &nbsp;<span class="pin">&#128205;</span>&nbsp; ');
  })();
  const heroImg = company.heroImage || gallery[2] || gallery[0] || '';

  // City a given trip day belongs to (from hotel night assignments).
  const cityOfDay = (n) => {
    const h = hotels.find((x) => (x.nights || []).includes(n));
    return h?.city || hotels[hotels.length - 1]?.city || '';
  };

  // ---- Itinerary introduction (day list) ----
  const introRows = (q.days || []).map((d) => {
    const headline = (d.title && !/^day\s*\d+$/i.test(d.title.trim()) && d.title)
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
  // Key for matching an auto-built description line ("Cellular Jail Visit ·
  // 09:00") back to the service/activity it came from: drop the time and any
  // trailing separators before comparing.
  const lineKey = (l) => normName(String(l).replace(/\d{1,2}:\d{2}.*$/, '').replace(/[\s·•|–—-]+$/g, ''));
  const dayBlocks = (q.days || []).map((d) => {
    const n = d.dayNumber || 1;
    const date = d.date || (start ? addDays(start, n - 1) : null);
    // Rich service blocks: service name + "Day Schedule" description from the
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
        .map((p) => `<div class="ddesc">${esc(p)}</div>`).join('');
      const body = photo
        ? `<div class="svcrow"><img class="dphoto" src="${esc(photo)}" alt=""/><div class="svctext">${paras}</div></div>`
        : paras;
      return `<div class="svcblk"><div class="dwtitle">${esc(t.serviceType || t.serviceLocation || '')}</div>${body}</div>`;
    }).filter(Boolean).join('');
    // Activity blocks (scuba, ferry tickets...) — photo from the activity
    // master + details from the matching ticket type (or activity-level).
    const dayActs = activities.filter((a) => (Array.isArray(a.days) && a.days.length ? a.days : [1]).includes(n));
    const actBlocks = dayActs.map((a) => {
      const master = a.activity && typeof a.activity === 'object' ? a.activity : null;
      const tk = (master?.ticketTypes || []).find((t2) => normName(t2.name) === normName(a.ticketType));
      const desc = stripHtml(tk?.details || master?.details || '');
      const photo = master?.imageUrl || svcImage(`${a.name} ${a.ticketType}`);
      if (!desc && !photo) return '';
      const title2 = [a.name, a.ticketType].filter(Boolean).join(' — ');
      const paras = desc.split('\n').filter(Boolean)
        .map((p) => `<div class="ddesc">${esc(p)}</div>`).join('');
      const body = photo
        ? `<div class="svcrow"><img class="dphoto" src="${esc(photo)}" alt=""/><div class="svctext">${paras}</div></div>`
        : paras;
      return `<div class="svcblk"><div class="dwtitle">${esc(title2)}</div>${body}</div>`;
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
    const title = d.title && !/^day\s*\d+$/i.test(d.title.trim()) && !richBlocks ? `<div class="dwtitle">${esc(d.title)}</div>` : '';
    const nightHotels = hotels.filter((h) => (h.nights || []).includes(n));
    const strips = nightHotels.map((h) => {
      const master = h.hotel && typeof h.hotel === 'object' ? h.hotel : {};
      const st = Math.min(master.stars || 3, 5);
      return `<div class="hstrip">
        ${master.imageUrl ? `<img class="hthumb" src="${esc(master.imageUrl)}" alt=""/>` : ''}
        <div class="hsmain">
          <div class="hsname">Hotel &nbsp;&#124;&nbsp; ${esc(h.hotelName)}</div>
          <div class="hscols">
            <div><p class="k">CATEGORY</p><p class="v"><span class="tstars">${'&#9733;'.repeat(st)}</span></p></div>
            <div><p class="k">ROOM TYPE</p><p class="v">${esc(h.roomType || '—')}</p></div>
            <div><p class="k">MEAL PLAN</p><p class="v">${esc(h.mealPlan || '—')}</p></div>
          </div>
        </div>
      </div>`;
    }).join('');
    return `<div class="dayblk">
      <div class="dwband">Day ${n} ${esc(cityOfDay(n))} &nbsp;&#124;&nbsp; ${date ? fmtDateWD(date) : ''}</div>
      <div class="dwbody">${title}${richBlocks}${lines}${strips}</div>
    </div>`;
  }).join('') || '<p class="muted">No day-wise itinerary added.</p>';

  // ---- Optional activities (config-driven upsell grid) ----
  const optActs = (company.optionalActivities || []).map((a) => `
    <div class="oacard">
      ${a.image ? `<img src="${esc(a.image)}" alt=""/>` : ''}
      <div class="oaname">${esc(a.name)}</div>
      <div class="oacost"><b>Adult Cost :</b> ${inr(a.adult)}</div>
      <div class="oacost"><b>Child Cost :</b> ${inr(a.child)}</div>
    </div>`).join('');

  // ---- Emergency contacts + social icons ----
  const ecRows = (company.emergencyContacts || []).map((c) => `<tr>
    <td class="dkcell">${esc(c.name)}</td><td class="dkcell">${esc(c.phone)}</td>
    <td class="dkcell">${esc(c.email)}</td><td class="dkcell">${esc(c.availableOn)}</td>
  </tr>`).join('');
  const socialIcons = (company.social || []).map((s) => `
    <a class="soc" href="${esc(s.url)}">
      <span class="socicon" style="background:${esc(s.color)}">${s.short}</span>
      <span class="soclbl">${esc(s.label)}</span>
    </a>`).join('');

  const extras = (pkg.extras || []).map((e) => e.label || e.name).filter(Boolean).join(', ');

  // ---- Testimonials ----
  const initials = (name) => String(name || '').split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const testimonialCards = (whyUs.testimonials || []).map((t) => `
    <div class="review-card">
      <div class="review-text">${esc(t.review)}</div>
      <div class="review-footer">
        <div class="avatar">${esc(initials(t.name))}</div>
        <div>
          <div class="reviewer-name">${esc(t.name)}</div>
          <div class="reviewer-via"><span class="stars">${stars(t.rating)}</span>&nbsp; Reviewed on ${esc(t.platform)}</div>
        </div>
      </div>
    </div>`).join('');

  const reviewRows = (whyUs.reviewLinks || []).map((rl) => `
    <div class="rm-row"><b>${esc(rl.label)}:</b><span class="rm-url">${esc(rl.url)}</span></div>`).join('');

  // ---- Gallery mosaic ----
  const img = (src, cls = '') => (src ? `<div class="gi ${cls}"><img src="${esc(src)}" alt=""/></div>` : '');
  const mosaic = gallery.length ? `
    <div class="mosaic">
      ${img(gallery[0], 'tall-l')}${img(gallery[1])}${img(gallery[2])}${img(gallery[5] || gallery[1], 'tall-r')}
      ${img(gallery[3])}${img(gallery[4])}
    </div>
    <div class="pano"><img src="${esc(gallery[6] || gallery[2] || gallery[0])}" alt=""/></div>` : '<p class="muted" style="margin-top:12px">No gallery images configured.</p>';

  return `<!doctype html><html><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  :root {
    --blue: #1577bd; --blue-dark: #0e5fa0; --navy: #14498f;
    --lblue: #d9ecf9; --lblue2: #eef6fc; --line: #cfdae5;
    --yellow: #fdfbd8; --green: #18a24b; --ink: #16212e;
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif; color: var(--ink); font-size: 13px; background: #fff; -webkit-font-smoothing: antialiased; }

  /* ---- page wrapper: flex column so the blue bar pins to the bottom ---- */
  .page { min-height: 272mm; display: flex; flex-direction: column; }
  .pb { page-break-after: always; }
  .bottombar { margin-top: auto; height: 7px; background: var(--blue); border-radius: 2px; }
  .grow { flex: 1; }

  /* ---- letterhead: brand + Address | Email | Phone columns ---- */
  .lh { display: flex; align-items: center; margin-bottom: 10px; }
  .brand { display: flex; align-items: center; gap: 9px; width: 29%; flex-shrink: 0; padding-right: 10px; }
  .logo { width: 42px; height: 42px; border-radius: 10px; background: var(--blue); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 21px; flex-shrink: 0; }
  .bn { font-size: 14.5px; font-weight: 800; color: var(--blue); line-height: 1.2; white-space: nowrap; }
  .bsub { font-size: 7.5px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.07em; margin-top: 2px; }
  .lh-col { flex: 1; align-self: stretch; display: flex; flex-direction: column; justify-content: center; text-align: center; border-left: 1px solid #c9d4df; padding: 4px 8px; font-size: 10.5px; color: #445468; line-height: 1.5; }
  .lh-col.wide { flex: 1.25; }
  .lh-col b { display: block; font-size: 12px; color: var(--ink); margin-bottom: 3px; }

  /* ---- blue band heading ---- */
  .band { background: var(--blue); color: #fff; padding: 10px 16px; font-weight: 800; font-size: 17px; border-radius: 5px; margin-bottom: 14px; }

  /* ---- page-1 quotation panels ---- */
  .panels { display: flex; justify-content: space-between; gap: 56px; margin: 4px 0 6px; }
  .panel { flex: 1; border: 1.5px solid var(--blue-dark); border-radius: 10px; overflow: hidden; }
  .ph { background: var(--blue); color: #fff; padding: 8px 14px; font-weight: 700; font-size: 14px; }
  .pc { background: var(--lblue); padding: 9px 14px 10px; min-height: 56px; }
  .pill { display: inline-block; border-radius: 999px; padding: 2.5px 11px; color: #fff; font-size: 11px; font-weight: 700; white-space: nowrap; }
  .pill.navy { background: var(--navy); }
  .pill.pl0 { background: #3565d6; } .pill.pl1 { background: #8b3fd1; } .pill.pl2 { background: #0e6b50; }

  /* ---- section headings ---- */
  .h1 { font-size: 21px; font-weight: 800; color: var(--ink); margin: 10px 0 4px; }

  /* ---- tables ---- */
  .tbl { border: 1px solid var(--line); border-radius: 9px; overflow: hidden; margin-top: 7px; background: #fff; }
  .tbl table { width: 100%; border-collapse: collapse; }
  .tbl thead th { background: #eaf3fb; color: var(--navy); padding: 7px 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.02em; text-align: center; font-weight: 800; border-right: 1px solid #d8e7f5; }
  .tbl thead th:last-child { border-right: 0; }
  .tbl td { padding: 7.5px 6px; text-align: center; font-size: 12.5px; font-weight: 600; color: var(--blue-dark); border-top: 1px dashed #cddcea; }

  /* ---- section cards (summary page) ---- */
  .seccard { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; margin-top: 10px; background: #fff; break-inside: avoid; page-break-inside: avoid; }
  .sechead { display: flex; align-items: center; gap: 8px; background: linear-gradient(90deg, var(--lblue2), #fff); padding: 7px 14px; font-weight: 800; font-size: 13.5px; color: var(--navy); border-bottom: 1px solid var(--line); text-transform: uppercase; letter-spacing: 0.02em; }
  .sechead .sicon { font-size: 14px; }
  .tbl.flat { border: 0; border-radius: 0; margin-top: 0; }
  .tbl.flat.sep { border-top: 1px solid var(--line); }
  .tbl td.bcell { font-weight: 700; }
  .tbl td.dkcell { color: var(--ink); }
  .tbl .legend { background: #f2f6fa; border-top: 1px solid var(--line); padding: 6px; text-align: center; font-size: 10.5px; font-weight: 700; color: #46566a; }
  .tbl td.hl { background: var(--yellow); color: var(--ink); font-weight: 800; font-size: 14px; }
  .muted { color: #94a3b8; text-align: center; padding: 8px; font-weight: 500; }
  .tbl td.hcell { text-align: left; }
  .tstars { color: #f5a623; font-size: 11px; letter-spacing: 1px; }
  .ext { font-size: 8px; }

  /* ---- Hotels / Accommodations cards ---- */
  .hcard { display: flex; align-items: stretch; gap: 16px; border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; background: #fff; }
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
  .confirm { display: flex; margin-top: 10px; border-radius: 9px; overflow: hidden; }
  .confirm .lab { flex: 1; background: var(--blue); color: #fff; font-weight: 800; font-size: 15.5px; display: flex; align-items: center; justify-content: center; padding: 10px; }
  .confirm .amt { background: var(--green); color: #fff; font-weight: 800; font-size: 22px; padding: 10px 36px; display: flex; align-items: center; white-space: nowrap; }
  .notebox { margin-top: 8px; border: 1px solid var(--line); border-radius: 9px; padding: 6px 14px; font-size: 10.8px; color: #37475a; text-align: center; line-height: 1.6; }

  /* ---- cover page ---- */
  .hero { border-radius: 12px; overflow: hidden; height: 118mm; }
  .hero img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .coverband { background: var(--blue); color: #fff; font-weight: 800; font-size: 19.5px; text-align: center; letter-spacing: 0.02em; padding: 12px 16px; margin: 0 -4px; border-radius: 4px; text-transform: uppercase; }
  .covermeta { display: flex; justify-content: space-between; font-size: 12.5px; color: #37475a; margin: 12px 2px 4px; }
  .stats { display: flex; justify-content: center; gap: 70px; margin-top: 22px; text-align: center; }
  .stat .sk { font-size: 12.5px; color: #46566a; letter-spacing: 0.02em; }
  .stat .sv { font-size: 15px; font-weight: 800; color: var(--ink); margin-top: 4px; }
  .destcov { text-align: center; margin-top: 26px; }
  .destcov .sk { font-size: 12.5px; color: #46566a; letter-spacing: 0.04em; }
  .destcov .sv { font-size: 14px; margin-top: 6px; color: var(--ink); }
  .destcov .pin { font-size: 11px; }

  /* ---- itinerary introduction ---- */
  .introrow { font-size: 12.8px; color: #2c3d51; padding: 7px 4px; border-bottom: 1px dashed #d5e0ea; line-height: 1.5; }
  .introrow:last-child { border-bottom: 0; }
  .introday { display: inline-block; min-width: 52px; font-weight: 800; color: var(--blue-dark); }

  /* ---- day-wise itinerary ---- */
  .dayblk { break-inside: avoid; page-break-inside: avoid; margin-bottom: 14px; }
  .dwband { background: var(--blue); color: #fff; font-weight: 700; font-size: 13.5px; padding: 7px 14px; border-radius: 5px 5px 0 0; }
  .dwbody { border: 1px solid var(--line); border-top: 0; border-radius: 0 0 8px 8px; background: #fff; padding: 11px 15px; }
  .dwtitle { font-weight: 800; font-size: 13px; color: var(--ink); text-transform: uppercase; margin-bottom: 6px; }
  .ditem { font-size: 12.5px; color: #2c3d51; line-height: 1.65; }
  .svcblk { margin-bottom: 8px; }
  .svcblk + .svcblk { border-top: 1px dashed #d5e0ea; padding-top: 8px; }
  .ddesc { font-size: 12px; color: #2c3d51; line-height: 1.7; text-align: justify; margin-top: 3px; }
  /* service photo + description row (photo left, text right — like the hotel strip) */
  .svcrow { display: flex; align-items: flex-start; gap: 13px; margin-top: 5px; }
  .dphoto { width: 172px; height: 112px; object-fit: cover; border-radius: 8px; flex-shrink: 0; }
  .svctext { flex: 1; min-width: 0; }
  .svctext .ddesc:first-child { margin-top: 0; }
  .hstrip { display: flex; align-items: center; gap: 13px; border-top: 1px dashed #c9d8e5; margin-top: 10px; padding-top: 10px; }
  .hthumb { width: 88px; height: 56px; object-fit: cover; border-radius: 7px; flex-shrink: 0; }
  .hsname { font-weight: 800; font-size: 13px; color: var(--blue-dark); margin-bottom: 4px; }
  .hscols { display: flex; gap: 30px; }
  .hscols .k { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; color: #8fa0b3; }
  .hscols .v { font-size: 12px; font-weight: 700; color: var(--ink); margin-top: 1px; }

  /* ---- optional activities ---- */
  .oagrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 12px; }
  .oacard { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; text-align: center; padding-bottom: 10px; background: #fff; break-inside: avoid; page-break-inside: avoid; }
  .oacard img { width: 100%; height: 108px; object-fit: cover; display: block; margin-bottom: 8px; }
  .oaname { font-weight: 800; font-size: 12.5px; color: var(--ink); text-transform: uppercase; padding: 0 8px; }
  .oacost { font-size: 11.5px; color: #2c3d51; margin-top: 3px; }

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
  .box { border: 1.2px solid var(--line); border-radius: 10px; padding: 11px 15px; margin-top: 12px; background: #fff; }
  .box.g { background: #f2fbf5; border-color: #7ecf9a; }
  .box.r { background: #fef5f5; border-color: #f0a8a8; }
  .box h3 { font-size: 13.5px; font-weight: 800; color: var(--ink); margin-bottom: 6px; letter-spacing: 0.02em; }
  .dl { font-size: 12.5px; color: #2c3d51; line-height: 1.6; }

  /* ---- payment info ---- */
  .paybox { border: 1.6px solid var(--blue); background: #e9f3fb; border-radius: 13px; padding: 16px 20px; margin-top: 15px; }
  .paybox .ptitle { display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 800; color: var(--ink); margin-bottom: 10px; }
  .paybox .picon { font-size: 22px; }
  .paybox .kv { font-size: 12.5px; margin: 3.5px 0; color: #2c3d51; }
  .paybox .kv b { display: inline-block; min-width: 100px; color: var(--ink); }
  .paybox .plink { border-top: 1.2px solid #b9d7ec; margin-top: 10px; padding-top: 9px; }
  .banktbl { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #b9d7ec; border-radius: 8px; overflow: hidden; }
  .banktbl td { border: 1px solid #cfe2f1; padding: 7px 12px; font-size: 12.5px; color: #2c3d51; }
  .banktbl td.bk { width: 32%; font-weight: 800; color: var(--ink); background: #f2f8fd; }
  .infobox { margin-top: 14px; border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; font-size: 11px; color: #37475a; text-align: center; line-height: 2; }

  /* ---- company & contact card (page 4) ---- */
  .cocard { border: 1px solid var(--line); border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; }
  .cocard .cbrand { width: 33%; text-align: center; }
  .cocard .cbrand .logo { margin: 0 auto 6px; width: 48px; height: 48px; font-size: 24px; }
  .cocard .cweb { font-size: 9px; color: #64748b; margin-top: 3px; }
  .cocard .ccol { flex: 1; border-left: 1px solid #d8e2ec; padding: 4px 16px; font-size: 12.5px; color: #2c3d51; line-height: 1.65; }
  .cocard .ccol b { display: block; font-size: 13px; color: var(--ink); margin-bottom: 4px; letter-spacing: 0.03em; }
  .support { background: var(--lblue2); border: 1px solid #bcd9ee; border-radius: 9px; padding: 9px 14px; text-align: center; font-size: 11.3px; color: #2c3d51; line-height: 1.9; margin-top: 12px; }

  /* ---- T&C ---- */
  .tab { display: inline-block; background: var(--blue); color: #fff; font-weight: 800; font-size: 15px; padding: 11px 26px; border-radius: 9px 9px 0 0; margin-top: 18px; }
  .tccontent { border-top: 2.5px solid var(--blue); padding-top: 10px; }
  .tcintro { font-size: 12.5px; color: #2c3d51; margin: 4px 0 8px; }
  .tc-section { margin-top: 11px; break-inside: avoid; page-break-inside: avoid; }
  .tc-section h3 { font-size: 12.5px; font-weight: 800; color: var(--ink); margin-bottom: 4px; }

  /* ---- why us / reviews ---- */
  .script { font-family: 'Segoe Script', 'Brush Script MT', cursive; font-size: 15px; color: var(--ink); margin: 6px 0 14px; }
  .review-card { border: 1.4px solid #8fd0a5; border-radius: 11px; background: #fff; padding: 13px 16px; margin-bottom: 12px; }
  .review-text { font-size: 12.8px; color: #2c3d51; line-height: 1.7; }
  .review-footer { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
  .avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--blue); color: #fff; font-weight: 800; font-size: 11px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .reviewer-name { font-weight: 800; font-size: 13.5px; color: var(--ink); }
  .reviewer-via { font-size: 11px; color: #64748b; margin-top: 1px; }
  .stars { color: #f59e0b; font-size: 10px; letter-spacing: 1px; }
  .readmore { background: #f2f5f8; border: 1px solid var(--line); border-radius: 11px; padding: 14px 18px; margin-top: 14px; display: flex; align-items: center; }
  .readmore .rm-left { flex: 1; }
  .readmore h3 { font-size: 13px; font-weight: 800; margin-bottom: 8px; }
  .rm-row { font-size: 12.5px; margin: 4px 0; color: #2c3d51; }
  .rm-row b { display: inline-block; min-width: 86px; }
  .rm-url { color: var(--blue-dark); }
  .searchpill { background: #e4e9ee; border-radius: 999px; padding: 9px 16px; font-size: 11px; color: #37475a; display: flex; align-items: center; gap: 8px; min-width: 220px; justify-content: space-between; }
  .disclaimer { margin-top: 14px; border: 1px solid var(--line); border-radius: 10px; padding: 9px 16px; font-size: 10.2px; color: #5b6b7d; text-align: center; line-height: 1.8; }

  /* ---- gallery ---- */
  .mosaic { display: grid; grid-template-columns: 1.05fr 1.35fr 1.35fr 1.05fr; grid-auto-rows: 104px; gap: 8px; }
  .gi { border-radius: 9px; overflow: hidden; }
  .gi img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .gi.tall-l { grid-row: span 2; } .gi.tall-r { grid-row: span 2; grid-column: 4; }
  .pano { border-radius: 10px; overflow: hidden; height: 205px; margin-top: 8px; }
  .pano img { width: 100%; height: 100%; object-fit: cover; display: block; }
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
  ${heroImg ? `<div class="hero"><img src="${esc(heroImg)}" alt=""/></div>` : ''}
  <div class="coverband">${q.nights} Nights ${(q.nights || 0) + 1} Days ${esc(pkg.name || 'Package')} Tour to Andaman${routeCode ? ` &nbsp;-&nbsp; ${routeCode}` : ''}</div>
  <div class="covermeta">
    <span>Quotation Proposal</span>
    <span>Query ID:- &nbsp;M${esc(pad4(q.query?.queryNumber))}</span>
  </div>
  <div class="stats">
    <div class="stat"><div class="sk">Tour Start Date</div><div class="sv">${fmtDate(start)}</div></div>
    <div class="stat"><div class="sk">DURATION</div><div class="sv">${q.nights} Nights / ${(q.nights || 0) + 1} Days</div></div>
    <div class="stat"><div class="sk">TRAVELLERS</div><div class="sv">${pax} Pax${paxChildren ? ` (${paxAdults} Adult + ${paxChildren} Child)` : ''}</div></div>
  </div>
  ${destCovered ? `<div class="destcov"><div class="sk">DESTINATION COVERED</div><div class="sv">${destCovered}</div></div>` : ''}
  ${BOTTOMBAR}
</div>

<!-- ===== PAGE 2 — Quote summary ===== -->
<div class="page pb">
  ${LETTERHEAD}

  <div class="panels">
    <div class="panel">
      <div class="ph">Quotation for:</div>
      <div class="pc">
        <div style="font-weight:800;font-size:14.5px">${esc([guest.salutation, guest.name].filter(Boolean).join(' ') || 'Guest')} &nbsp;&#124;&nbsp; M${esc(pad4(q.query?.queryNumber))}</div>
        ${guest.phones?.[0] ? `<div style="font-size:12px;color:#37475a;margin-top:2px">+${esc(guest.phones[0].countryCode)} ${esc(guest.phones[0].number)}</div>` : ''}
        <div style="margin-top:5px;font-size:12.5px;font-weight:700">Adults: ${paxAdults}, &nbsp;Child: ${paxChildren} &nbsp;&nbsp;<span class="pill navy">${esc(pkg.name || 'Package')}</span></div>
      </div>
    </div>
    <div class="panel">
      <div class="ph">${esc(tripTitle)}:</div>
      <div class="pc" style="text-align:right">
        <div style="font-weight:800;font-size:12.5px">Travel Dates:</div>
        <div style="font-size:13px;margin-top:3px">${fmtDate(start)}</div>
        <div style="font-size:13px">${end ? fmtDate(end) : ''}</div>
      </div>
    </div>
  </div>

  ${transferRows ? `<div class="seccard">
    <div class="sechead"><span class="sicon">&#9972;</span> Cruise &amp; Ferry Information</div>
    <div class="tbl flat"><table>
      <thead><tr><th style="width:32%">Name</th><th style="width:28%">Ferry Sector</th><th>Departure Timings</th><th>Arrival Timings</th></tr></thead>
      <tbody>${transferRows}</tbody></table>
      ${ferryLegend ? `<div class="legend">${ferryLegend}</div>` : ''}
    </div>
  </div>` : ''}

  <div class="seccard">
    <div class="sechead"><span class="sicon">&#127976;</span> Hotel Information</div>
    <div class="tbl flat"><table>
      <thead><tr><th>Hotel Name</th><th>Type of Room</th><th>Place</th><th>&#35; Rooms</th><th>&#35; Nights</th><th>Extra<br/>Mattress</th><th>W/O<br/>Mattress</th><th>Meal Plan</th></tr></thead>
      <tbody>${hotelRows}</tbody></table>
      ${hotelLegend ? `<div class="legend">${hotelLegend}</div>` : ''}
    </div>
  </div>

  <div class="seccard">
    <div class="sechead"><span class="sicon">&#128181;</span> Transparent Breakage of all Costs</div>
    <div class="tbl flat"><table>
      <thead><tr><th>Hotel Cost</th><th>Tour Cost</th><th>Permits &amp; Boat Cost</th><th>Ferry Cost</th><th>Misc Cost</th></tr></thead>
      <tbody><tr>
        <td class="dkcell">${inr(cats.hotel, 2)}</td><td class="dkcell">${inr(cats.tour, 2)}</td>
        <td class="dkcell">${inr(cats.permits, 2)}</td><td class="dkcell">${inr(cats.ferry, 2)}</td><td class="dkcell">${cats.misc ? inr(cats.misc, 2) : ''}</td>
      </tr></tbody></table>
    </div>
    <div class="tbl flat sep"><table>
      <thead><tr><th>Package Cost</th><th>Discount</th><th>Total</th><th>Service<br/>Charge</th><th>Taxable Amount</th><th>GST</th><th>Total<br/>Tax</th><th style="width:24%">Final Payable Amount</th></tr></thead>
      <tbody><tr>
        <td class="dkcell">${inr(p.subtotal, 2)}</td><td class="dkcell">${p.discount ? inr(p.discount, 2) : ''}</td><td class="dkcell">${inr(p.subtotal, 2)}</td>
        <td class="dkcell">${servicePct}%</td><td class="dkcell">${inr(taxable)}</td><td class="dkcell">${gstPct}%</td>
        <td class="dkcell">${inr(p.tax, 2)}</td><td class="hl">${inr(p.total, 2)}</td>
      </tr></tbody></table>
    </div>
  </div>

  <div class="breakrow">
    <div class="cb">
      <div class="l">COST<br/>BREAKAGE:</div>
      <div class="rows">
        <div class="row"><div class="k">PAX:</div><div class="v">${pax}${paxChildren ? ` &nbsp;(${paxAdults} Adult + ${paxChildren} Child)` : ''}</div></div>
        <div class="row"><div class="k">TOUR COST PER PERSON:</div><div class="v">${inr(perPerson)}</div></div>
        ${paxAdults ? `<div class="row"><div class="k">ADULTS &nbsp;(${paxAdults} &times; ${inr(perPerson)}):</div><div class="v">${inr(paxAdults * perPerson)}</div></div>` : ''}
        ${paxChildren ? `<div class="row"><div class="k">CHILDREN &nbsp;(${paxChildren} &times; ${inr(perPerson)}):</div><div class="v">${inr(paxChildren * perPerson)}</div></div>` : ''}
        <div class="row"><div class="k">TOTAL PACKAGE COST:</div><div class="v tv">${inr(p.total)}</div></div>
      </div>
    </div>
  </div>

  <div class="confirm">
    <div class="lab">Total Payable Amount to Confirm Booking:</div>
    <div class="amt">${inr(advance)}</div>
  </div>

  <div class="notebox">
    <div>Please note that costing here is just for your reference, the GST invoice will be provided after tour completion.</div>
    <div>Misc Cost includes CNB, Water Sports or any additional service requested. Please check the &quot;Extra Inclusions&quot; section below the Daywise Itinerary for more information.</div>
    <div><b>BOOKING TERMS:</b>&nbsp; ${esc(company.bookingTerms)}</div>
  </div>
  ${BOTTOMBAR}
</div>

<!-- ===== Itinerary Introduction + Day Wise Itinerary ===== -->
<div class="page pb">
  ${introRows ? `<div class="band">Itinerary Introduction</div>
  <div style="margin-bottom:16px">${introRows}</div>` : ''}
  <div class="band">${q.nights}N${(q.nights || 0) + 1}D Day Wise Itinerary:</div>
  <div class="grow">${dayBlocks}</div>
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

<!-- ===== Optional Activities — upsell grid ===== -->
${optActs ? `<div class="page pb">
  <div class="band">OPTIONAL ACTIVITIES (On Request &mdash; Not Included in Package Cost):</div>
  <div class="oagrid">${optActs}</div>
  <div class="infobox" style="margin-top:16px">
    <div>Want to add any of these experiences to your trip? Let your travel consultant know and we will include it in your final itinerary.</div>
    <div>All water activities are subject to weather conditions and slot availability on the day of the activity.</div>
  </div>
  ${BOTTOMBAR}
</div>` : ''}

<!-- ===== PAGE 3 — Additional Info / Payment ===== -->
<div class="page pb">
  <div class="band">ADDITIONAL INFORMATION:</div>
  <div class="box"><h3>NOTE:</h3>${dash(company.notes)}</div>
  <div class="box g"><h3>INCLUSIONS:</h3>${dash(inclusions)}</div>
  <div class="box r"><h3>EXCLUSIONS:</h3>${dash(exclusions)}</div>
  <div class="paybox">
    <div class="ptitle"><span class="picon">&#128179;</span> Payment Information:</div>
    <table class="banktbl">
      <tr><td class="bk">Account Name</td><td>${esc(company.bank.holder)}</td></tr>
      <tr><td class="bk">Bank</td><td>${esc(company.bank.bank)}</td></tr>
      <tr><td class="bk">Branch Address</td><td>${esc(company.bank.address)}</td></tr>
      <tr><td class="bk">Current A/C No.</td><td>${esc(company.bank.accNo)}</td></tr>
      <tr><td class="bk">IFSC Code</td><td>${esc(company.bank.ifsc)}</td></tr>
      <tr><td class="bk">GSTIN</td><td>${esc(company.gstin)}</td></tr>
      <tr><td class="bk">Payment Link</td><td>${esc(company.bank.paymentLink)}</td></tr>
    </table>
  </div>
  ${ecRows ? `<div class="h1" style="font-size:14px;margin-top:16px">Emergency Contact Information:</div>
  <div class="tbl" style="margin-top:6px"><table>
    <thead><tr><th>Contact Name</th><th>Mobile Number</th><th>Email Id</th><th>Available On</th></tr></thead>
    <tbody>${ecRows}</tbody></table>
  </div>` : ''}
  <div class="infobox">
    <div>For payment made through bank transfer, please give us at least 30 minutes so we can confirm payment with the bank.</div>
    <div>For UPI transactions, please share the screenshot of the payment for instant confirmation.</div>
    <div>For any questions regarding alternate payment methods, please contact us.</div>
  </div>
  ${BOTTOMBAR}
</div>

<!-- ===== PAGE 4 — Company info + Terms & Conditions ===== -->
<div class="page pb">
  <div class="band">COMPANY &amp; CONTACT INFORMATION:</div>
  <div class="cocard">
    <div class="cbrand">
      <div class="logo">&#127796;</div>
      <div class="bn">${esc(company.name)}</div>
      <div class="cweb">${esc(company.website)}</div>
    </div>
    <div class="ccol"><b>ADDRESS:</b>${company.address.map(esc).join('<br/>')}</div>
    <div class="ccol"><b>CONTACT:</b>${company.phones.map((ph) => `&#128222; ${esc(ph)}`).join('<br/>')}<br/>&#9993; ${esc(company.emails[0])}</div>
  </div>
  <div class="support">
    <div>For any support, changes or requests regarding this itinerary, please contact your assigned representative.</div>
    <div>For any complaints or grievances, please email us at ${esc(company.emails[0])} or call us at ${esc(company.phones[0])}.</div>
  </div>

  <div class="tab">Terms &amp; Conditions:</div>
  <div class="tccontent">
    <div class="tcintro">These terms and conditions apply to all services and bookings provided by ${esc(company.name)}.</div>
    ${tcSections.map((s) => `<div class="tc-section"><h3>${esc(s.heading)}</h3>${tcDash(s.items)}</div>`).join('')}
  </div>
  ${BOTTOMBAR}
</div>

<!-- ===== PAGE 5 — Why Us ===== -->
<div class="page pb">
  <div class="band">WHY US:</div>
  ${whyUs.headline ? `<div class="script">${esc(whyUs.headline)}</div>` : ''}
  ${testimonialCards}
  ${reviewRows ? `
  <div class="readmore">
    <div class="rm-left">
      <h3>Read More Reviews:</h3>
      ${reviewRows}
    </div>
    <div class="searchpill"><span><b style="color:#4285f4">G</b>&nbsp; ${esc(company.name)}</span><span>&#128269;</span></div>
  </div>` : ''}
  <div class="disclaimer">The information contained in this document and electronic transmission can be privileged, and not available for disclosure. All information contained is owned by ${esc(company.name)}. Any unauthorized sharing and upload are prohibited. Terms &amp; Conditions: ${esc(company.website)}/terms-and-conditions</div>
  ${BOTTOMBAR}
</div>

<!-- ===== PAGE 6 — Gallery ===== -->
<div class="page">
  <div class="band">An Experience that you will Never Forget:</div>
  ${mosaic}
  <div class="qcard">
    <div class="qlogo">&#127796;</div>
    <div class="qtag">${esc(company.tagline)}</div>
    ${socialIcons ? `<div style="font-size:10px;color:#46566a;margin-top:14px;font-weight:700">Find us in the Social World:</div>
    <div class="socialrow">${socialIcons}</div>` : ''}
  </div>
  <div class="eod">End&nbsp;of&nbsp;Document</div>
  <div class="cpr">&copy; ${esc(company.name)} &nbsp;&#124;&nbsp; ${esc(company.website)}</div>
</div>

</body></html>`;
}
