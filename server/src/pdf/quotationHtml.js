import { company } from '../config/company.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad4 = (n) => { const s = String(n ?? '').trim(); return /^\d+$/.test(s) ? s.padStart(4, '0') : s; };
const inr = (n, dec = 0) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

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

  const transferRows = (pkg.transports || [])
    .map((t) => `<tr><td class="c b">${esc(t.serviceLocation || 'Day ' + t.day)}</td><td class="c">${esc(t.serviceType || '—')}</td><td class="c">${esc(t.startTime || '—')}</td></tr>`)
    .join('');
  const hotelRows = (pkg.hotels || [])
    .map((h) => `<tr>
      <td class="c b">${esc(h.hotelName)}</td><td class="c">${esc(h.roomType)}</td><td class="c">${esc(h.city)}</td>
      <td class="c">${h.rooms || 0}</td><td class="c">${(h.nights || []).length || 1}</td><td class="c">${h.aweb || 0}</td><td class="c">${h.cnb || 0}</td>
      <td class="c"><span class="tag">${esc(h.mealPlan)}</span></td></tr>`)
    .join('') || '<tr><td colspan="8" class="c muted">No hotels added.</td></tr>';

  const dayCards = (q.days || []).map((d) => {
    const lines = String(d.description || '').split(/\n|·/).filter((x) => x.trim()).map((l) => `<li>- ${esc(l.trim())}</li>`).join('');
    return `<div class="day"><div class="dh">▸ DAY ${d.dayNumber}${d.date ? ': ' + fmtDate(d.date) : ''}</div><div class="dt">${esc(d.title || '')}</div><ul>${lines}</ul></div>`;
  }).join('') || '<p class="muted">No itinerary added.</p>';

  const li = (arr) => arr.map((x) => `<li>- ${esc(x)}</li>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2d2b; margin: 0; font-size: 12px; }
  .page { padding: 0 4px; }
  .pb { page-break-after: always; }
  h2 { font-size: 19px; margin: 18px 0 8px; color: #0f2e2a; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; border-radius: 8px; overflow: hidden; }
  thead th { background: #0d9488; color: #fff; padding: 7px 6px; font-size: 11px; text-align: center; }
  td { padding: 7px 6px; border-bottom: 1px solid #eef2f1; font-size: 11px; }
  td.c { text-align: center; } td.b { font-weight: 700; color: #0f766e; }
  .muted { color: #94a3b8; text-align: center; padding: 10px; }
  .tag { background: #0d9488; color: #fff; border-radius: 999px; padding: 2px 8px; font-size: 10px; font-weight: 600; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 14px; }
  .brand { display: flex; align-items: center; gap: 8px; }
  .logo { width: 40px; height: 40px; border-radius: 10px; background: #0d9488; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 20px; }
  .bn { font-size: 17px; font-weight: 800; color: #0f766e; }
  .small { font-size: 10px; color: #64748b; }
  .panels { display: flex; gap: 12px; margin-top: 16px; }
  .panel { flex: 1; border: 1px solid #99f6e4; border-radius: 10px; overflow: hidden; }
  .panel .ph { background: #0d9488; color: #fff; padding: 7px 12px; font-weight: 700; font-size: 12px; }
  .panel .pc { background: #f0fdfa; padding: 10px 12px; }
  .band { background: #0d9488; color: #fff; padding: 9px 14px; font-weight: 800; font-size: 15px; border-radius: 6px; }
  .grid2 { display: flex; gap: 12px; margin-top: 12px; }
  .summary td { font-weight: 700; }
  .final { color: #0f766e; font-weight: 800; font-size: 14px; }
  .breakage { display: flex; gap: 12px; margin-top: 12px; }
  .cb { flex: 1; display: flex; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
  .cb .l { background: #0d9488; color: #fff; padding: 14px; font-weight: 800; display: flex; align-items: center; }
  .cb .r { flex: 1; background: #fffaf0; }
  .cb .row { display: flex; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid #eef2f1; }
  .advance { flex: 1; display: flex; align-items: center; justify-content: space-between; background: #0d9488; color: #fff; border-radius: 10px; overflow: hidden; }
  .advance .amt { background: #10b981; padding: 14px 18px; font-size: 18px; font-weight: 800; }
  .days { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
  .day { width: 48%; border: 1px solid #ccfbf1; background: #f0fdfa; border-radius: 8px; padding: 8px 10px; }
  .dh { color: #0f766e; font-weight: 700; } .dt { font-weight: 600; margin: 2px 0; }
  .day ul { margin: 2px 0 0; padding-left: 14px; color: #475569; }
  .box { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; margin-top: 12px; }
  .box.g { background: #f0fdf4; border-color: #bbf7d0; } .box.r { background: #fff1f2; border-color: #fecdd3; } .box.s { background: #f8fafc; }
  .box h3 { margin: 0 0 6px; font-size: 12px; } .box ul { margin: 0; padding-left: 16px; color: #475569; }
  .note { margin-top: 12px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 8px; padding: 8px 12px; text-align: center; font-size: 10px; color: #64748b; }
  .pay { border: 1px solid #99f6e4; background: #f0fdfa; border-radius: 10px; padding: 14px; margin-top: 14px; }
  .pay .kv { font-size: 12px; margin: 2px 0; }
</style></head>
<body>
<!-- PAGE 1 -->
<div class="page pb">
  <div class="head">
    <div class="brand"><div class="logo">🌴</div><div><div class="bn">${esc(company.name)}</div><div class="small">Trip CRM</div></div></div>
    <div style="text-align:center" class="small"><b style="color:#1f2d2b">Address:</b><br/>${company.address.map(esc).join('<br/>')}</div>
    <div style="text-align:right" class="small"><b style="color:#1f2d2b">Contact:</b><br/>${company.emails.map(esc).join('<br/>')}<br/>${company.phones.map(esc).join('<br/>')}</div>
  </div>

  <div class="panels">
    <div class="panel"><div class="ph">Quotation for:</div><div class="pc">
      <div style="font-weight:700">${esc([guest.salutation, guest.name].filter(Boolean).join(' ') || 'Guest')} &nbsp;|&nbsp; M${esc(pad4(q.query?.queryNumber))}</div>
      ${guest.phones?.[0] ? `<div class="small">+${esc(guest.phones[0].countryCode)} ${esc(guest.phones[0].number)}</div>` : ''}
      <div style="margin-top:4px">Adults: ${paxAdults}, Children: ${paxChildren} &nbsp;<span class="tag">${esc(pkg.name || 'Package')}</span></div>
    </div></div>
    <div class="panel"><div class="ph">${q.nights}N${(q.nights || 0) + 1}D ${esc(pkg.name || 'Package')} to Andaman:</div><div class="pc" style="text-align:right">
      <div class="small">Travel Dates:</div><div style="font-weight:700">${fmtDate(start)}</div><div style="font-weight:700">${end ? fmtDate(end) : ''}</div>
    </div></div>
  </div>

  <h2>Cruise and Hotel Information:</h2>
  ${transferRows ? `<table><thead><tr><th>Sector / Transfer</th><th>Service</th><th>Start Time</th></tr></thead><tbody>${transferRows}</tbody></table>` : ''}
  <table><thead><tr><th>Hotel Name</th><th>Type of Room</th><th>Place</th><th>#Rooms</th><th>#Nights</th><th>Extra Mattress</th><th>W/O Mattress</th><th>Meal Plan</th></tr></thead><tbody>${hotelRows}</tbody></table>

  <h2>Transparent Breakage of all Costs:</h2>
  <table><thead><tr><th>Hotel Cost</th><th>Tour Cost</th><th>Permits &amp; Boat</th><th>Ferry Cost</th><th>Misc Cost</th></tr></thead>
  <tbody><tr><td class="c b">${inr(cats.hotel)}</td><td class="c b">${inr(cats.tour)}</td><td class="c b">${inr(cats.permits)}</td><td class="c b">${inr(cats.ferry)}</td><td class="c b">${inr(cats.misc)}</td></tr></tbody></table>

  <table class="summary"><thead><tr><th>Package Cost</th><th>Discount</th><th>Total</th><th>Service Charge</th><th>Taxable</th><th>GST</th><th>Total Tax</th><th>Final Payable</th></tr></thead>
  <tbody><tr><td class="c">${inr(p.subtotal)}</td><td class="c">—</td><td class="c">${inr(p.subtotal)}</td><td class="c">${servicePct}%</td><td class="c">${inr(taxable)}</td><td class="c">${gstPct}%</td><td class="c">${inr(p.tax, 2)}</td><td class="c final">${inr(p.total, 2)}</td></tr></tbody></table>

  <div class="breakage">
    <div class="cb"><div class="l">COST<br/>BREAKAGE</div><div class="r"><div class="row"><span>Pax:</span><b>${pax}</b></div><div class="row"><span>Per Person:</span><b>${inr(perPerson)}</b></div></div></div>
    <div class="advance"><span style="padding:0 14px;font-weight:700">Payable to Confirm Booking (${company.advancePercent}%):</span><span class="amt">${inr(advance)}</span></div>
  </div>
  <div class="note">Costing here is for your reference; the GST invoice will be provided after tour completion. ${esc(company.bookingTerms)}</div>
</div>

<!-- PAGE 2 -->
<div class="page pb">
  <div class="band">${q.nights}N${(q.nights || 0) + 1}D Day Wise Itinerary:</div>
  <div class="days">${dayCards}</div>
</div>

<!-- PAGE 3 -->
<div class="page">
  <div class="band">Additional Information:</div>
  <div class="box s"><h3>NOTE:</h3><ul>${li(company.notes)}</ul></div>
  <div class="box g"><h3>INCLUSIONS:</h3><ul>${li(inclusions)}</ul></div>
  <div class="box r"><h3>EXCLUSIONS:</h3><ul>${li(exclusions)}</ul></div>
  <div class="pay"><h3 style="margin:0 0 8px">Payment Information</h3>
    <div class="kv"><b>Holder Name:</b> ${esc(company.bank.holder)}</div>
    <div class="kv"><b>Bank:</b> ${esc(company.bank.bank)}</div>
    <div class="kv"><b>Address:</b> ${esc(company.bank.address)}</div>
    <div class="kv"><b>Acc. No.:</b> ${esc(company.bank.accNo)}</div>
    <div class="kv"><b>IFSC Code:</b> ${esc(company.bank.ifsc)}</div>
    <div class="kv"><b>Payment Link:</b> ${esc(company.bank.paymentLink)}</div>
  </div>
  <div style="margin-top:16px;text-align:center;color:#0f766e;font-weight:700">${esc(company.tagline)}</div>
</div>
</body></html>`;
}
