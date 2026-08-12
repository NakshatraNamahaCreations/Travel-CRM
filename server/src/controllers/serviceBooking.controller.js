import { ServiceBooking, SERVICE_BOOKING_STATUSES } from '../models/ServiceBooking.js';
import { Quote } from '../models/Quote.js';
import { Query } from '../models/Query.js';
import { Hotel } from '../models/Hotel.js';
import { OrgProfile } from '../models/OrgProfile.js';
import { voucherHtml } from '../pdf/voucherHtml.js';
import { htmlToPdf } from '../pdf/renderPdf.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/apiResponse.js';

const pkgOf = (quote) => quote?.packages?.[quote.selectedPackageIndex || 0] || quote?.packages?.[0] || null;
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };

// GET /api/service-bookings?query=<id>&kind=hotel
export const listServiceBookings = asyncHandler(async (req, res) => {
  const { query, kind } = req.query;
  if (!query) throw ApiError.badRequest('query id is required');
  const filter = { query };
  if (kind) filter.kind = kind;
  const items = await ServiceBooking.find(filter).populate('bookedBy', 'name').sort({ kind: 1, order: 1, createdAt: 1 });
  return ok(res, items);
});

// Build the booking rows for one kind from the quote package.
function rowsFromQuote(pkg, startDate) {
  // Alternative hotel options are quote-time choices — never booked as-is.
  const hotels = (pkg.hotels || []).filter((h) => !h.isAlternative).map((h, i) => {
    const ns = (h.nights || []).slice().sort((a, b) => a - b);
    const count = Math.max(1, ns.length);
    const checkIn = startDate ? addDays(startDate, (ns[0] || 1) - 1) : null;
    const checkOut = checkIn ? addDays(checkIn, count) : null;
    const bits = [h.mealPlan, `${h.rooms || 1} ${h.roomType || 'Room'}`];
    if (h.aweb) bits.push(`${h.aweb} AWEB`);
    if (h.cweb) bits.push(`${h.cweb} CWEB`);
    const perNight = Math.round((h.amount || 0) / count);
    const nightRates = Array.from({ length: count }, (_, n) => ({
      date: checkIn ? addDays(checkIn, n) : null,
      given: perNight,
      booked: perNight,
    }));
    return {
      kind: 'hotel', name: h.hotelName, city: h.city, stars: h.stars, hotelRef: h.hotel || null,
      roomType: h.roomType, mealPlan: h.mealPlan, rooms: h.rooms, paxPerRoom: h.paxPerRoom,
      aweb: h.aweb, cweb: h.cweb, cnb: h.cnb,
      nights: ns, checkIn, checkOut, nightRates, detail: bits.filter(Boolean).join(' • '),
      price: h.amount || 0, order: i,
    };
  });

  const operational = (pkg.transports || []).map((t, i) => {
    const price = (t.items || []).reduce((s, it) => s + (it.amount || (it.qty || 0) * (it.rate || 0)), 0);
    const detail = (t.items || []).map((it) => `${it.qty || 1}× ${it.type || 'Service'}`).join(', ');
    const dayNo = (Array.isArray(t.days) && t.days[0]) || t.day || i + 1;
    const checkIn = startDate ? addDays(startDate, dayNo - 1) : null;
    return {
      kind: 'operational', name: t.serviceLocation || t.serviceType || `Day ${dayNo} Service`,
      detail: [t.serviceType, detail].filter(Boolean).join(' — '), day: dayNo, checkIn, price, order: i,
    };
  });

  const flights = (pkg.flights || []).map((f, i) => ({
    kind: 'flight', name: f.label || `Flight ${i + 1}`, price: f.cost || 0, order: i,
  }));

  return { hotel: hotels, operational, flight: flights };
}

// Shared helper — called from createFromQuote and the manual generate endpoint.
export async function autoGenerateServiceBookings(queryId, quoteId, userId, kinds = ['hotel', 'operational', 'flight']) {
  const [quote, query] = await Promise.all([Quote.findById(quoteId), Query.findById(queryId)]);
  if (!quote) return [];
  const pkg = pkgOf(quote);
  if (!pkg) return [];

  const startDate = query?.startDate;
  const byKind = rowsFromQuote(pkg, startDate);

  const createdRows = [];
  for (const k of kinds) {
    const exists = await ServiceBooking.countDocuments({ query: queryId, kind: k });
    if (exists) continue;
    const rows = (byKind[k] || []).map((r) => ({ ...r, query: queryId, quote: quoteId, bookedBy: userId || null }));
    if (rows.length) createdRows.push(...(await ServiceBooking.insertMany(rows)));
  }
  return createdRows;
}

// POST /api/service-bookings/generate  { query, quote, kind? }
// Creates booking lines from the accepted quote for kinds that have none yet.
export const generateServiceBookings = asyncHandler(async (req, res) => {
  const { query: queryId, quote: quoteId, kind } = req.body;
  if (!queryId || !quoteId) throw ApiError.badRequest('query and quote are required');

  const kinds = kind ? [kind] : ['hotel', 'operational', 'flight'];
  const createdRows = await autoGenerateServiceBookings(queryId, quoteId, req.user?._id, kinds);
  if (!createdRows.length && !kind) throw ApiError.badRequest('Quote has no package to generate from');
  return created(res, createdRows);
});

