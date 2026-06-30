import { company } from '../config/company.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad4 = (n) => { const s = String(n ?? '').trim(); return /^\d+$/.test(s) ? s.padStart(4, '0') : s; };
const inr = (n, dec = 0) => '&#8377;' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '&mdash;');
const fmtDateShort = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) : '');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const stars = (n) => '&#9733;'.repeat(Math.min(n || 5, 5));
const li = (arr) => (arr || []).map((x) => `<li>${esc(x)}</li>`).join('');
const bullet = (arr) => (arr || []).map((x) => `<div class="bl"><span class="arr">&#9658;</span><span>${esc(x)}</span></div>`).join('');

const LETTERHEAD = `
  <div class="lh">
    <div class="brand"><div class="logo">&#127796;</div><div><div class="bn">${esc(company.name)}</div><div class="sub">Quality Tours. Exceptional Service.</div></div></div>
    <div class="lh-mid small"><b class="dk">Address:</b><br/>${company.address.map(esc).join('<br/>')}</div>
    <div class="lh-right small"><b class="dk">Contact:</b><br/>${company.emails.map(esc).join('<br/>')}<br/>${company.phones.map(esc).join('<br/>')}</div>
  </div>`;

const FOOTER = `
  <div class="footer">
    <span>&#9993; ${esc(company.emails[0])} &nbsp;&nbsp; &#9742; ${esc(company.phones[0])}</span>
    <span class="brand-bold">${esc(company.tagline)}</span>
  </div>`;

