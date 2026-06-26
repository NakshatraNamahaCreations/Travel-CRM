// Builds the WhatsApp message + Email HTML for the "Share Package" feature
// from a fully-populated quote (packages, hotels, transports, inclusions, days).
import { format, addDays } from 'date-fns';
import { company } from '../config/company.js';
import { tripNo } from './format.js';

const inr = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const MEAL_LABEL = {
  CP: 'Breakfast', EP: 'Room Only', 'Room only': 'Room Only',
  MAP: 'Breakfast & Dinner', 'CP MAP': 'Breakfast & Dinner', AP: 'All Meals',
};
const mealLabel = (m) => MEAL_LABEL[m] || m || '';
const starLabel = (h) => (h?.stars ? `(${h.stars} Star)` : '');
const roomPax = (h) => Number(h?.paxPerRoom) || 2;
const firstNightOf = (h) => (h?.nights?.length ? Math.min(...h.nights) : 1);

function nightDates(start, hotel) {
  const firstNight = firstNightOf(hotel);
  const count = Math.max(1, (hotel.nights || []).length || 1);
  const checkIn = start ? addDays(start, firstNight - 1) : null;
  const checkOut = checkIn ? addDays(checkIn, count) : null;
  return { firstNight, count, checkIn, checkOut };
}

// Hotels in OTHER packages that cover the same starting night (Sembark "Similar Options").
function similarHotels(packages, currentIndex, firstNight) {
  const out = [];
  packages.forEach((p, j) => {
    if (j === currentIndex) return;
    (p.hotels || []).forEach((h) => { if (firstNightOf(h) === firstNight) out.push(h); });
  });
  return out;
}

const bookingLink = (q, i) => `${company.paymentBaseUrl}/${q.quoteNumber || q.query?.queryNumber || ''}${i + 1}`;
const firstInstalment = (pkg) => Math.round(((pkg.sellingPrice || 0) * company.firstInstalmentPercent) / 100);

function basics(q) {
  const guest = q.query?.guest || {};
  const start = q.startDate ? new Date(q.startDate) : null;
  const nights = q.nights || 0;
  return {
    guest,
    guestName: [guest.salutation, guest.name].filter(Boolean).join(' ') || 'Traveller',
    start,
    nights,
    days: nights + 1,
    adults: q.pax?.adults || 0,
    children: q.pax?.children?.length || 0,
    dest: (q.query?.destinations || []).map((d) => d.name).join(', ') || 'Andaman and Nicobar Islands',
    packages: q.packages || [],
    cur: q.currency || 'INR',
  };
}

/* ----------------------------- WhatsApp ----------------------------- */

