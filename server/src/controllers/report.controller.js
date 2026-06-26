import { Query } from '../models/Query.js';
import { Quote } from '../models/Quote.js';
import { Booking } from '../models/Booking.js';
import { Comment } from '../models/Comment.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';

// Statuses that represent a "won" sale.
const WON = ['converted', 'on_trip', 'past'];

function rangeFromQuery(q) {
  const now = new Date();
  const after = q.after ? new Date(q.after) : new Date(now.getFullYear(), now.getMonth(), 1);
  const before = q.before
    ? new Date(new Date(q.before).setHours(23, 59, 59, 999))
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { after, before };
}

/* -------------------------- date-bucket helpers -------------------------- */
function dayRange(offsetDays = 0) {
  const n = new Date();
  return {
    after: new Date(n.getFullYear(), n.getMonth(), n.getDate() + offsetDays, 0, 0, 0, 0),
    before: new Date(n.getFullYear(), n.getMonth(), n.getDate() + offsetDays, 23, 59, 59, 999),
  };
}
function spanRange(startOffset, endOffset) {
  return { after: dayRange(startOffset).after, before: dayRange(endOffset).before };
}
function weekRange() {
  const n = new Date();
  const diff = (n.getDay() + 6) % 7; // Monday as week start
  const after = new Date(n.getFullYear(), n.getMonth(), n.getDate() - diff, 0, 0, 0, 0);
  const before = new Date(after);
  before.setDate(after.getDate() + 6);
  before.setHours(23, 59, 59, 999);
  return { after, before };
}
function monthRange() {
  const n = new Date();
  return {
    after: new Date(n.getFullYear(), n.getMonth(), 1),
    before: new Date(n.getFullYear(), n.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}
const rangeObj = (r) => ({ $gte: r.after, $lte: r.before });

/* ----------------------------- sales report ----------------------------- */

// GET /api/reports/sales?after=&before=&type=&owner=&team=
export const salesReport = asyncHandler(async (req, res) => {
  const { after, before } = rangeFromQuery(req.query);
  const inRange = { createdAt: { $gte: after, $lte: before } };

  const scope = {};
  if (req.query.owner) scope.owner = req.query.owner;
  if (req.query.salesTeam) scope.salesTeam = req.query.salesTeam;

  const baseQ = { ...inRange, ...scope };

  const [leads, quotes, conversion, dropped, wonAgg] = await Promise.all([
    Query.countDocuments(baseQ),
    Quote.countDocuments(inRange),
    Query.countDocuments({ ...baseQ, status: { $in: WON } }),
    Query.countDocuments({ ...baseQ, status: 'dropped' }),
    Query.aggregate([
      { $match: { ...baseQ, status: { $in: WON } } },
      { $group: { _id: null, revenue: { $sum: '$bookedAmount' }, profit: { $sum: '$profit' } } },
    ]),
  ]);

  const revenue = wonAgg[0]?.revenue || 0;
  const totalProfit = wonAgg[0]?.profit || 0;
  const conversionPct = leads ? Math.round((conversion / leads) * 100) : 0;

  // Table rows — the "sales" (won trips) in range, with profit %.
  const type = req.query.type || 'all';
  const itemFilter = { ...baseQ };
  if (type === 'won') itemFilter.status = { $in: WON };
  else if (type !== 'all') itemFilter.status = type;

  const rows = await Query.find(itemFilter)
    .populate('destinations', 'name')
    .populate('owner', 'name')
    .populate('salesTeam', 'name')
    .sort('-createdAt')
    .limit(200);

  const items = rows.map((q) => {
    const amount = q.bookedAmount || 0;
    const profit = q.profit || 0;
    return {
      _id: q._id,
      queryNumber: q.queryNumber,
      guest: q.guest,
      destinations: q.destinations,
      nights: q.nights,
      startDate: q.startDate,
      status: q.status,
      owner: q.owner,
      salesTeam: q.salesTeam,
      createdAt: q.createdAt,
      amount,
      currency: q.currency || 'INR',
      profit,
      profitPercent: amount ? Math.round((profit / amount) * 100) : 0,
    };
  });

  return ok(res, {
    range: { after, before },
    summary: { revenue, leads, quotes, conversion, conversionPct, dropped, profit: totalProfit },
    items,
  });
});

/* ------------------------------ dashboard ------------------------------- */

async function computeSales(range, scope) {
  const inRange = { createdAt: rangeObj(range) };
  const baseQ = { ...inRange, ...scope };
  const [leads, quotes, conversion, wonAgg] = await Promise.all([
    Query.countDocuments(baseQ),
    Quote.countDocuments(inRange),
    Query.countDocuments({ ...baseQ, status: { $in: WON } }),
    Query.aggregate([
      { $match: { ...baseQ, status: { $in: WON } } },
      { $group: { _id: null, revenue: { $sum: '$bookedAmount' }, profit: { $sum: '$profit' } } },
    ]),
  ]);
  return {
    revenue: wonAgg[0]?.revenue || 0,
    profit: wonAgg[0]?.profit || 0,
    leads,
    quotes,
    conversion,
    conversionPct: leads ? Math.round((conversion / leads) * 100) : 0,
  };
}

const HAS_BALANCE = { $expr: { $gt: [{ $subtract: ['$totalAmount', '$paidAmount'] }, 0] } };

async function dueAgg(match) {
  const r = await Booking.aggregate([
    { $match: { ...HAS_BALANCE, ...match } },
    { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: { $subtract: ['$totalAmount', '$paidAmount'] } } } },
  ]);
  return { count: r[0]?.count || 0, amount: Math.round(r[0]?.amount || 0) };
}

