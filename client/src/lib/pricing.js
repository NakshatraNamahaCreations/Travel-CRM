// Mirrors the server's Quote pricing rollup so the builder summary updates live.
export function computePricing({ costItems = [], markupType = 'percent', markupValue = 0, taxPercent = 0 }) {
  const round = (n) => Math.round(n * 100) / 100;
  let subtotal = 0;
  const lines = costItems.map((it) => {
    const amount = round((Number(it.qty) || 0) * (Number(it.rate) || 0));
    subtotal += amount;
    return { ...it, amount };
  });
  const markup =
    markupType === 'flat' ? Number(markupValue) || 0 : round((subtotal * (Number(markupValue) || 0)) / 100);
  const taxable = subtotal + markup;
  const tax = round((taxable * (Number(taxPercent) || 0)) / 100);
  return { lines, subtotal: round(subtotal), markup, tax, total: round(taxable + tax) };
}

export const money = (n, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n || 0);

const r2 = (n, to = 1) => Math.round((Math.round(n / to) * to) * 100) / 100;

// Per-night = room price × no.of rooms + extra-bed prices × their counts.
export function hotelPerNight(h) {
  return (
    (Number(h.ratePerNight) || 0) * (Number(h.rooms) || 0) +
    (Number(h.awebRate) || 0) * (Number(h.aweb) || 0) +
    (Number(h.cwebRate) || 0) * (Number(h.cweb) || 0) +
    (Number(h.cnbRate) || 0) * (Number(h.cnb) || 0)
  );
}
export function hotelRowCost(h) {
  const nights = Math.max(1, (h.nights || []).length || 1);
  return r2(hotelPerNight(h) * nights);
}

// Mirror of the server's per-package rollup (model: computePackage).
export function computePackage(pkg) {
  let cost = 0;
  (pkg.hotels || []).forEach((h) => { cost += hotelRowCost(h); });
  (pkg.inclusions || []).forEach((i) => { cost += Number(i.price) || 0; });
  (pkg.transports || []).forEach((t) => (t.items || []).forEach((it) => { cost += (Number(it.qty) || 0) * (Number(it.rate) || 0); }));
  (pkg.activities || []).forEach((a) => (a.items || []).forEach((it) => { cost += (Number(it.qty) || 0) * (Number(it.rate) || 0); }));
  (pkg.extras || []).forEach((e) => { cost += Number(e.price) || 0; });
  (pkg.flights || []).forEach((f) => { cost += Number(f.cost) || 0; });
  cost = r2(cost);
  const markup = pkg.markupType === 'flat' ? Number(pkg.markupValue) || 0 : r2((cost * (Number(pkg.markupValue) || 0)) / 100);
  const taxBase = pkg.taxOn === 'markup' ? markup : cost + markup;
  const tax = pkg.taxApplied ? r2((taxBase * (Number(pkg.taxPercent) || 0)) / 100) : 0;
  return { costPrice: cost, markupAmount: markup, taxAmount: tax, sellingPrice: r2(cost + markup + tax, Number(pkg.rounding) || 1) };
}

// Misconfiguration warnings shown in the summary (informational).
export function packageWarnings(pkg, paxAdults) {
  const w = [];
  (pkg.hotels || []).forEach((h) => {
    const cap = (Number(h.paxPerRoom) || 0) * (Number(h.rooms) || 0) + (Number(h.aweb) || 0) + (Number(h.cweb) || 0);
    if (paxAdults && cap && cap !== Number(paxAdults)) w.push(`${h.hotelName || 'Hotel'}: capacity ${cap} ≠ ${paxAdults} pax`);
    if (!h.ratePerNight) w.push(`Missing rate for ${h.hotelName || 'a hotel'}`);
  });
  const transTotal = (pkg.transports || []).reduce((s, t) => s + (t.items || []).reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0), 0);
  if ((pkg.transports || []).length && transTotal === 0) w.push('Total transport price is ZERO');
  return w;
}
