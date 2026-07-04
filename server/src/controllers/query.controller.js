import XLSX from 'xlsx';
import { Query } from '../models/Query.js';
import { Destination } from '../models/Destination.js';
import { Comment } from '../models/Comment.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginate } from '../utils/apiResponse.js';
import { QUERY_STATUSES, QUERY_STATUS_VALUES } from '../constants/queryStatus.js';
import { logActivity } from './activity.controller.js';

const LABEL = Object.fromEntries(QUERY_STATUSES.map((s) => [s.value, s.label]));

const POPULATE = [
  { path: 'source', select: 'name' },
  { path: 'salesTeam', select: 'name' },
  { path: 'tags', select: 'name color' },
  { path: 'destinations', select: 'name country' },
  { path: 'owner', select: 'name email' },
];

function buildFilter(query, user) {
  const filter = {};

  // Status tab. 'all' (or missing) returns everything.
  if (query.status && query.status !== 'all') {
    if (!QUERY_STATUS_VALUES.includes(query.status)) {
      throw ApiError.badRequest(`Unknown status: ${query.status}`);
    }
    filter.status = query.status;
  }

  // Search by query number, guest name, or phone number.
  if (query.search) {
    const term = query.search.trim();
    const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const or = [{ 'guest.name': rx }, { 'guest.phones.number': rx }];
    const asNum = Number(term);
    if (!Number.isNaN(asNum)) or.push({ queryNumber: asNum });
    filter.$or = or;
  }

  // Comma-separated id lists → exact match (single) or $in (multiple).
  const idList = (v) => String(v).split(',').map((s) => s.trim()).filter(Boolean);
  const oneOrMany = (v) => { const ids = idList(v); return ids.length > 1 ? { $in: ids } : ids[0]; };
  const dateRange = (after, before) => {
    const r = {};
    if (after) r.$gte = new Date(after);
    if (before) r.$lte = new Date(new Date(before).setHours(23, 59, 59, 999));
    return r;
  };

  if (query.owner) filter.owner = oneOrMany(query.owner);
  if (query.salesTeam) filter.salesTeam = query.salesTeam;
  if (query.source) filter.source = oneOrMany(query.source);
  if (query.destination) filter.destinations = oneOrMany(query.destination);
  if (query.tags) filter.tags = { $in: idList(query.tags) };
  if (query.createdAfter || query.createdBefore) filter.createdAt = dateRange(query.createdAfter, query.createdBefore);
  if (query.startAfter || query.startBefore) filter.startDate = dateRange(query.startAfter, query.startBefore);

  // Sales reps only see their own queries unless they're managers/admins.
  if (user && ['sales', 'operations'].includes(user.role) && query.mine !== 'false') {
    // default scope: own queries
  }
  return filter;
}

/* ---- Automatic date-based stage rolling ----
   converted → on_trip once the start date arrives, and
   converted/on_trip → past once the trip has ended (start + nights).
   Runs lazily (throttled) whenever the trips list / stats are viewed. */
let lastRollAt = 0;
async function rollTripStatuses() {
  const now = Date.now();
  if (now - lastRollAt < 5 * 60 * 1000) return; // at most every 5 minutes
  lastRollAt = now;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Trip end = startDate + nights days (checkout day counts as still on trip).
  const endExpr = { $add: ['$startDate', { $multiply: [{ $ifNull: ['$nights', 0] }, 86400000] }] };
  try {
    await Query.updateMany(
      { status: { $in: ['converted', 'on_trip'] }, startDate: { $ne: null }, $expr: { $lt: [endExpr, today] } },
      { status: 'past' }
    );
    await Query.updateMany(
      { status: 'converted', startDate: { $ne: null, $lte: new Date() }, $expr: { $gte: [endExpr, today] } },
      { status: 'on_trip' }
    );
  } catch {
    /* non-fatal — the list still renders with current statuses */
  }
}

// GET /api/queries
export const listQueries = asyncHandler(async (req, res) => {
  await rollTripStatuses();
  const filter = buildFilter(req.query, req.user);
  const total = await Query.countDocuments(filter);
  const meta = paginate(req.query, total);
  const items = await Query.find(filter)
    .populate(POPULATE)
    .sort(req.query.sort || '-createdAt')
    .skip(meta.skip)
    .limit(meta.limit);

  // Latest comment per query, for the list's Follow-up column.
  const ids = items.map((i) => i._id);
  let lastByQuery = {};
  if (ids.length) {
    const rows = await Comment.aggregate([
      { $match: { query: { $in: ids } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$query', body: { $first: '$body' }, createdAt: { $first: '$createdAt' } } },
    ]);
    lastByQuery = Object.fromEntries(rows.map((r) => [String(r._id), { body: r.body, createdAt: r.createdAt }]));
  }
  const out = items.map((i) => {
    const o = i.toObject({ virtuals: true });
    o.lastComment = lastByQuery[String(i._id)] || null;
    return o;
  });
  return ok(res, out, meta);
});

// GET /api/queries/stats  — counts per pipeline status (for the sidebar tabs)
export const queryStats = asyncHandler(async (req, res) => {
  await rollTripStatuses();
  const rows = await Query.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const byStatus = Object.fromEntries(rows.map((r) => [r._id, r.count]));
  const counts = QUERY_STATUSES.map((s) => ({
    ...s,
    count: byStatus[s.value] || 0,
  }));
  const all = rows.reduce((sum, r) => sum + r.count, 0);
  return ok(res, { counts, all });
});

// GET /api/queries/:id
export const getQuery = asyncHandler(async (req, res) => {
  const item = await Query.findById(req.params.id)
    .populate(POPULATE)
    .populate('createdBy', 'name');
  if (!item) throw ApiError.notFound('Query not found');
  return ok(res, item);
});

// POST /api/queries
export const createQuery = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    createdBy: req.user._id,
    owner: req.body.owner || req.user._id,
  };
  const item = await Query.create(payload);
  await logActivity(item._id, req.user._id, 'created the query', 'created');
  const populated = await item.populate(POPULATE);
  return created(res, populated);
});