// GET /api/reports/dashboard
export const dashboard = asyncHandler(async (req, res) => {
  const scope = {};
  if (req.query.owner) scope.owner = req.query.owner;

  const fBase = { isActionable: true, isResolved: false };
  const startStatus = { status: { $in: ['confirmed', 'on_trip'] } };
  const endStatus = { status: { $in: ['confirmed', 'on_trip', 'completed'] } };
  const now = new Date();

  const [
    salesToday, salesWeek, salesMonth,
    fToday, fYesterday, fNext7,
    startToday, startYesterday, startNext7,
    endToday, endTomorrow, endPrev7,
    dueToday, dueYesterday,
    liveDue, endedYestDue, starts7Due,
  ] = await Promise.all([
    computeSales(dayRange(0), scope),
    computeSales(weekRange(), scope),
    computeSales(monthRange(), scope),
    Comment.countDocuments({ ...fBase, dueDate: rangeObj(dayRange(0)) }),
    Comment.countDocuments({ ...fBase, dueDate: rangeObj(dayRange(-1)) }),
    Comment.countDocuments({ ...fBase, dueDate: rangeObj(spanRange(0, 7)) }),
    Booking.countDocuments({ ...startStatus, startDate: rangeObj(dayRange(0)) }),
    Booking.countDocuments({ ...startStatus, startDate: rangeObj(dayRange(-1)) }),
    Booking.countDocuments({ ...startStatus, startDate: rangeObj(spanRange(0, 7)) }),
    Booking.countDocuments({ ...endStatus, endDate: rangeObj(dayRange(0)) }),
    Booking.countDocuments({ ...endStatus, endDate: rangeObj(dayRange(1)) }),
    Booking.countDocuments({ ...endStatus, endDate: rangeObj(spanRange(-7, -1)) }),
    dueAgg({ startDate: rangeObj(dayRange(0)) }),
    dueAgg({ startDate: rangeObj(dayRange(-1)) }),
    dueAgg({ startDate: { $lte: now }, endDate: { $gte: now } }),
    dueAgg({ endDate: rangeObj(dayRange(-1)) }),
    dueAgg({ startDate: rangeObj(spanRange(0, 7)) }),
  ]);

  return ok(res, {
    salesStats: { today: salesToday, week: salesWeek, month: salesMonth },
    followups: { today: fToday, yesterday: fYesterday, next7: fNext7 },
    payments: { dueIncoming: { today: dueToday, yesterday: dueYesterday } },
    tripsStarting: { today: startToday, yesterday: startYesterday, next7: startNext7 },
    tripsEnding: { today: endToday, tomorrow: endTomorrow, prev7: endPrev7 },
    liveDuePayments: { live: liveDue, endedYesterday: endedYestDue, starts7: starts7Due },
  });
});

/* --------------------------- drill-down lists --------------------------- */

function bookingRow(b) {
  const balanceDue = Math.max(0, (b.totalAmount || 0) - (b.paidAmount || 0));
  return {
    _id: b._id,
    bookingNumber: b.bookingNumber,
    query: b.query,
    guest: b.guest,
    destinations: b.destinations,
    startDate: b.startDate,
    endDate: b.endDate,
    nights: b.nights,
    status: b.status,
    owner: b.owner,
    currency: b.currency || 'INR',
    totalAmount: b.totalAmount || 0,
    paidAmount: b.paidAmount || 0,
    balanceDue,
  };
}