// Build the self-contained HTML for a populated quote document.
export function quotationHtml(q) {
  const pkg = (q.packages || [])[q.selectedPackageIndex || 0] || {};
  const guest = q.query?.guest || {};
  const paxAdults = q.pax?.adults || 0;
  const paxChildren = q.pax?.children?.length || 0;
  const pax = paxAdults + paxChildren;
  const start = q.startDate ? new Date(q.startDate) : null;
  const end = start ? addDays(start, q.nights || 0) : null;

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
  const tc = company.termsAndConditions || {};
  const whyUs = company.whyUs || {};
  const gallery = company.galleryImages || [];

  // Transport rows
  const transferRows = (pkg.transports || []).map((t) => {
    const days = Array.isArray(t.days) ? t.days : (t.day ? [t.day] : []);
    const dayLabel = days.length > 0 ? `Day ${days.join(', ')}` : '—';
    return `<tr>
      <td class="c b">${esc(t.serviceLocation || dayLabel)}</td>
      <td class="c">${esc(t.serviceType) || '—'}</td>
      <td class="c">${esc(t.startTime) || '—'}</td>
    </tr>`;
  }).join('');

  const hotelRows = (pkg.hotels || []).map((h) => `<tr>
    <td class="b">${esc(h.hotelName)}</td><td class="c">${esc(h.roomType)}</td><td class="c">${esc(h.city)}</td>
    <td class="c">${h.rooms || 0}</td><td class="c">${(h.nights || []).length || 1}</td>
    <td class="c">${h.aweb || 0}</td><td class="c">${h.cnb || 0}</td>
    <td class="c"><span class="tag">${esc(h.mealPlan)}</span></td>
  </tr>`).join('') || '<tr><td colspan="8" class="c muted">No hotels added.</td></tr>';

  // Day wise itinerary
  const dayRows = (q.days || []).map((d) => {
    const lines = String(d.description || '').split(/\n|·|•/).filter((x) => x.trim())
      .map((l) => `<div class="dline"><span class="arr">&#9658;</span><span>${esc(l.trim())}</span></div>`).join('');
    return `<div class="day-card">
      <div class="day-hdr">
        <span class="day-num">${d.dayNumber}</span>
        <div>
          <div class="day-title">${esc(d.title || 'Day ' + d.dayNumber)}</div>
          ${d.date ? `<div class="day-date">${fmtDateShort(d.date)}</div>` : ''}
        </div>
      </div>
      ${lines ? `<div class="day-body">${lines}</div>` : ''}
    </div>`;
  }).join('') || '<p class="muted">No day-wise itinerary added.</p>';

  // Testimonials
  const testimonialCards = (whyUs.testimonials || []).map((t) => `
    <div class="review-card">
      <div class="quote-icon">&ldquo;</div>
      <div class="review-text">${esc(t.review)}</div>
      <div class="review-footer">
        <div>
          <div class="reviewer-name">${esc(t.name)}</div>
          <div class="reviewer-via">via ${esc(t.platform)}</div>
        </div>
        <div class="stars">${stars(t.rating)}</div>
      </div>
    </div>`).join('');

  // Gallery images
  const galleryImgs = gallery.map((src) => `
    <div class="gal-item">
      <img src="${esc(src)}" alt="Andaman" style="width:100%;height:100%;object-fit:cover;display:block;" />
    </div>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; font-size: 11.5px; background: #fff; }

  /* ---- page wrapper ---- */
  .page { padding: 14px 20px 14px; min-height: 0; }
  .pb { page-break-after: always; }

  /* ---- letterhead ---- */
  .lh { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 14px; }
  .brand { display: flex; align-items: center; gap: 8px; }
  .logo { width: 38px; height: 38px; border-radius: 9px; background: #1566d6; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
  .bn { font-size: 15px; font-weight: 800; color: #1566d6; line-height: 1.2; }
  .sub { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; }
  .lh-mid { text-align: center; }
  .lh-right { text-align: right; }
  .small { font-size: 10px; color: #475569; line-height: 1.5; }
  .dk { color: #1e293b; }

  /* ---- footer ---- */
  .footer { margin-top: 14px; border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
  .brand-bold { color: #1566d6; font-weight: 700; }

  /* ---- band heading ---- */
  .band { background: #1566d6; color: #fff; padding: 8px 14px; font-weight: 800; font-size: 14px; border-radius: 6px; margin-bottom: 12px; }

  /* ---- tables ---- */
  table { width: 100%; border-collapse: collapse; border-radius: 7px; overflow: hidden; margin-top: 8px; }
  thead th { background: #1566d6; color: #fff; padding: 6px 5px; font-size: 10.5px; text-align: center; font-weight: 600; }
  td { padding: 6px 5px; border-bottom: 1px solid #e8eef8; font-size: 10.5px; }
  td.c { text-align: center; }
  td.b { font-weight: 700; color: #0f51ad; }
  .muted { color: #94a3b8; text-align: center; padding: 8px; }
  .tag { background: #1566d6; color: #fff; border-radius: 999px; padding: 2px 7px; font-size: 9.5px; font-weight: 600; white-space: nowrap; }
  .final { color: #1566d6; font-weight: 800; font-size: 13px; }

  /* ---- page-1 quote panels ---- */
  .panels { display: flex; gap: 10px; margin-bottom: 12px; }
  .panel { flex: 1; border: 1px solid #b6d0ff; border-radius: 9px; overflow: hidden; }
  .ph { background: #1566d6; color: #fff; padding: 6px 11px; font-weight: 700; font-size: 11px; }
  .pc { background: #eef4ff; padding: 9px 11px; }

  /* ---- cost breakage row ---- */
  .breakage { display: flex; gap: 10px; margin-top: 10px; }
  .cb { flex: 1; display: flex; border-radius: 9px; overflow: hidden; border: 1px solid #e2e8f0; }
  .cb .l { background: #1566d6; color: #fff; padding: 10px 12px; font-weight: 800; font-size: 12px; display: flex; align-items: center; text-align: center; line-height: 1.3; }
  .cb .r { flex: 1; background: #fffaf0; }
  .cb .row { display: flex; justify-content: space-between; padding: 5px 10px; border-bottom: 1px solid #e8eef8; font-size: 11px; }
  .advance { flex: 1; display: flex; align-items: center; justify-content: space-between; background: #1566d6; color: #fff; border-radius: 9px; overflow: hidden; }
  .advance .amt { background: #0f51ad; padding: 10px 16px; font-size: 17px; font-weight: 800; white-space: nowrap; }
  .note { margin-top: 10px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 7px; padding: 7px 10px; text-align: center; font-size: 9.5px; color: #64748b; }

  /* ---- day-wise itinerary ---- */
  .day-card { border: 1px solid #d8e6ff; border-radius: 7px; overflow: hidden; margin-bottom: 8px; }
  .day-hdr { background: #1566d6; display: flex; align-items: center; gap: 10px; padding: 6px 10px; }
  .day-num { width: 24px; height: 24px; border-radius: 50%; background: #fff; color: #1566d6; font-weight: 800; font-size: 11px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .day-title { color: #fff; font-weight: 700; font-size: 12px; }
  .day-date { color: #b6d0ff; font-size: 10px; margin-top: 1px; }
  .day-body { background: #eef4ff; padding: 8px 12px; }
  .dline { display: flex; gap: 6px; margin-bottom: 3px; font-size: 11px; color: #334155; line-height: 1.4; }
  .arr { color: #1566d6; flex-shrink: 0; margin-top: 1px; }

  /* ---- inclusion/exclusion boxes ---- */
  .box { border: 1px solid #e2e8f0; border-radius: 9px; padding: 9px 11px; margin-top: 10px; }
  .box.g { background: #f0fdf4; border-color: #bbf7d0; }
  .box.r { background: #fff1f2; border-color: #fecdd3; }
  .box.s { background: #f8fafc; }
  .box h3 { margin: 0 0 5px; font-size: 11.5px; color: #1e293b; }
  .box ul { margin: 0; padding-left: 0; list-style: none; color: #475569; }
  .box ul li { padding: 2px 0; }
  .box ul li::before { content: "- "; }

  /* ---- payment info ---- */
  .pay { border: 1px solid #b6d0ff; background: #eef4ff; border-radius: 9px; padding: 12px 14px; margin-top: 12px; }
  .pay h3 { margin: 0 0 7px; font-size: 13px; color: #0f51ad; }
  .pay .kv { font-size: 11px; margin: 2px 0; }

  /* ---- T&C ---- */
  .tc-section { margin-top: 14px; }
  .tc-section h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #1e293b; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .bl { display: flex; gap: 6px; margin-bottom: 4px; font-size: 11px; color: #334155; line-height: 1.4; }

  /* ---- company info box ---- */
  .company-box { background: #1566d6; color: #fff; border-radius: 12px; padding: 18px 20px; margin-top: 20px; }
  .company-box .cbn { font-size: 18px; font-weight: 800; }
  .company-box .gstin { font-size: 10px; color: #b6d0ff; margin-top: 2px; }
  .company-box .cgrid { display: flex; gap: 24px; margin-top: 10px; }
  .company-box .col-label { font-size: 10px; color: #b6d0ff; font-weight: 600; margin-bottom: 2px; }
  .company-box .col-val { font-size: 11px; line-height: 1.5; }

  /* ---- testimonials ---- */
  .why-headline { font-size: 13px; font-weight: 600; color: #1e293b; margin-bottom: 14px; }
  .review-card { border: 1px solid #d8e6ff; border-radius: 9px; background: #eef4ff; padding: 12px 14px; margin-bottom: 10px; }
  .quote-icon { font-size: 28px; color: #1566d6; line-height: 1; margin-bottom: 4px; }
  .review-text { font-size: 11.5px; color: #334155; line-height: 1.55; font-style: italic; }
  .review-footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 10px; }
  .reviewer-name { font-weight: 700; font-size: 12px; color: #1e293b; }
  .reviewer-via { font-size: 10px; color: #64748b; }
  .stars { color: #f59e0b; font-size: 14px; letter-spacing: 1px; }
  .review-links { display: flex; gap: 10px; margin-top: 12px; }
  .review-link { border: 1px solid #b6d0ff; border-radius: 7px; padding: 8px 12px; font-size: 11px; background: #eef4ff; }
  .review-link .rl-label { font-weight: 600; color: #1e293b; }
  .review-link .rl-url { color: #1566d6; font-size: 10px; }

  /* ---- gallery ---- */
  .gal-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
  .gal-item { border-radius: 9px; overflow: hidden; height: 145px; }
  .gallery-footer { background: #1566d6; color: #fff; border-radius: 12px; padding: 18px 20px; margin-top: 18px; text-align: center; }
  .gallery-footer .gf-name { font-size: 20px; font-weight: 800; }
  .gallery-footer .gf-tag { font-size: 12px; color: #b6d0ff; margin-top: 3px; }
  .gallery-footer .gf-contact { font-size: 11px; color: #d8e6ff; margin-top: 8px; }
  .gallery-footer .gf-web { font-size: 10px; color: #b6d0ff; margin-top: 4px; }
  h2 { font-size: 16px; margin: 14px 0 6px; color: #0f51ad; font-weight: 800; }
  .sub { white-space: nowrap; }
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
        <div style="font-weight:700;font-size:12px">${esc([guest.salutation, guest.name].filter(Boolean).join(' ') || 'Guest')} &nbsp;|&nbsp; M${esc(pad4(q.query?.queryNumber))}</div>
        ${guest.phones?.[0] ? `<div class="small">+${esc(guest.phones[0].countryCode)} ${esc(guest.phones[0].number)}</div>` : ''}
        <div style="margin-top:4px;font-size:11px">Adults: ${paxAdults}, Children: ${paxChildren} &nbsp;<span class="tag">${esc(pkg.name || 'Package')}</span></div>
      </div>
    </div>
    <div class="panel">
      <div class="ph">${q.nights}N${(q.nights || 0) + 1}D ${esc(pkg.name || 'Package')} to Andaman:</div>
      <div class="pc" style="text-align:right">
        <div class="small" style="font-size:10.5px">Travel Dates:</div>
        <div style="font-weight:700;font-size:12px">${fmtDate(start)}</div>
        <div style="font-weight:700;font-size:12px">${end ? fmtDate(end) : ''}</div>
      </div>
    </div>
  </div>

  <h2>Cruise and Hotel Information:</h2>
  ${transferRows ? `<table><thead><tr><th>Sector / Transfer</th><th>Service</th><th>Start Time</th></tr></thead><tbody>${transferRows}</tbody></table>` : ''}
  <table>
    <thead><tr><th>Hotel Name</th><th>Type of Room</th><th>Place</th><th>#Rooms</th><th>#Nights</th><th>Extra Mattress</th><th>W/O Mattress</th><th>Meal Plan</th></tr></thead>
    <tbody>${hotelRows}</tbody>
  </table>

  <h2>Transparent Breakage of all Costs:</h2>
  <table>
    <thead><tr><th>Hotel Cost</th><th>Tour Cost</th><th>Permits &amp; Boat</th><th>Ferry Cost</th><th>Misc Cost</th></tr></thead>
    <tbody><tr>
      <td class="c b">${inr(cats.hotel)}</td><td class="c b">${inr(cats.tour)}</td>
      <td class="c b">${inr(cats.permits)}</td><td class="c b">${inr(cats.ferry)}</td><td class="c b">${inr(cats.misc)}</td>
    </tr></tbody>
  </table>

  <table>
    <thead><tr><th>Package Cost</th><th>Discount</th><th>Total</th><th>Service Charge</th><th>Taxable</th><th>GST</th><th>Total Tax</th><th>Final Payable</th></tr></thead>
    <tbody><tr>
      <td class="c">${inr(p.subtotal)}</td><td class="c">&mdash;</td><td class="c">${inr(p.subtotal)}</td>
      <td class="c">${servicePct}%</td><td class="c">${inr(taxable)}</td><td class="c">${gstPct}%</td>
      <td class="c">${inr(p.tax, 2)}</td><td class="c final">${inr(p.total, 2)}</td>
    </tr></tbody>
  </table>

  <div class="breakage">
    <div class="cb">
      <div class="l">COST<br/>BREAKAGE</div>
      <div class="r">
        <div class="row"><span>Pax:</span><b>${pax}</b></div>
        <div class="row"><span>Per Person:</span><b>${inr(perPerson)}</b></div>
      </div>
    </div>
    <div class="advance">
      <span style="padding:0 12px;font-weight:700;font-size:11px">Payable to Confirm Booking (${company.advancePercent}%):</span>
      <span class="amt">${inr(advance)}</span>
    </div>
  </div>
  <div class="note">Costing here is for your reference; the GST invoice will be provided after tour completion. ${esc(company.bookingTerms)}</div>
</div>

<!-- ===== PAGE 2 — Day Wise Itinerary ===== -->
<div class="page pb">
  ${LETTERHEAD}
  <div class="band">${q.nights}N${(q.nights || 0) + 1}D Day Wise Itinerary:</div>
  ${dayRows}
  ${FOOTER}
</div>

<!-- ===== PAGE 3 — Additional Info / Payment ===== -->
<div class="page pb">
  ${LETTERHEAD}
  <div class="band">Additional Information:</div>
  <div class="box s"><h3>NOTE:</h3><ul>${li(company.notes)}</ul></div>
  <div class="box g"><h3>INCLUSIONS:</h3><ul>${li(inclusions)}</ul></div>
  <div class="box r"><h3>EXCLUSIONS:</h3><ul>${li(exclusions)}</ul></div>
  <div class="pay">
    <h3>&#9873; Payment Information</h3>
    <div class="kv"><b>Holder Name:</b> ${esc(company.bank.holder)}</div>
    <div class="kv"><b>Bank:</b> ${esc(company.bank.bank)}</div>
    <div class="kv"><b>Address:</b> ${esc(company.bank.address)}</div>
    <div class="kv"><b>Acc. No.:</b> ${esc(company.bank.accNo)}</div>
    <div class="kv"><b>IFSC Code:</b> ${esc(company.bank.ifsc)}</div>
    <div class="kv"><b>Payment Link:</b> ${esc(company.bank.paymentLink)}</div>
  </div>
  ${FOOTER}
</div>

<!-- ===== PAGE 4 — Terms & Conditions ===== -->
<div class="page pb">
  ${LETTERHEAD}
  <div class="band">Terms &amp; Conditions:</div>

  ${tc.ferry?.length ? `<div class="tc-section"><h3>Ferry / Cruise</h3>${bullet(tc.ferry)}</div>` : ''}
  ${tc.travelingSafety?.length ? `<div class="tc-section"><h3>Traveling Safety</h3>${bullet(tc.travelingSafety)}</div>` : ''}
  ${tc.paymentsRefunds?.length ? `<div class="tc-section"><h3>Payments &amp; Refunds</h3>${bullet(tc.paymentsRefunds)}</div>` : ''}

  <div class="company-box">
    <div style="display:flex;align-items:center;gap:10px">
      <div class="logo" style="font-size:22px">&#127796;</div>
      <div>
        <div class="cbn">${esc(company.name)}</div>
        <div class="gstin">GSTIN: ${esc(company.gstin || '')}</div>
      </div>
    </div>
    <div class="cgrid">
      <div>
        <div class="col-label">Address</div>
        <div class="col-val">${company.address.map(esc).join('<br/>')}</div>
      </div>
      <div>
        <div class="col-label">Contact</div>
        <div class="col-val">${company.emails.map(esc).join('<br/>')} <br/> ${company.phones.map(esc).join('<br/>')}<br/>${esc(company.website)}</div>
      </div>
    </div>
  </div>
  ${FOOTER}
</div>

<!-- ===== PAGE 5 — Why Choose Us ===== -->
<div class="page pb">
  ${LETTERHEAD}
  <div class="band">Why Choose ${esc(company.name)}?</div>
  ${whyUs.headline ? `<div class="why-headline" style="margin-top:12px">${esc(whyUs.headline)}</div>` : ''}
  ${testimonialCards}
  ${(whyUs.reviewLinks || []).length ? `
    <div class="review-links">
      ${whyUs.reviewLinks.map((rl) => `<div class="review-link"><div class="rl-label">Read reviews on ${esc(rl.label)}</div><div class="rl-url">${esc(rl.url)}</div></div>`).join('')}
    </div>` : ''}
  ${FOOTER}
</div>

<!-- ===== PAGE 6 — Gallery ===== -->
<div class="page">
  ${LETTERHEAD}
  <div class="band">An Experience You Will Never Forget</div>
  ${gallery.length ? `<div class="gal-grid">${galleryImgs}</div>` : '<p class="muted" style="margin-top:12px">No gallery images configured.</p>'}
  <div class="gallery-footer">
    <div class="gf-name">${esc(company.name)}</div>
    <div class="gf-tag">${esc(company.tagline)}</div>
    <div class="gf-contact">&#9993; ${esc(company.emails[0])} &nbsp;&nbsp;&nbsp; &#9742; ${esc(company.phones[0])}</div>
    <div class="gf-web">${esc(company.website)}</div>
  </div>
</div>

</body></html>`;
}
