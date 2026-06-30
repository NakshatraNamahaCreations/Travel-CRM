import { ServiceBooking, SERVICE_BOOKING_STATUSES } from '../models/ServiceBooking.js';
import { Quote } from '../models/Quote.js';
import { Query } from '../models/Query.js';
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
  const hotels = (pkg.hotels || []).map((h, i) => {
    const ns = (h.nights || []).slice().sort((a, b) => a - b);
    const count = Math.max(1, ns.length);
    const checkIn = startDate ? addDays(startDate, (ns[0] || 1) - 1) : null;
    const checkOut = checkIn ? addDays(checkIn, count) : null;
    const bits = [h.mealPlan, `${h.rooms || 1} ${h.roomType || 'Room'}`];
    if (h.aweb) bits.push(`${h.aweb} AWEB`);
    if (h.cweb) bits.push(`${h.cweb} CWEB`);
    return {
      kind: 'hotel', name: h.hotelName, city: h.city, stars: h.stars,
      roomType: h.roomType, mealPlan: h.mealPlan, rooms: h.rooms, aweb: h.aweb, cweb: h.cweb,
      nights: ns, checkIn, checkOut, detail: bits.filter(Boolean).join(' • '),
      price: h.amount || 0, order: i,
    };
  });

  const operational = (pkg.transports || []).map((t, i) => {
    const price = (t.items || []).reduce((s, it) => s + (it.amount || (it.qty || 0) * (it.rate || 0)), 0);
    const detail = (t.items || []).map((it) => `${it.qty || 1}× ${it.type || 'Service'}`).join(', ');
    const checkIn = startDate ? addDays(startDate, (t.day || i + 1) - 1) : null;
    return {
      kind: 'operational', name: t.serviceLocation || t.serviceType || `Day ${t.day || i + 1} Service`,
      detail: [t.serviceType, detail].filter(Boolean).join(' — '), checkIn, price, order: i,
    };
  });

  return { hotel: hotels, operational };
}

// Shared helper — called from createFromQuote and the manual generate endpoint.
export async function autoGenerateServiceBookings(queryId, quoteId, userId, kinds = ['hotel', 'operational']) {
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

  const kinds = kind ? [kind] : ['hotel', 'operational'];
  const createdRows = await autoGenerateServiceBookings(queryId, quoteId, req.user?._id, kinds);
  if (!createdRows.length && !kind) throw ApiError.badRequest('Quote has no package to generate from');
  return created(res, createdRows);
});

// PATCH /api/service-bookings/:id  — status / price / tag / comment / detail
export const updateServiceBooking = asyncHandler(async (req, res) => {
  const patch = {};
  for (const f of ['status', 'price', 'tag', 'comment', 'detail', 'name', 'roomType', 'mealPlan', 'rooms']) {
    if (req.body[f] !== undefined) patch[f] = req.body[f];
  }
  if (patch.status && !SERVICE_BOOKING_STATUSES.includes(patch.status)) {
    throw ApiError.badRequest('Invalid status');
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