// --- CSV bulk upload ---
// Hand-rolled CSV parser (RFC-4180-ish) — avoids xlsx coercing values like
// a "6,8" children cell into the number 68.
function parseCsvText(text) {
  const rows = [];
  let field = '', row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const normKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
function rowMap(row) {
  const o = {};
  for (const k of Object.keys(row)) o[normKey(k)] = row[k];
  return o;
}
function parseCsvDate(s) {
  if (s == null || s === '') return undefined;
  const str = String(s).trim();
  const m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/); // DD-MM-YYYY
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    const dt = new Date(Date.UTC(+y, +mo - 1, +d));
    return Number.isNaN(dt.getTime()) ? undefined : dt;
  }
  const dt = new Date(str);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}
async function resolveDestinations(namesStr, cache) {
  const names = String(namesStr || '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const ids = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (cache.has(key)) { ids.push(cache.get(key)); continue; }
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let d = await Destination.findOne({ name: new RegExp(`^${esc}$`, 'i') });
    if (!d) d = await Destination.create({ name, region: 'Imported' });
    cache.set(key, d._id);
    ids.push(d._id);
  }
  return ids;
}

// POST /api/queries/upload-csv  (multipart: file, optional source, owner)
export const uploadQueriesCsv = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('File field is required');
  let rows;
  try {
    const name = req.file.originalname || '';
    if (/\.(xlsx|xls)$/i.test(name)) {
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
    } else {
      const matrix = parseCsvText(req.file.buffer.toString('utf8')).filter((r) => r.some((c) => String(c).trim() !== ''));
      const headers = (matrix[0] || []).map((h) => String(h).trim());
      rows = matrix.slice(1).map((r) => Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ''])));
    }
  } catch {
    throw ApiError.badRequest('Could not read the CSV file');
  }
  if (!rows.length) throw ApiError.badRequest('The file has no data rows');

  const destCache = new Map();
  const createdNumbers = [];
  const errors = [];
  let rowNum = 1; // header = row 1

  for (const raw of rows) {
    rowNum += 1;
    const r = rowMap(raw);
    if (!r.destination && !r.guestname && !r.phonenumber && !r.tripid) continue; // blank row
    try {
      const destinations = await resolveDestinations(r.destination, destCache);
      const children = String(r.children || '')
        .split(/[,;]/).map((s) => s.trim()).filter(Boolean)
        .map((a) => ({ age: Number(a) || 0 }));
      const phones = r.phonenumber
        ? [{ countryCode: '91', number: String(r.phonenumber).trim(), isPrimary: true }]
        : [];
      const q = await Query.create({
        source: req.body.source || undefined,
        owner: req.body.owner || req.user._id,
        createdBy: req.user._id,
        referenceId: r.tripid ? String(r.tripid).trim() : undefined,
        destinations,
        startDate: parseCsvDate(r.startdate),
        nights: Number(r.noofnights) || 0,
        pax: { adults: Number(r.noofadults) || 1, children },
        guest: {
          name: r.guestname ? String(r.guestname).trim() : undefined,
          email: r.email ? String(r.email).trim() : undefined,
          phones,
        },
        comments: r.comments ? String(r.comments).trim() : undefined,
      });
      createdNumbers.push(q.queryNumber);
    } catch (e) {
      errors.push({ row: rowNum, error: e.message });
    }
  }

  return ok(res, { created: createdNumbers.length, queryNumbers: createdNumbers, errors, totalRows: rows.length });
});

// PUT /api/queries/:id
export const updateQuery = asyncHandler(async (req, res) => {
  const item = await Query.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate(POPULATE);
  if (!item) throw ApiError.notFound('Query not found');
  return ok(res, item);
});

// PATCH /api/queries/:id/status
// Lifecycle rules: a query is dropped only *before* conversion; cancelled only *after*.
const BEFORE_CONVERT = ['new_query', 'in_progress'];
const AFTER_CONVERT = ['converted', 'on_trip'];

export const updateStatus = asyncHandler(async (req, res) => {
  const { status, lostReason, reminderOn } = req.body;
  if (!QUERY_STATUS_VALUES.includes(status)) {
    throw ApiError.badRequest(`Unknown status: ${status}`);
  }

  const current = await Query.findById(req.params.id);
  if (!current) throw ApiError.notFound('Query not found');

  if (status === 'dropped' && !BEFORE_CONVERT.includes(current.status)) {
    throw ApiError.badRequest('A query can only be dropped before it is converted.');
  }
  if (status === 'canceled' && !AFTER_CONVERT.includes(current.status)) {
    throw ApiError.badRequest('A trip can only be cancelled after it is converted.');
  }

  const update = { status };
  if (['canceled', 'dropped'].includes(status) && lostReason) update.lostReason = lostReason;
  if (reminderOn !== undefined) update.reminderOn = reminderOn || undefined;
  const item = await Query.findByIdAndUpdate(req.params.id, update, { new: true }).populate(
    POPULATE
  );
  if (current.status !== status) {
    await logActivity(item._id, req.user._id, `updated stage from ${LABEL[current.status] || current.status} to ${LABEL[status] || status}`, 'stage');
  }
  return ok(res, item);
});

// DELETE /api/queries/:id  (admin/manager)
export const deleteQuery = asyncHandler(async (req, res) => {
  const item = await Query.findByIdAndDelete(req.params.id);
  if (!item) throw ApiError.notFound('Query not found');
  return ok(res, { id: req.params.id });
});
