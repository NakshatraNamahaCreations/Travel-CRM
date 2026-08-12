import { Booking } from '../models/Booking.js';
import { ServiceBooking } from '../models/ServiceBooking.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, paginate } from '../utils/apiResponse.js';

const POPULATE = [
  { path: 'destinations', select: 'name' },
  { path: 'owner', select: 'name' },
  { path: 'query', select: 'queryNumber source' },
  { path: 'quote', select: 'packages selectedPackageIndex pricing' },
];

const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

// Pull the selected package from a populated booking's quote.
function selectedPackage(b) {
  const q = b.quote;
  if (!q || !q.packages?.length) return null;
  return q.packages[q.selectedPackageIndex || 0] || q.packages[0];
}

// Derive concrete hotel stays (with check-in/out dates) from the quote package.
function hotelStays(b) {
  const pkg = selectedPackage(b);
  if (!pkg || !b.startDate) return [];
  return (pkg.hotels || []).filter((h) => !h.isAlternative).map((h) => {
    const nights = (h.nights || []).slice().sort((a, c) => a - c);
    const first = nights[0] || 1;
    const count = Math.max(1, nights.length);
    const checkIn = addDays(b.startDate, first - 1);
    return {
      hotelName: h.hotelName || 'Hotel',
      city: h.city || '',
      roomType: h.roomType || '',
      mealPlan: h.mealPlan || '',
      rooms: h.rooms || 1,
      nights: count,
      checkIn,
      checkOut: addDays(checkIn, count),
      reservationStatus: 'Initialized', // per-hotel reservation tracking not modelled yet
      amount: h.amount || 0,
    };
  });
}

// Derive day-wise cab/operational schedules from the quote package transports.
function cabSchedules(b) {
  const pkg = selectedPackage(b);
  if (!pkg || !b.startDate) return [];
  return (pkg.transports || []).map((t) => ({
    day: t.day || 1,
    date: addDays(b.startDate, (t.day || 1) - 1),
    serviceLocation: t.serviceLocation || '',
    serviceType: t.serviceType || '',
    startTime: t.startTime || '',
    items: (t.items || []).map((it) => ({ type: it.type, qty: it.qty || 1 })),
  }));
}

const tabFilter = (tab) => {
  switch (tab) {
    case 'new': return { status: 'confirmed' };
    case 'on_trip': return { status: 'on_trip' };
    case 'past': return { status: 'completed' };
    case 'dropped': return { status: 'cancelled' };
    default: return {};
  }
};

const baseRow = (b) => ({
  _id: b._id,
  bookingNumber: b.bookingNumber,
  title: b.title,
  guest: b.guest,
  query: b.query,
  quoteId: b.quote?._id || null,
  destinations: b.destinations,
  owner: b.owner,
  startDate: b.startDate,
  endDate: b.endDate,
  nights: b.nights,
  pax: b.pax,
  status: b.status,
  currency: b.currency || 'INR',
  totalAmount: b.totalAmount || 0,
  createdAt: b.createdAt,
});

// GET /api/bookings/views/hotels?tab=&search=
export const hotelBookings = asyncHandler(async (req, res) => {
  const filter = tabFilter(req.query.tab);
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ 'guest.name': rx }, { 'guest.phones.number': rx }];
  }
  const total = await Booking.countDocuments(filter);
  const meta = paginate(req.query, total);
  const rows = await Booking.find(filter).populate(POPULATE).sort('-createdAt').skip(meta.skip).limit(meta.limit);

  // Fetch ServiceBooking hotel rows for all these queries in one query.
  const queryIds = rows.map((b) => b.query?._id || b.query).filter(Boolean);
  const svcRows = queryIds.length
    ? await ServiceBooking.find({ query: { $in: queryIds }, kind: 'hotel' })
        .populate({ path: 'bookedBy', select: 'name' })
        .sort({ order: 1, checkIn: 1 })
    : [];

  // Group by query ID string.
  const svcByQuery = {};
  for (const s of svcRows) {
    const qid = String(s.query);
    (svcByQuery[qid] = svcByQuery[qid] || []).push(s);
  }

  const items = rows.map((b) => {
    const qid = String(b.query?._id || b.query);
    const svc = svcByQuery[qid] || [];
    const hasSvc = svc.length > 0;
    return {
      ...baseRow(b),
      hotels: hasSvc ? svc : hotelStays(b),
      hasServiceBookings: hasSvc,
      bookedCount: hasSvc ? svc.filter((s) => ['booked', 'confirmed'].includes(s.status)).length : 0,
      voucherCount: hasSvc ? svc.filter((s) => s.status === 'confirmed').length : 0,
    };
  });
  return ok(res, items, meta);
});

