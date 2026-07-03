import { company } from '../config/company.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad4 = (n) => { const s = String(n ?? '').trim(); return /^\d+$/.test(s) ? s.padStart(4, '0') : s; };
const inr = (n, dec = 0) => '&#8377;' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '&mdash;');
const fmtDateDM = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const stars = (n) => '&#9733;'.repeat(Math.min(n || 5, 5));
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
  const s = String(name || '').toLowerCase();
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
    <div class="lh-col"><b>Email:</b>${company.emails.map(esc).join('<br/>')}</div>
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
  const pillCls = (i) => 'pl' + (i % 3);
  const transports = pkg.transports || [];
  const transferRows = transports.map((t, i) => {
    const days = Array.isArray(t.days) ? t.days : (t.day ? [t.day] : []);
    const dayLabel = days.length > 0 ? `Day ${days.join(', ')}` : '—';
    return `<tr>
      <td class="bcell">${esc(t.serviceType || t.serviceLocation || dayLabel)}</td>
      <td><span class="pill ${pillCls(i)}">${esc(t.serviceLocation || dayLabel)}</span></td>
      <td>${esc(t.startTime) || '&mdash;'}</td>
    </tr>`;
  }).join('');
  const ferryLegend = transports.map((t) => esc(t.serviceLocation)).filter(Boolean).join(' &nbsp;&#124;&nbsp; ');

  // ---- Hotels table ----
  const hotels = pkg.hotels || [];
  const hotelRows = hotels.map((h) => `<tr>
    <td class="bcell">${esc(h.hotelName)}</td><td>${esc(h.roomType)}</td><td>${esc(h.city)}</td>
    <td>${h.rooms || 0}</td><td>${(h.nights || []).length || 1}</td>
    <td>${h.aweb || 0}</td><td>${h.cnb || 0}</td>
    <td><span class="pill navy">${esc(h.mealPlan)}</span></td>
  </tr>`).join('') || '<tr><td colspan="8" class="muted">No hotels added.</td></tr>';
  const hotelLegend = hotels.map((h) => placeCode(h.city)).filter(Boolean).join(' &nbsp;&#124;&nbsp; ');

  // ---- Day wise itinerary ----
  const dayBlocks = (q.days || []).map((d) => {
    const date = d.date || (start ? addDays(start, (d.dayNumber || 1) - 1) : null);
    const lines = String(d.description || '').split(/\n|·|•/).filter((x) => x.trim())
      .map((l) => `<div class="ditem">- ${esc(l.trim())}</div>`).join('');
    const title = d.title && !/^day\s*\d+$/i.test(d.title.trim()) ? ` &mdash; ${esc(d.title)}` : '';
    return `<div class="dayblk">
      <div class="dayhdr">&#9654; DAY ${d.dayNumber}:&nbsp; ${date ? fmtDateDM(date) : ''}${title}</div>
      ${lines}
    </div>`;
  }).join('') || '<p class="muted">No day-wise itinerary added.</p>';

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
  body { font-family: 'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif; color: var(--ink); font-size: 11px; background: #fff; -webkit-font-smoothing: antialiased; }

  /* ---- page wrapper: flex column so the blue bar pins to the bottom ---- */
  .page { min-height: 272mm; display: flex; flex-direction: column; }
  .pb { page-break-after: always; }
  .bottombar { margin-top: auto; height: 7px; background: var(--blue); border-radius: 2px; }
  .grow { flex: 1; }

  /* ---- letterhead: brand + Address | Email | Phone columns ---- */
  .lh { display: flex; align-items: stretch; margin-bottom: 16px; }
  .brand { display: flex; align-items: center; gap: 9px; width: 31%; }
  .logo { width: 42px; height: 42px; border-radius: 10px; background: var(--blue); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 21px; flex-shrink: 0; }
  .bn { font-size: 15.5px; font-weight: 800; color: var(--blue); line-height: 1.2; }
  .bsub { font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.09em; margin-top: 2px; white-space: nowrap; }
  .lh-col { flex: 1; text-align: center; border-left: 1px solid #c9d4df; padding: 2px 8px; font-size: 9.5px; color: #445468; line-height: 1.55; }
  .lh-col b { display: block; font-size: 10.5px; color: var(--ink); margin-bottom: 3px; }

  /* ---- blue band heading ---- */
  .band { background: var(--blue); color: #fff; padding: 10px 16px; font-weight: 800; font-size: 14.5px; border-radius: 5px; margin-bottom: 14px; }

  /* ---- page-1 quotation panels ---- */
  .panels { display: flex; justify-content: space-between; gap: 56px; margin: 6px 0 10px; }
  .panel { flex: 1; border: 1.5px solid var(--blue-dark); border-radius: 10px; overflow: hidden; }
  .ph { background: var(--blue); color: #fff; padding: 8px 14px; font-weight: 700; font-size: 12px; }
  .pc { background: var(--lblue); padding: 10px 14px 12px; min-height: 62px; }
  .pill { display: inline-block; border-radius: 999px; padding: 2.5px 11px; color: #fff; font-size: 9px; font-weight: 700; white-space: nowrap; }
  .pill.navy { background: var(--navy); }
  .pill.pl0 { background: #3565d6; } .pill.pl1 { background: #8b3fd1; } .pill.pl2 { background: #0e6b50; }

  /* ---- section headings ---- */
  .h1 { font-size: 19px; font-weight: 800; color: var(--ink); margin: 16px 0 6px; }

  /* ---- tables ---- */
  .tbl { border: 1px solid var(--line); border-radius: 9px; overflow: hidden; margin-top: 10px; background: #fff; }
  .tbl table { width: 100%; border-collapse: collapse; }
  .tbl thead th { background: var(--blue); color: #fff; padding: 8px 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.02em; text-align: center; font-weight: 700; border-right: 1px solid rgba(255,255,255,0.28); }
  .tbl thead th:last-child { border-right: 0; }
  .tbl td { padding: 9px 6px; text-align: center; font-size: 10.5px; font-weight: 600; color: var(--blue-dark); border-top: 1px solid #e3ecf4; }
  .tbl td.bcell { font-weight: 700; }
  .tbl td.dkcell { color: var(--ink); }
  .tbl .legend { background: #f2f6fa; border-top: 1px solid var(--line); padding: 6px; text-align: center; font-size: 8.5px; font-weight: 700; color: #46566a; }
  .tbl td.hl { background: var(--yellow); color: var(--ink); font-weight: 800; font-size: 12px; }
  .muted { color: #94a3b8; text-align: center; padding: 8px; font-weight: 500; }

  /* ---- cost breakage + confirm bar ---- */
  .breakrow { display: flex; gap: 14px; margin-top: 16px; }
  .cb { flex: 1; display: flex; border: 1px solid var(--line); border-radius: 9px; overflow: hidden; }
  .cb .l { background: var(--blue); color: #fff; font-weight: 800; font-size: 16px; line-height: 1.35; display: flex; align-items: center; justify-content: center; text-align: center; width: 38%; padding: 10px; }
  .cb .rows { flex: 1; display: flex; flex-direction: column; }
  .cb .row { flex: 1; display: flex; }
  .cb .row + .row { border-top: 1px solid var(--line); }
  .cb .k { flex: 1.25; display: flex; align-items: center; justify-content: flex-end; padding: 8px 12px; font-weight: 700; font-size: 10px; text-transform: uppercase; }
  .cb .v { flex: 1; background: var(--yellow); border-left: 1px solid var(--line); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11.5px; }
  .confirm { display: flex; margin-top: 14px; border-radius: 9px; overflow: hidden; }
  .confirm .lab { flex: 1; background: var(--blue); color: #fff; font-weight: 800; font-size: 13.5px; display: flex; align-items: center; justify-content: center; padding: 13px; }
  .confirm .amt { background: var(--green); color: #fff; font-weight: 800; font-size: 20px; padding: 13px 36px; display: flex; align-items: center; white-space: nowrap; }
  .notebox { margin-top: 13px; border: 1px solid var(--line); border-radius: 9px; padding: 8px 14px; font-size: 8.8px; color: #37475a; text-align: center; line-height: 1.85; }

  /* ---- day-wise itinerary ---- */
  .itin { border: 1.5px solid var(--blue); border-radius: 13px; background: var(--lblue2); padding: 20px 24px; column-count: 2; column-gap: 30px; }
  .dayblk { break-inside: avoid; page-break-inside: avoid; margin-bottom: 18px; }
  .dayhdr { font-weight: 800; font-size: 11px; margin-bottom: 7px; color: var(--ink); }
  .ditem { font-size: 10.5px; color: #2c3d51; line-height: 1.55; }
  .extra { display: flex; margin-top: 14px; border-radius: 11px; overflow: hidden; }
  .extra .el { background: var(--blue-dark); color: #fff; font-weight: 800; font-size: 12px; padding: 15px 18px; display: flex; align-items: center; white-space: nowrap; }
  .extra .er { flex: 1; background: var(--blue); color: #fff; font-size: 11px; padding: 15px 16px; display: flex; align-items: center; }

  /* ---- info boxes (note / inclusions / exclusions) ---- */
  .box { border: 1.2px solid var(--line); border-radius: 10px; padding: 11px 15px; margin-top: 12px; background: #fff; }
  .box.g { background: #f2fbf5; border-color: #7ecf9a; }
  .box.r { background: #fef5f5; border-color: #f0a8a8; }
  .box h3 { font-size: 11.5px; font-weight: 800; color: var(--ink); margin-bottom: 6px; letter-spacing: 0.02em; }
  .dl { font-size: 10.5px; color: #2c3d51; line-height: 1.6; }

  /* ---- payment info ---- */
  .paybox { border: 1.6px solid var(--blue); background: #e9f3fb; border-radius: 13px; padding: 16px 20px; margin-top: 15px; }
  .paybox .ptitle { display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 800; color: var(--ink); margin-bottom: 10px; }
  .paybox .picon { font-size: 22px; }
  .paybox .kv { font-size: 10.5px; margin: 3.5px 0; color: #2c3d51; }
  .paybox .kv b { display: inline-block; min-width: 100px; color: var(--ink); }
  .paybox .plink { border-top: 1.2px solid #b9d7ec; margin-top: 10px; padding-top: 9px; }
  .infobox { margin-top: 14px; border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; font-size: 9px; color: #37475a; text-align: center; line-height: 2; }

  /* ---- company & contact card (page 4) ---- */
  .cocard { border: 1px solid var(--line); border-radius: 12px; padding: 16px 20px; display: flex; align-items: center; }
  .cocard .cbrand { width: 33%; text-align: center; }
  .cocard .cbrand .logo { margin: 0 auto 6px; width: 48px; height: 48px; font-size: 24px; }
  .cocard .cweb { font-size: 9px; color: #64748b; margin-top: 3px; }
  .cocard .ccol { flex: 1; border-left: 1px solid #d8e2ec; padding: 4px 16px; font-size: 10.5px; color: #2c3d51; line-height: 1.65; }
  .cocard .ccol b { display: block; font-size: 11px; color: var(--ink); margin-bottom: 4px; letter-spacing: 0.03em; }
  .support { background: var(--lblue2); border: 1px solid #bcd9ee; border-radius: 9px; padding: 9px 14px; text-align: center; font-size: 9.3px; color: #2c3d51; line-height: 1.9; margin-top: 12px; }

  /* ---- T&C ---- */
  .tab { display: inline-block; background: var(--blue); color: #fff; font-weight: 800; font-size: 14px; padding: 11px 26px; border-radius: 9px 9px 0 0; margin-top: 18px; }
  .tccontent { border-top: 2.5px solid var(--blue); padding-top: 10px; }
  .tcintro { font-size: 10.5px; color: #2c3d51; margin: 4px 0 8px; }
  .tc-section { margin-top: 11px; break-inside: avoid; page-break-inside: avoid; }
  .tc-section h3 { font-size: 10.5px; font-weight: 800; color: var(--ink); margin-bottom: 4px; }

  /* ---- why us / reviews ---- */
  .script { font-family: 'Segoe Script', 'Brush Script MT', cursive; font-size: 15px; color: var(--ink); margin: 6px 0 14px; }
  .review-card { border: 1.4px solid #8fd0a5; border-radius: 11px; background: #fff; padding: 13px 16px; margin-bottom: 12px; }
  .review-text { font-size: 10.8px; color: #2c3d51; line-height: 1.7; }
  .review-footer { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
  .avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--blue); color: #fff; font-weight: 800; font-size: 11px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .reviewer-name { font-weight: 800; font-size: 11.5px; color: var(--ink); }
  .reviewer-via { font-size: 9px; color: #64748b; margin-top: 1px; }
  .stars { color: #f59e0b; font-size: 10px; letter-spacing: 1px; }
  .readmore { background: #f2f5f8; border: 1px solid var(--line); border-radius: 11px; padding: 14px 18px; margin-top: 14px; display: flex; align-items: center; }
  .readmore .rm-left { flex: 1; }
  .readmore h3 { font-size: 13px; font-weight: 800; margin-bottom: 8px; }
  .rm-row { font-size: 10.5px; margin: 4px 0; color: #2c3d51; }
  .rm-row b { display: inline-block; min-width: 86px; }
  .rm-url { color: var(--blue-dark); }
  .searchpill { background: #e4e9ee; border-radius: 999px; padding: 9px 16px; font-size: 11px; color: #37475a; display: flex; align-items: center; gap: 8px; min-width: 220px; justify-content: space-between; }
  .disclaimer { margin-top: 14px; border: 1px solid var(--line); border-radius: 10px; padding: 9px 16px; font-size: 8.6px; color: #5b6b7d; text-align: center; line-height: 1.8; }

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
  .cpr { margin-top: auto; background: var(--blue); color: #fff; text-align: center; font-size: 9.5px; font-weight: 600; padding: 7px; border-radius: 2px; }
</style>
</head>
<body>

<!-- ===== PAGE 1 — Quote summary ===== -->
<div class="page pb">
  ${LETTERHEAD}

  <div class="panels">
    <div class="panel">
      <div class="ph">Quotation for:</div>
      <div class="pc">
        <div style="font-weight:800;font-size:12.5px">${esc([guest.salutation, guest.name].filter(Boolean).join(' ') || 'Guest')} &nbsp;&#124;&nbsp; M${esc(pad4(q.query?.queryNumber))}</div>
        ${guest.phones?.[0] ? `<div style="font-size:10px;color:#37475a;margin-top:2px">+${esc(guest.phones[0].countryCode)} ${esc(guest.phones[0].number)}</div>` : ''}
        <div style="margin-top:5px;font-size:10.5px;font-weight:700">Adults: ${paxAdults}, &nbsp;Child: ${paxChildren} &nbsp;&nbsp;<span class="pill navy">${esc(pkg.name || 'Package')}</span></div>
      </div>
    </div>
    <div class="panel">
      <div class="ph">${esc(tripTitle)}:</div>
      <div class="pc" style="text-align:right">
        <div style="font-weight:800;font-size:10.5px">Travel Dates:</div>
        <div style="font-size:11px;margin-top:3px">${fmtDate(start)}</div>
        <div style="font-size:11px">${end ? fmtDate(end) : ''}</div>
      </div>
    </div>
  </div>

  <div class="h1">Cruise and Hotel Information:</div>
  ${transferRows ? `<div class="tbl"><table>
    <thead><tr><th style="width:34%">Name</th><th style="width:33%">Ferry Sector</th><th>Departure Timings</th></tr></thead>
    <tbody>${transferRows}</tbody></table>
    ${ferryLegend ? `<div class="legend">${ferryLegend}</div>` : ''}
  </div>` : ''}

  <div class="tbl"><table>
    <thead><tr><th>Hotel Name</th><th>Type of Room</th><th>Place</th><th>&#35; Rooms</th><th>&#35; Nights</th><th>Extra<br/>Mattress</th><th>W/O<br/>Mattress</th><th>Meal Plan</th></tr></thead>
    <tbody>${hotelRows}</tbody></table>
    ${hotelLegend ? `<div class="legend">${hotelLegend}</div>` : ''}
  </div>

  <div class="h1">Transparent Breakage of all Costs:</div>
  <div class="tbl"><table>
    <thead><tr><th>Hotel Cost</th><th>Tour Cost</th><th>Permits &amp; Boat Cost</th><th>Ferry Cost</th><th>Misc Cost</th></tr></thead>
    <tbody><tr>
      <td class="dkcell">${inr(cats.hotel, 2)}</td><td class="dkcell">${inr(cats.tour, 2)}</td>
      <td class="dkcell">${inr(cats.permits, 2)}</td><td class="dkcell">${inr(cats.ferry, 2)}</td><td class="dkcell">${cats.misc ? inr(cats.misc, 2) : ''}</td>
    </tr></tbody></table>
  </div>

  <div class="tbl"><table>
    <thead><tr><th>Package Cost</th><th>Discount</th><th>Total</th><th>Service<br/>Charge</th><th>Taxable Amount</th><th>GST</th><th>Total<br/>Tax</th><th style="width:24%">Final Payable Amount</th></tr></thead>
    <tbody><tr>
      <td class="dkcell">${inr(p.subtotal, 2)}</td><td class="dkcell">${p.discount ? inr(p.discount, 2) : ''}</td><td class="dkcell">${inr(p.subtotal, 2)}</td>
      <td class="dkcell">${servicePct}%</td><td class="dkcell">${inr(taxable)}</td><td class="dkcell">${gstPct}%</td>
      <td class="dkcell">${inr(p.tax, 2)}</td><td class="hl">${inr(p.total, 2)}</td>
    </tr></tbody></table>
  </div>

  <div class="breakrow">
    <div class="cb">
      <div class="l">COST<br/>BREAKAGE:</div>
      <div class="rows">
        <div class="row"><div class="k">PAX:</div><div class="v">${pax}</div></div>
        <div class="row"><div class="k">TOUR COST PER PERSON:</div><div class="v">${inr(perPerson)}</div></div>
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

<!-- ===== PAGE 2 — Day Wise Itinerary ===== -->
<div class="page pb">
  <div class="band">${q.nights}N${(q.nights || 0) + 1}D Day Wise Itinerary:</div>
  <div class="itin grow">${dayBlocks}</div>
  <div class="extra">
    <div class="el">EXTRA INCLUSIONS:</div>
    <div class="er">${esc(extras)}</div>
  </div>
  ${BOTTOMBAR}
</div>

<!-- ===== PAGE 3 — Additional Info / Payment ===== -->
<div class="page pb">
  <div class="band">ADDITIONAL INFORMATION:</div>
  <div class="box"><h3>NOTE:</h3>${dash(company.notes)}</div>
  <div class="box g"><h3>INCLUSIONS:</h3>${dash(inclusions)}</div>
  <div class="box r"><h3>EXCLUSIONS:</h3>${dash(exclusions)}</div>
  <div class="paybox">
    <div class="ptitle"><span class="picon">&#128179;</span> Payment Information:</div>
    <div class="kv"><b>Holder Name:</b> ${esc(company.bank.holder)}</div>
    <div class="kv"><b>Bank:</b> ${esc(company.bank.bank)}</div>
    <div class="kv"><b>Address:</b> ${esc(company.bank.address)}</div>
    <div class="kv"><b>Acc. No.:</b> ${esc(company.bank.accNo)}</div>
    <div class="kv"><b>IFSC Code:</b> ${esc(company.bank.ifsc)}</div>
    <div class="kv plink"><b>Payment Link:</b> ${esc(company.bank.paymentLink)}</div>
  </div>
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
  </div>
  <div class="cpr">&copy; ${esc(company.name)} &nbsp;&#124;&nbsp; ${esc(company.website)}</div>
</div>

</body></html>`;
}
