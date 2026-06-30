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
  return (pkg.hotels || []).map((h) => {
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

// GET /api/bookings/views/hotel-checkins?tab=upcoming|completed|all&after=&before=
export const hotelCheckins = asyncHandler(async (req, res) => {
  const tab = req.query.tab || 'upcoming';
  const after = req.query.after ? new Date(req.query.after) : null;
  const before = req.query.before ? new Date(new Date(req.query.before).setHours(23, 59, 59, 999)) : null;

  const rows = await Booking.find({ status: { $ne: 'cancelled' } }).populate(POPULATE).sort('startDate').limit(800);
  const now = new Date();
  const stays = [];
  for (const b of rows) {
    for (const s of hotelStays(b)) {
      if (after && s.checkIn < after) continue;
      if (before && s.checkIn > before) continue;
      if (tab === 'upcoming' && s.checkOut < now) continue;
      if (tab === 'completed' && s.checkOut >= now) continue;
      stays.push({
        booking: b._id,
        bookingNumber: b.bookingNumber,
        guest: b.guest,
        query: b.query,
        ...s,
      });
    }
  }
  stays.sort((a, c) => new Date(a.checkIn) - new Date(c.checkIn));
  return ok(res, stays, { total: stays.length });
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

  const items = rows.map((b) => {
    const quoteTotal = b.quote?.pricing?.total || 0;
    const hasDiff = Math.round(quoteTotal) !== Math.round(b.totalAmount || 0);
    return {
      ...baseRow(b),
      quoteTotal,
      hasDiff,
      lastChange: b.updatedAt,
    };
  });
  return ok(res, items, meta);
});