// PATCH /api/service-bookings/:id  — status / price / tag / comment / detail / nightRates / occupancy
export const updateServiceBooking = asyncHandler(async (req, res) => {
  const patch = {};
  const fields = [
    'status', 'price', 'tag', 'comment', 'detail', 'name', 'roomType', 'mealPlan', 'rooms',
    'paxPerRoom', 'aweb', 'cweb', 'cnb', 'nightRates', 'flagged',
  ];
  for (const f of fields) {
    if (req.body[f] !== undefined) patch[f] = req.body[f];
  }
  if (patch.status && !SERVICE_BOOKING_STATUSES.includes(patch.status)) {
    throw ApiError.badRequest('Invalid status');
  }
  // The Prices panel edits nights directly — keep price/checkIn/checkOut/nights in sync.
  if (Array.isArray(patch.nightRates)) {
    const dates = patch.nightRates.map((n) => n.date).filter(Boolean).sort();
    patch.price = patch.nightRates.reduce((s, n) => s + (Number(n.booked) || 0), 0);
    patch.nights = patch.nightRates.map((_, i) => i + 1);
    if (dates.length) {
      patch.checkIn = dates[0];
      patch.checkOut = addDays(new Date(dates[dates.length - 1]), 1);
    }
  }
  const item = await ServiceBooking.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true })
    .populate('bookedBy', 'name');
  if (!item) throw ApiError.notFound('Service booking not found');
  return ok(res, item);
});

// DELETE /api/service-bookings/:id
export const deleteServiceBooking = asyncHandler(async (req, res) => {
  const item = await ServiceBooking.findByIdAndDelete(req.params.id);
  if (!item) throw ApiError.notFound('Service booking not found');
  return ok(res, { id: req.params.id });
});

// POST /api/service-bookings/:id/voucher?format=html|pdf
// Saves the confirmation number / contact / notes on the stay, then builds a
// single-hotel confirmation voucher (Bookings > Hotel Check-Ins "Generate").
export const generateHotelVoucher = asyncHandler(async (req, res) => {
  const { confirmationNumber, voucherContact, voucherNotes, prices, removeBranding } = req.body || {};
  const row = await ServiceBooking.findByIdAndUpdate(
    req.params.id,
    { confirmationNumber, voucherContact, voucherNotes, voucherGeneratedAt: new Date() },
    { new: true, runValidators: true }
  ).populate({ path: 'query', select: 'queryNumber guest pax destinations' });
  if (!row) throw ApiError.notFound('Service booking not found');
  if (row.kind !== 'hotel') throw ApiError.badRequest('Vouchers are only available for hotel bookings');

  const [org, hotel] = await Promise.all([
    OrgProfile.getFor(req.organizationId).catch(() => null),
    row.hotelRef ? Hotel.findById(row.hotelRef).select('address checkIn checkOut') : null,
  ]);

  const count = Math.max(1, row.nightRates?.length || row.nights?.length || 1);
  const syntheticQuote = {
    query: row.query || {},
    nights: count,
    startDate: row.checkIn,
    packages: [{
      hotels: [{
        nights: Array.from({ length: count }, (_, i) => i + 1),
        hotelName: row.name, city: row.city, roomType: row.roomType, mealPlan: row.mealPlan,
        rooms: row.rooms, aweb: row.aweb, cweb: row.cweb, cnb: row.cnb, amount: row.price, isAlternative: false,
      }],
    }],
  };

  const html = voucherHtml(syntheticQuote, {
    org: org?.toObject?.() || org,
    type: 'hotels',
    options: {
      prices: !!prices, removeBranding: !!removeBranding,
      confirmationNumber: confirmationNumber || '', voucherContact: voucherContact || '', voucherNotes: voucherNotes || '',
      hotelAddress: hotel?.address || '', hotelCheckInTime: hotel?.checkIn || '', hotelCheckOutTime: hotel?.checkOut || '',
    },
  });

  if (req.query.format === 'html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }
  const pdf = await htmlToPdf(html);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="HOTEL-VOUCHER-${row.query?.queryNumber || row._id}-${(row.name || 'hotel').replace(/[^a-z0-9]+/gi, '-')}.pdf"`);
  return res.send(pdf);
});

// GET /api/service-bookings/:id/hotel-info — hotel master address/check-in
// policy for the "verify hotel details" panel in the Generate Voucher modal.
export const getHotelVoucherInfo = asyncHandler(async (req, res) => {
  const row = await ServiceBooking.findById(req.params.id).select('hotelRef name city');
  if (!row) throw ApiError.notFound('Service booking not found');
  const hotel = row.hotelRef ? await Hotel.findById(row.hotelRef).select('address checkIn checkOut') : null;
  return ok(res, { hotelId: row.hotelRef || null, address: hotel?.address || row.city || '', checkIn: hotel?.checkIn || '', checkOut: hotel?.checkOut || '' });
});