function buildTripFilter(view, bucket) {
  const f = {};
  const now = new Date();
  const set = (field, r) => { f[field] = rangeObj(r); };

  if (view === 'starting') {
    f.status = { $in: ['confirmed', 'on_trip'] };
    if (bucket === 'today') set('startDate', dayRange(0));
    else if (bucket === 'yesterday') set('startDate', dayRange(-1));
    else if (bucket === 'next7') set('startDate', spanRange(0, 7));
  } else if (view === 'ending') {
    f.status = { $in: ['confirmed', 'on_trip', 'completed'] };
    if (bucket === 'today') set('endDate', dayRange(0));
    else if (bucket === 'tomorrow') set('endDate', dayRange(1));
    else if (bucket === 'prev7') set('endDate', spanRange(-7, -1));
  } else if (view === 'due-incoming') {
    Object.assign(f, HAS_BALANCE);
    if (bucket === 'today') set('startDate', dayRange(0));
    else if (bucket === 'yesterday') set('startDate', dayRange(-1));
  } else if (view === 'live-due') {
    Object.assign(f, HAS_BALANCE);
    if (bucket === 'live') { f.startDate = { $lte: now }; f.endDate = { $gte: now }; }
    else if (bucket === 'endedYesterday') set('endDate', dayRange(-1));
    else if (bucket === 'starts7') set('startDate', spanRange(0, 7));
  }
  return f;
}

// GET /api/reports/trips?view=&bucket=
export const tripsReport = asyncHandler(async (req, res) => {
  const view = req.query.view || 'starting';
  const bucket = req.query.bucket || 'all';

  if (view === 'followups') {
    const f = { isActionable: true, isResolved: false };
    if (bucket === 'today') f.dueDate = rangeObj(dayRange(0));
    else if (bucket === 'yesterday') f.dueDate = rangeObj(dayRange(-1));
    else if (bucket === 'next7') f.dueDate = rangeObj(spanRange(0, 7));
    const rows = await Comment.find(f)
      .populate({ path: 'query', select: 'queryNumber guest', populate: { path: 'destinations', select: 'name' } })
      .populate('assignedTo', 'name')
      .populate('createdBy', 'name')
      .sort('dueDate')
      .limit(300);
    const items = rows.map((c) => ({
      _id: c._id,
      dueDate: c.dueDate,
      body: c.body,
      query: c.query,
      assignedTo: c.assignedTo,
      createdBy: c.createdBy,
      createdAt: c.createdAt,
    }));
    return ok(res, { view, bucket, kind: 'followups', items });
  }

  const filter = buildTripFilter(view, bucket);
  const sortField = view === 'ending' ? 'endDate' : 'startDate';
  const rows = await Booking.find(filter)
    .populate('destinations', 'name')
    .populate('owner', 'name')
    .sort(sortField)
    .limit(300);
  return ok(res, { view, bucket, kind: 'trips', items: rows.map(bookingRow) });
});

/* ---------------------- trip check-in / check-out report ---------------------- */

// Estimate supplier (booking) cost + tax for a booking from its cost snapshot.
function bookingFinance(b) {
  const pkg = b.totalAmount || 0;
  const cost = (b.costItems || []).reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const tax = b.quote?.pricing?.tax || 0;
  const bookings = Math.round(cost);
  const profit = Math.round(pkg - bookings - tax);
  return { pkg, tax: Math.round(tax), bookings, profit, profitPct: pkg ? Math.round((profit / pkg) * 1000) / 10 : 0 };
}

// GET /api/reports/trip-check-in-out?direction=checkout|checkin&after=&before=
export const tripCheckInOutReport = asyncHandler(async (req, res) => {
  const direction = req.query.direction === 'checkin' ? 'checkin' : 'checkout';
  const { after, before } = rangeFromQuery(req.query);
  const dateField = direction === 'checkin' ? 'startDate' : 'endDate';

  const rows = await Booking.find({ [dateField]: { $gte: after, $lte: before } })
    .populate('destinations', 'name')
    .populate({ path: 'quote', select: 'pricing' })
    .sort(dateField)
    .limit(500);

  const items = rows.map((b) => {
    const fin = bookingFinance(b);
    return {
      _id: b._id,
      bookingNumber: b.bookingNumber,
      query: b.query,
      guest: b.guest,
      destinations: b.destinations,
      startDate: b.startDate,
      endDate: b.endDate,
      nights: b.nights,
      status: b.status,
      currency: b.currency || 'INR',
      package: fin.pkg,
      tax: fin.tax,
      bookings: fin.bookings,
      profit: fin.profit,
      profitPct: fin.profitPct,
    };
  });

  const totals = items.reduce(
    (a, x) => ({ packages: a.packages + x.package, bookings: a.bookings + x.bookings }),
    { packages: 0, bookings: 0 }
  );

  return ok(res, { direction, range: { after, before }, count: items.length, totals, items });
});