export function buildWhatsAppText(q, { hideTotalPrice = false, includeItinerary = false } = {}) {
  const b = basics(q);
  const L = [];

  L.push(`Hi ${b.guestName},`, '');
  L.push(`Greetings from ${company.shortName}.`, '');
  L.push('Thank you for your query with us. As per your requirements, following are the package details:', '');
  L.push(`*Trip ID ${tripNo(q.query?.queryNumber)}* (${b.packages.length} Package ${b.packages.length === 1 ? 'Category/Option' : 'Categories/Options'})`, '');
  L.push(`*${b.dest} Trip*`);
  L.push(`• ${b.start ? format(b.start, 'd MMM, yyyy') : 'Flexible'} for ${b.nights} Night${b.nights === 1 ? '' : 's'}, ${b.days} Day${b.days === 1 ? '' : 's'}`);
  L.push(`• ${b.adults} Adult${b.adults === 1 ? '' : 's'}${b.children ? `, ${b.children} Child${b.children === 1 ? '' : 'ren'}` : ''}`, '');

  b.packages.forEach((pkg, i) => {
    L.push(`*OPTION ${i + 1}: ${pkg.name || `Package ${i + 1}`}*`);
    if (!hideTotalPrice) {
      L.push(`Total Price (${b.cur}): *${inr(pkg.sellingPrice)} /-* ${pkg.taxApplied ? `(inc. ${pkg.taxName || 'GST'})` : '(exc. GST)'}`);
    }
    L.push(`👉 Book Now: ${bookingLink(q, i)}`);
    L.push(`Pay Just ${b.cur} ${inr(firstInstalment(pkg))} as First instalment`);
    L.push('_Multiple Payments Options (UPI, DC, CC, NB etc.)_', '');

    L.push('🏨 *Hotels*');
    [...(pkg.hotels || [])].sort((a, z) => firstNightOf(a) - firstNightOf(z)).forEach((h) => {
      const { firstNight, checkIn, checkOut } = nightDates(b.start, h);
      L.push(`*${ordinal(firstNight)} Night* at ${h.city || ''}`.trim());
      if (checkIn && checkOut) L.push(`Check in: ${format(checkIn, 'd MMM')} & Check out: ${format(checkOut, 'd MMM')}`);
      L.push(`*${h.hotelName || 'Hotel'}* ${starLabel(h)}`.trim());
      L.push(`${mealLabel(h.mealPlan)} • ${h.rooms || 1} ${h.roomType || 'Room'} (${roomPax(h)} Pax)`);
      const sims = similarHotels(b.packages, i, firstNight);
      if (sims.length) {
        L.push('_Similar Options:_');
        sims.forEach((s) => {
          L.push(`- *${s.hotelName || 'Hotel'}* ${starLabel(s)}`.trim());
          L.push(`• ${s.city || ''}`);
          L.push(`• ${s.rooms || 1} ${s.roomType || 'Room'} (${roomPax(s)} Pax)`);
        });
      }
      L.push('');
    });

    const incs = pkg.inclusions || [];
    if (incs.length) {
      L.push('*Hotel Special Inclusions*');
      incs.forEach((inc) => L.push(`${inc.night ? `${ordinal(inc.night)} Night • ` : ''}*${inc.service || 'Inclusion'}*${inc.hotelName ? ` (${inc.hotelName})` : ''}`));
      L.push('');
    }
  });

  const sel = b.packages[q.selectedPackageIndex || 0] || b.packages[0] || {};
  const transports = sel.transports || [];
  if (transports.length) {
    L.push('📌 *For All Options*');
    L.push('Details below are applicable for all the options.', '');
    L.push('🚌 *Transportation*');
    transports.forEach((t) => {
      const day = t.day || 1;
      const dayDate = b.start ? addDays(b.start, day - 1) : null;
      L.push(`*${ordinal(day)} Day*${dayDate ? ` - ${format(dayDate, "EEE, do MMM ''yy")}` : ''}`);
      const veh = (t.items || []).map((it) => `${it.qty || 1}-${it.type || ''}`.trim()).filter((x) => x !== '1-').join(', ');
      L.push(`• ${[t.serviceLocation, t.serviceType].filter(Boolean).join(' - ')}${veh ? ` (${veh})` : ''}`);
      if (t.startTime) L.push(`Start: ${t.startTime} hrs`);
      L.push('');
    });
  }

  if (includeItinerary && (q.days || []).length) {
    L.push('🗓️ *Day Wise Itinerary*');
    q.days.forEach((d) => {
      L.push(`*Day ${d.dayNumber}: ${d.title || ''}*`);
      if (d.description) String(d.description).split(/\n|·/).map((s) => s.trim()).filter(Boolean).forEach((line) => L.push(`- ${line}`));
    });
    L.push('');
  }

  L.push(`Looking forward to hosting you! — ${company.name}`);
  L.push(`${company.phones[0]} · ${company.website}`);
  return L.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Render the WhatsApp markdown text as light HTML for the on-screen preview bubble.
export function whatsappToHtml(text) {
  return esc(text)
    .replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
    .replace(/_([^_\n]+)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

/* ------------------------------- Email ------------------------------ */

const band = (txt) => `<tr><td colspan="5" style="background:#dbeafe;color:#1e3a8a;font-weight:700;text-align:center;padding:8px 10px;font-size:13px;border-radius:4px">${esc(txt)}</td></tr>`;
const th = (txt) => `<th style="background:#eff6ff;color:#1e40af;border:1px solid #dbeafe;padding:6px 8px;font-size:11px;text-align:left">${esc(txt)}</th>`;
const td = (html, extra = '') => `<td style="border:1px solid #e5e7eb;padding:6px 8px;font-size:12px;${extra}">${html}</td>`;

export function buildEmailHtml(q, { removeItinerary = false, removeTerms = false, removeTransports = false } = {}) {
  const b = basics(q);
  const out = [];

  out.push(`<div style="font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:680px;font-size:13px;line-height:1.5">`);
  out.push(`<p>Hello <b>${esc(b.guestName)}</b>,</p>`);
  out.push(`<p>Thank you for considering <b>${esc(company.name)}</b> (GSTIN - ${esc(company.gstin)}) for tourism. We ensure every detail is handled to guarantee a seamless and stress-free travel experience.</p>`);
  out.push(`<p>When booking with ${esc(company.name)}, know that we specialize in tourism, which will get your heart racing and leave you with unforgettable memories. Our travel advisors have created an itinerary that caters to your exciting desires, from the <b>Beautiful Islands to the Beaches of ${esc(b.dest)}</b>.</p>`);

  // Package Overview
  out.push('<table style="width:100%;border-collapse:collapse;margin:14px 0">');
  out.push(`<tr><td colspan="2" style="background:#bfdbfe;color:#1e3a8a;font-weight:700;text-align:center;padding:8px">Package Overview</td></tr>`);
  const ov = [
    ['Trip ID', tripNo(q.query?.queryNumber)],
    ['Destination', `${esc(b.dest)}${nightBadge(b)}`],
    ['Start Date', b.start ? format(b.start, 'd MMMM, yyyy') : 'Flexible'],
    ['Trip Duration', `${b.nights} Night${b.nights === 1 ? '' : 's'} / ${b.days} Day${b.days === 1 ? '' : 's'}`],
    ['Pax', `${b.adults} Adult${b.adults === 1 ? '' : 's'}${b.children ? `, ${b.children} Child${b.children === 1 ? '' : 'ren'}` : ''}`],
  ];
  ov.forEach(([k, v]) => out.push(`<tr>${td(`<b>${esc(k)}</b>`, 'width:140px;background:#f8fafc')}${td(v)}</tr>`));
  out.push('</table>');

  // Hotels per option
  out.push('<table style="width:100%;border-collapse:collapse;margin:6px 0">' + band('Hotels') + '</table>');
  b.packages.forEach((pkg, i) => {
    out.push('<table style="width:100%;border-collapse:collapse;margin:10px 0">');
    out.push(`<tr><td colspan="5" style="background:#1e293b;color:#fff;font-weight:700;padding:7px 10px;border-radius:4px">Option ${i + 1}: ${esc(pkg.name || `Package ${i + 1}`)}</td></tr>`);
    out.push(`<tr>${th('Nights')}${th('City')}${th('Hotel Name')}${th('Meal Plan')}${th('Accommodation')}</tr>`);
    [...(pkg.hotels || [])].sort((a, z) => firstNightOf(a) - firstNightOf(z)).forEach((h) => {
      const { firstNight, checkIn } = nightDates(b.start, h);
      const nlabel = `${ordinal(firstNight)} ${checkIn ? `(${format(checkIn, 'd MMM')})` : 'Night'}`;
      out.push('<tr>'
        + td(esc(nlabel))
        + td(`<b>${esc(h.city || '')}</b>`)
        + td(`<b>${esc(h.hotelName || 'Hotel')}</b>${h.stars ? `<br/><span style="color:#6b7280;font-size:11px">${h.stars} Star</span>` : ''}`)
        + td(`${esc(mealLabel(h.mealPlan))}${h.mealPlan && mealLabel(h.mealPlan) !== h.mealPlan ? `<br/><span style="color:#6b7280;font-size:11px">(${esc(h.mealPlan)})</span>` : ''}`)
        + td(`<b>${h.rooms || 1} ${esc(h.roomType || 'Room')}</b><br/><span style="color:#6b7280;font-size:11px">${roomPax(h)} Pax</span>`)
        + '</tr>');
    });
    const incs = pkg.inclusions || [];
    if (incs.length) {
      out.push(`<tr><td colspan="5" style="background:#fef9c3;color:#854d0e;font-weight:700;padding:6px 8px;font-size:12px">Hotel Special Inclusions</td></tr>`);
      incs.forEach((inc) => out.push('<tr>'
        + td(esc(inc.night ? `${ordinal(inc.night)} (${b.start ? format(addDays(b.start, inc.night - 1), 'd MMM') : ''})` : '—'))
        + td(`<b>${esc(inc.service || 'Inclusion')}</b>`, '', '')
        + `<td colspan="3" style="border:1px solid #e5e7eb;padding:6px 8px;font-size:12px">${esc(inc.hotelName || '')}${inc.comments ? ` — ${esc(inc.comments)}` : ''}</td>`
        + '</tr>'));
    }
    out.push('</table>');
    // Prices + Book Now
    out.push('<table style="width:100%;border-collapse:collapse;margin:4px 0 16px">');
    out.push(`<tr><td style="background:#fef9c3;color:#854d0e;font-weight:700;padding:7px 10px">Prices (${b.cur})</td></tr>`);
    out.push(`<tr><td style="padding:6px 10px;font-size:13px"><b>Total: ${inr(pkg.sellingPrice)} /-</b> ${pkg.taxApplied ? `(including ${esc(pkg.taxName || 'GST')})` : '(excluding GST)'}</td></tr>`);
    out.push(`<tr><td style="padding:8px 10px"><a href="${bookingLink(q, i)}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;font-weight:700;padding:8px 14px;border-radius:6px;font-size:12px">Book Now ▸ Pay Just ${inr(firstInstalment(pkg))} as First Instalment</a><div style="color:#6b7280;font-size:11px;margin-top:4px">Multiple Payments Options (UPI, DC, CC, NB etc.)</div></td></tr>`);
    out.push('</table>');
  });

  // Day-wise itinerary
  if (!removeItinerary && (q.days || []).length) {
    out.push('<table style="width:100%;border-collapse:collapse;margin:6px 0">' + band(`${b.nights}N${b.days}D Day Wise Itinerary`) + '</table>');
    out.push('<div style="margin:0 0 16px">');
    q.days.forEach((d) => {
      const dayDate = b.start ? addDays(b.start, (d.dayNumber || 1) - 1) : null;
      out.push(`<div style="margin:8px 0"><div style="color:#1e40af;font-weight:700;font-size:12px">Day ${d.dayNumber}${dayDate ? ` (${format(dayDate, 'EEE d MMM')})` : ''} : ${esc(d.title || '')}</div>`);
      if (d.description) out.push(`<div style="color:#374151;font-size:12px;margin-top:2px">${esc(d.description)}</div>`);
      out.push('</div>');
    });
    out.push('</div>');
  }

  // Transportation (for all options)
  const sel = b.packages[q.selectedPackageIndex || 0] || b.packages[0] || {};
  if (!removeTransports && (sel.transports || []).length) {
    out.push('<table style="width:100%;border-collapse:collapse;margin:6px 0">');
    out.push(`<tr><td colspan="5" style="background:#dbeafe;color:#1e3a8a;font-weight:700;text-align:center;padding:8px">Transportation (for all options)</td></tr>`);
    const vehUsed = [...new Set((sel.transports || []).flatMap((t) => (t.items || []).map((it) => `${it.qty || 1}-${it.type || ''}`.trim())).filter((x) => x && x !== '1-'))].join(', ');
    if (vehUsed) out.push(`<tr><td colspan="5" style="border:1px solid #e5e7eb;padding:6px 8px;font-size:12px"><b>Transportation Used:</b> ${esc(vehUsed)}</td></tr>`);
    out.push(`<tr>${th('Day')}<th colspan="4" style="background:#eff6ff;color:#1e40af;border:1px solid #dbeafe;padding:6px 8px;font-size:11px;text-align:left">Service</th></tr>`);
    (sel.transports || []).forEach((t) => {
      const day = t.day || 1;
      const dayDate = b.start ? addDays(b.start, day - 1) : null;
      out.push('<tr>'
        + td(`${ordinal(day)} Day${dayDate ? `<br/><span style="color:#6b7280;font-size:11px">${format(dayDate, 'EEE, d MMM')}</span>` : ''}`)
        + `<td colspan="4" style="border:1px solid #e5e7eb;padding:6px 8px;font-size:12px">${esc([t.serviceLocation, t.serviceType].filter(Boolean).join(' - '))}${t.startTime ? ` <span style="color:#6b7280">· Start ${esc(t.startTime)} hrs</span>` : ''}</td>`
        + '</tr>');
    });
    out.push('</table>');
  }

  if (!removeTerms) {
    out.push(`<div style="margin-top:14px;border-top:1px solid #e5e7eb;padding-top:10px;color:#6b7280;font-size:11px">`);
    out.push(`<b>Terms:</b> ${esc(company.bookingTerms)} Packages, hotels &amp; cruises are subject to availability.`);
    out.push(`<br/>${esc(company.name)} · ${esc(company.phones[0])} · ${esc(company.emails[0])} · ${esc(company.website)}`);
    out.push('</div>');
  }

  out.push('</div>');
  return out.join('');
}

function nightBadge(b) {
  const first = b.packages?.[0]?.hotels?.[0];
  if (!first) return '';
  const n = Math.max(1, (first.nights || []).length || 1);
  return `<br/><span style="display:inline-block;background:#fef08a;color:#854d0e;font-size:11px;padding:1px 6px;border-radius:3px;margin-top:3px">${esc(first.city || '')} ${n} Night${n === 1 ? '' : 's'}</span>`;
}

// Wrap email HTML body as a downloadable Word document.
export function emailHtmlToWordDoc(bodyHtml) {
  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Package</title></head><body>${bodyHtml}</body></html>`;
}
