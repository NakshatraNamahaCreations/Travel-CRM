import { Installment } from '../models/Installment.js';
import { Payment } from '../models/Payment.js';
import { Booking } from '../models/Booking.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginate } from '../utils/apiResponse.js';
import { createNotification } from './notification.controller.js';

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function todayEnd() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
function daysAgo(n) {
  const d = todayStart();
  d.setDate(d.getDate() - n);
  return d;
}

// Recompute a booking's paidAmount from its customer payments.
async function syncBookingPaid(bookingId) {
  if (!bookingId) return;
  const rows = await Payment.aggregate([
    { $match: { booking: bookingId, party: 'customer' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  await Booking.findByIdAndUpdate(bookingId, { paidAmount: rows[0]?.total || 0 });
}

// Build the mongo filter for a given left-tab.
function tabFilter(tab) {
  switch (tab) {
    case 'upcoming':
      return { paid: false, dueDate: { $gte: todayStart() } };
    case 'past7':
      return { dueDate: { $gte: daysAgo(7), $lte: todayEnd() } };
    case 'unverified':
      return { paid: true, verified: false };
    case 'paid':
      return { paid: true, verified: true };
    case 'overdue':
      return { paid: false, dueDate: { $lt: todayStart() } };
    case 'all':
    default:
      return {};
  }
}

// GET /api/installments?direction=&filter=&search=&booking=
export const listInstallments = asyncHandler(async (req, res) => {
  const filter = { ...tabFilter(req.query.filter || 'all') };
  if (req.query.direction) filter.direction = req.query.direction;
  if (req.query.booking) filter.booking = req.query.booking;
  if (req.query.query) filter.query = req.query.query;
  if (req.query.search) {
    const rx = new RegExp(req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ 'guest.name': rx }, { 'guest.phones.number': rx }, { tripId: rx }, { supplierName: rx }];
  }

  const total = await Installment.countDocuments(filter);
  const meta = paginate(req.query, total);
  const items = await Installment.find(filter).sort('dueDate').skip(meta.skip).limit(meta.limit);
  return ok(res, items, meta);
});

const pad4 = (n) => { const s = String(n ?? '').trim(); return /^\d+$/.test(s) ? s.padStart(4, '0') : s; };

// GET /api/installments/accounts?search=  — trip/guest accounts for the debit/credit picker
export const accountOptions = asyncHandler(async (req, res) => {
  const bookings = await Booking.find().populate('query', 'queryNumber').sort('-createdAt').limit(200);
  let guests = bookings.map((b) => {
    const name = [b.guest?.salutation, b.guest?.name].filter(Boolean).join(' ') || 'Guest';
    const tripId = b.query?.queryNumber || b.bookingNumber || '';
    const ph = b.guest?.phones?.[0];
    return {
      type: 'guest',
      label: `${name} - Trip ID: ${pad4(tripId)}`,
      phone: ph ? `+${ph.countryCode || '91'} ${ph.number}` : '',
      tripId: String(tripId),
    };
  });
  // de-dup by label
  const seen = new Set();
  guests = guests.filter((g) => (seen.has(g.label) ? false : seen.add(g.label)));
  if (req.query.search) {
    const rx = new RegExp(req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    guests = guests.filter((g) => rx.test(g.label) || rx.test(g.phone));
  }
  return ok(res, guests);
});

// GET /api/installments/summary?direction=  — counts per tab
export const installmentSummary = asyncHandler(async (req, res) => {
  const base = req.query.direction ? { direction: req.query.direction } : {};
  const tabs = ['upcoming', 'past7', 'unverified', 'paid', 'overdue', 'all'];
  const entries = await Promise.all(
    tabs.map((t) => Installment.countDocuments({ ...base, ...tabFilter(t) }).then((c) => [t, c]))
  );
  return ok(res, Object.fromEntries(entries));
});

// POST /api/installments  — create a due manually
export const createInstallment = asyncHandler(async (req, res) => {
  const item = await Installment.create({ ...req.body, createdBy: req.user._id });
  return created(res, item);
});

// Retry Payment.create on E11000 duplicate paymentNumber.
async function createPaymentWithRetry(data, retries = 4) {
  for (let i = 0; i < retries; i++) {
    try {
      return await Payment.create({ ...data });
    } catch (err) {
      if (err.code === 11000 && i < retries - 1) continue;
      throw err;
    }
  }
}

// POST /api/installments/:id/log-payment
export const logPayment = asyncHandler(async (req, res) => {
  const inst = await Installment.findById(req.params.id);
  if (!inst) throw ApiError.notFound('Installment not found');

  const paidAmount = Number(req.body.paidAmount) || inst.amount;
  inst.paid = true;
  inst.verified = req.body.verified !== false; // default verified
  inst.paidAmount = paidAmount;
  inst.paidOn = req.body.paidOn ? new Date(req.body.paidOn) : new Date();
  inst.reference = req.body.reference || inst.reference;
  inst.debitAccount = req.body.debitAccount || inst.debitAccount;
  inst.creditAccount = req.body.creditAccount || inst.creditAccount;

  // Mirror into the Payment ledger so accounting totals stay in sync.
  const payment = await createPaymentWithRetry({
    party: inst.direction === 'incoming' ? 'customer' : 'supplier',
    booking: inst.booking,
    query: inst.query,
    supplier: inst.direction === 'outgoing' ? { kind: 'other', name: inst.supplierName || 'Supplier' } : undefined,
    amount: paidAmount,
    currency: inst.currency,
    mode: req.body.mode || 'Bank Transfer',
    reference: inst.reference,
    date: inst.paidOn,
    notes: `Installment #${inst.installmentNumber}`,
    createdBy: req.user._id,
  });
  inst.payment = payment._id;
  await inst.save();

  if (inst.direction === 'incoming') await syncBookingPaid(inst.booking);

  // Notify booking owner about received payment.
  if (inst.direction === 'incoming') {
    const booking = await Booking.findById(inst.booking).populate('owner', '_id');
    if (booking?.owner && String(booking.owner._id) !== String(req.user._id)) {
      await createNotification({
        recipient: booking.owner._id,
        type: 'payment_received',
        title: 'Payment Received',
        body: `₹${paidAmount.toLocaleString('en-IN')} received — Instalment #${inst.installmentNumber}`,
        link: `/bookings/${inst.booking}`,
        createdBy: req.user._id,
      });
    }
  }

  return ok(res, inst);
});

// PATCH /api/installments/:id/verify
export const verifyInstallment = asyncHandler(async (req, res) => {
  const inst = await Installment.findByIdAndUpdate(req.params.id, { verified: true }, { new: true });
  if (!inst) throw ApiError.notFound('Installment not found');
  return ok(res, inst);
});

// POST /api/installments/:id/comments
export const addComment = asyncHandler(async (req, res) => {
  const inst = await Installment.findById(req.params.id);
  if (!inst) throw ApiError.notFound('Installment not found');
  if (!req.body.body?.trim()) throw ApiError.badRequest('Comment is required');
  inst.comments.push({ body: req.body.body.trim(), createdBy: req.user._id });
  await inst.save();
  return ok(res, inst);
});

// DELETE /api/installments/:id
export const deleteInstallment = asyncHandler(async (req, res) => {
  const inst = await Installment.findByIdAndDelete(req.params.id);
  if (!inst) throw ApiError.notFound('Installment not found');
  if (inst.payment) await Payment.findByIdAndDelete(inst.payment);
  if (inst.direction === 'incoming') await syncBookingPaid(inst.booking);
  return ok(res, { id: req.params.id });
});

/**
 * Create incoming + outgoing instalments for a freshly-created booking.
 * Incoming = full selling price due at trip start (what the customer owes us).
 * Outgoing = total supplier cost due at trip start (what we owe suppliers).
 * Safe to call repeatedly — skips a direction if one already exists.
 */
export async function generateForBooking(booking, quote, userId, opts = {}) {
  if (!booking) return;
  const b = await Booking.findById(booking._id).populate('destinations', 'name').populate('query', 'queryNumber');
  if (!b) return;
  const base = {
    booking: b._id,
    query: b.query?._id || b.query,
    tripId: b.query?.queryNumber ? String(b.query.queryNumber) : undefined,
    guest: b.guest,
    destinations: (b.destinations || []).map((d) => d.name).filter(Boolean),
    startDate: b.startDate,
    endDate: b.endDate,
    currency: b.currency || 'INR',
    dueDate: b.startDate || b.createdAt || new Date(),
    createdBy: userId,
  };

  const out = [];
  const hasIncoming = await Installment.findOne({ booking: b._id, direction: 'incoming' });
  if (!hasIncoming && b.totalAmount > 0) {
    // Custom schedule from the conversion page, else one full-amount instalment.
    const rows = (Array.isArray(opts.instalments) ? opts.instalments : [])
      .map((r) => ({ amount: Number(r.amount) || 0, dueDate: r.dueDate ? new Date(r.dueDate) : base.dueDate }))
      .filter((r) => r.amount > 0);
    const schedule = rows.length ? rows : [{ amount: b.totalAmount, dueDate: base.dueDate }];
    const comment = opts.comment?.trim() ? [{ body: opts.comment.trim(), createdBy: userId }] : null;
    schedule.forEach((r, i) => out.push({
      ...base, direction: 'incoming', amount: r.amount, dueDate: r.dueDate,
      ...(i === 0 && comment ? { comments: comment } : {}),
    }));
  }
  const supplierCost = (quote?.costItems || b.costItems || []).reduce((s, it) => s + (it.amount || 0), 0);
  const hasOutgoing = await Installment.findOne({ booking: b._id, direction: 'outgoing' });
  if (!hasOutgoing && supplierCost > 0) {
    out.push({ ...base, direction: 'outgoing', amount: supplierCost, supplierName: `Suppliers (Trip ${base.tripId || ''})`.trim() });
  }
  for (const doc of out) {
    // create() one-by-one so the pre-save counter runs
    // eslint-disable-next-line no-await-in-loop
    await Installment.create(doc);
  }
  return out.length;
}