// GET /api/bookings/views/hotel-checkins?tab=upcoming|completed|all&after=&before=&dateField=checkIn|checkOut&includeDropped=1
// Live ServiceBooking rows (status/tag/price/bookedBy stay in sync with what's
// edited on the trip's Bookings tab) across every trip in the org, not a
// stale re-derivation from the quote.
export const hotelCheckins = asyncHandler(async (req, res) => {
  const tab = req.query.tab || 'upcoming';
  const dateField = req.query.dateField === 'checkOut' ? 'checkOut' : 'checkIn';
  const includeDropped = req.query.includeDropped === '1' || req.query.includeDropped === 'true';
  const after = req.query.after ? new Date(req.query.after) : null;
  const before = req.query.before ? new Date(new Date(req.query.before).setHours(23, 59, 59, 999)) : null;
  const now = new Date();

  const filter = { kind: 'hotel' };
  if (!includeDropped) filter.status = { $ne: 'cancelled' };

  const rangeConstraint = {};
  if (after) rangeConstraint.$gte = after;
  if (before) rangeConstraint.$lte = before;
  const checkOutTabConstraint = {};
  if (tab === 'upcoming') checkOutTabConstraint.$gte = now;
  else if (tab === 'completed') checkOutTabConstraint.$lt = now;

  if (dateField === 'checkOut') {
    filter.checkOut = { ...rangeConstraint, ...checkOutTabConstraint };
  } else {
    if (Object.keys(rangeConstraint).length) filter.checkIn = rangeConstraint;
    if (Object.keys(checkOutTabConstraint).length) filter.checkOut = checkOutTabConstraint;
  }

  const rows = await ServiceBooking.find(filter)
    .populate({ path: 'query', select: 'queryNumber guest pax' })
    .populate({ path: 'bookedBy', select: 'name' })
    .sort({ checkIn: 1 })
    .limit(800);

  const items = rows
    .filter((r) => r.query) // drop orphaned rows whose trip was deleted
    .map((r) => ({
      _id: r._id,
      query: r.query,
      hotelName: r.name,
      city: r.city,
      stars: r.stars,
      roomType: r.roomType,
      mealPlan: r.mealPlan,
      rooms: r.rooms,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      nights: r.nightRates?.length || r.nights?.length || 1,
      status: r.status,
      tag: r.tag,
      comment: r.comment,
      price: r.price,
      currency: r.currency,
      bookedBy: r.bookedBy,
      updatedAt: r.updatedAt,
      confirmationNumber: r.confirmationNumber,
      voucherGeneratedAt: r.voucherGeneratedAt,
    }));
  return ok(res, items, { total: items.length });
});

// GET /api/bookings/views/operational?after=&before=
export const operationalBookings = asyncHandler(async (req, res) => {
  const after = req.query.after ? new Date(req.query.after) : null;
  const before = req.query.before ? new Date(new Date(req.query.before).setHours(23, 59, 59, 999)) : null;

  const rows = await Booking.find({ status: { $ne: 'cancelled' } }).populate(POPULATE).sort('startDate').limit(800);
  const schedules = [];
  for (const b of rows) {
    for (const s of cabSchedules(b)) {
      if (after && s.date < after) continue;
      if (before && s.date > before) continue;
      schedules.push({
        booking: b._id,
        bookingNumber: b.bookingNumber,
        guest: b.guest,
        query: b.query,
        ...s,
      });
    }
  }
  schedules.sort((a, c) => new Date(a.date) - new Date(c.date));
  return ok(res, schedules, { total: schedules.length });
});

// GET /api/bookings/views/quote-diff?tab=&search=
export const quoteBookingsDiff = asyncHandler(async (req, res) => {
  const filter = { quote: { $ne: null } };
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ 'guest.name': rx }, { 'guest.phones.number': rx }];
  }
  if (req.query.tab === 'upcoming') filter.startDate = { $gte: new Date() };
  else if (req.query.tab === 'on_trip') filter.status = 'on_trip';
  else if (req.query.tab === 'past') filter.status = 'completed';

  const total = await Booking.countDocuments(filter);
  const meta = paginate(req.query, total);
  const rows = await Booking.find(filter).populate(POPULATE).sort('-updatedAt').skip(meta.skip).limit(meta.limit);

  // Operations readiness: every operational ServiceBooking line for the trip
  // is booked/confirmed (and at least one exists).
  const queryIds = rows.map((b) => b.query?._id || b.query).filter(Boolean);
  const opRows = queryIds.length
    ? await ServiceBooking.find({ query: { $in: queryIds }, kind: 'operational' }).select('query status')
    : [];
  const opByQuery = {};
  for (const s of opRows) {
    const qid = String(s.query);
    (opByQuery[qid] = opByQuery[qid] || []).push(s.status);
  }

  const items = rows.map((b) => {
    const quoteTotal = b.quote?.pricing?.total || 0;
    const hasDiff = Math.round(quoteTotal) !== Math.round(b.totalAmount || 0);
    const opStatuses = opByQuery[String(b.query?._id || b.query)] || [];
    return {
      ...baseRow(b),
      quoteTotal,
      hasDiff,
      lastChange: b.updatedAt,
      operationsReady: opStatuses.length > 0 && opStatuses.every((s) => ['booked', 'confirmed'].includes(s)),
      operationsCount: opStatuses.length,
    };
  });
  return ok(res, items, meta);
});
