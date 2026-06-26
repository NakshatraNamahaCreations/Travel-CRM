import { Booking } from '../models/Booking.js';
import { Quote } from '../models/Quote.js';
import { Query } from '../models/Query.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginate } from '../utils/apiResponse.js';
import { generateForBooking } from './installment.controller.js';
import { logActivity } from './activity.controller.js';

const POPULATE = [
  { path: 'destinations', select: 'name' },
  { path: 'owner', select: 'name' },
  { path: 'query', select: 'queryNumber' },
];

// Map booking lifecycle onto the parent query's pipeline status.
const QUERY_STATUS_FOR = { confirmed: 'converted', on_trip: 'on_trip', completed: 'past', cancelled: 'canceled' };

// GET /api/bookings
export const listBookings = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
  if (req.query.search) {
    const term = req.query.search.trim();
    const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ 'guest.name': rx }, { 'guest.phones.number': rx }];
    const n = Number(term);
    if (!Number.isNaN(n)) filter.$or.push({ bookingNumber: n });
  }
  const total = await Booking.countDocuments(filter);
  const meta = paginate(req.query, total);
  const items = await Booking.find(filter).populate(POPULATE).sort('-createdAt').skip(meta.skip).limit(meta.limit);
  return ok(res, items, meta);
});

// GET /api/bookings/:id
export const getBooking = asyncHandler(async (req, res) => {
  const b = await Booking.findById(req.params.id)
    .populate(POPULATE)
    .populate({ path: 'quote', select: 'quoteNumber pricing' });
  if (!b) throw ApiError.notFound('Booking not found');
  return ok(res, b);
});

// POST /api/bookings/from-quote/:quoteId
export const createFromQuote = asyncHandler(async (req, res) => {
  const quote = await Quote.findById(req.params.quoteId);
  if (!quote) throw ApiError.notFound('Quote not found');

  const query = await Query.findById(quote.query);
  if (!query) throw ApiError.badRequest('Parent query missing');

  const existing = await Booking.findOne({ quote: quote._id });
  if (existing) throw ApiError.conflict('A booking already exists for this quote');

  const booking = await Booking.create({
    query: query._id,
    quote: quote._id,
    title: quote.title,
    guest: query.guest,
    destinations: query.destinations,
    startDate: quote.startDate || query.startDate,
    nights: quote.nights ?? query.nights,
    pax: quote.pax || query.pax,
    days: quote.days,
    costItems: quote.costItems,
    currency: quote.currency,
    totalAmount: quote.pricing?.total || 0,
    owner: query.owner,
    createdBy: req.user._id,
  });

  // Confirming the quote + booking moves the query to converted.
  await Quote.findByIdAndUpdate(quote._id, { status: 'accepted' });
  await Query.findByIdAndUpdate(query._id, { status: 'converted', bookedAmount: booking.totalAmount });
  await logActivity(query._id, req.user?._id, `converted to booking from quote #${quote.quoteNumber}`, 'booking');

  // Generate the incoming + outgoing payment schedule for this trip.
  try {
    await generateForBooking(booking, quote, req.user._id);
  } catch {
    /* non-fatal — booking still succeeds even if schedule generation fails */
  }

  const populated = await booking.populate(POPULATE);
  return created(res, populated);
});

// PATCH /api/bookings/:id/status
export const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['confirmed', 'on_trip', 'completed', 'cancelled'].includes(status)) {
    throw ApiError.badRequest('Invalid status');
  }
  const b = await Booking.findByIdAndUpdate(req.params.id, { status }, { new: true }).populate(POPULATE);
  if (!b) throw ApiError.notFound('Booking not found');
  if (b.query && QUERY_STATUS_FOR[status]) {
    await Query.findByIdAndUpdate(b.query._id || b.query, { status: QUERY_STATUS_FOR[status] });
  }
  return ok(res, b);
});

// DELETE /api/bookings/:id
export const deleteBooking = asyncHandler(async (req, res) => {
  const b = await Booking.findByIdAndDelete(req.params.id);
  if (!b) throw ApiError.notFound('Booking not found');
  return ok(res, { id: req.params.id });
});
