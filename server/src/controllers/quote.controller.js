import { Quote } from '../models/Quote.js';
import { Query } from '../models/Query.js';
import { InclusionExclusion } from '../models/InclusionExclusion.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/apiResponse.js';
import { quotationHtml } from '../pdf/quotationHtml.js';
import { htmlToPdf } from '../pdf/renderPdf.js';
import { sendMail, emailEnabled } from '../utils/mailer.js';
import { company } from '../config/company.js';
import { logActivity } from './activity.controller.js';

const POPULATE = [
  { path: 'days.destination', select: 'name' },
  { path: 'createdBy', select: 'name' },
];

// Reflect a quote's value onto its parent query for the pipeline/reports.
async function syncQuery(queryId) {
  const latest = await Quote.findOne({ query: queryId }).sort('-createdAt');
  const accepted = await Quote.findOne({ query: queryId, status: 'accepted' }).sort('-updatedAt');
  await Query.findByIdAndUpdate(queryId, {
    quotedAmount: latest?.pricing?.total || 0,
    ...(accepted
      ? { bookedAmount: accepted.pricing.total, profit: accepted.pricing.markup || 0 }
      : { bookedAmount: 0, profit: 0 }),
  });
}

// GET /api/quotes?query=<id>
export const listQuotes = asyncHandler(async (req, res) => {
  if (!req.query.query) throw ApiError.badRequest('query id is required');
  const quotes = await Quote.find({ query: req.query.query }).sort('-createdAt');
  return ok(res, quotes);
});

// GET /api/quotes/suggestions?search=&exclude=<queryId>&limit=
// Recent quotes across all trips, used as starting points for a new quote.
// search matches trip number or guest name.
export const quoteSuggestions = asyncHandler(async (req, res) => {
  const { search, exclude } = req.query;
  const limit = Math.min(Number(req.query.limit) || 6, 20);

  const filter = {};
  if (exclude) filter.query = { $ne: exclude };
  if (search?.trim()) {
    const term = search.trim();
    const or = [{ 'guest.name': new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }];
    const num = Number(term.replace(/\D/g, ''));
    if (num) or.push({ queryNumber: num });
    const matches = await Query.find({ $or: or }).select('_id').limit(100);
    filter.query = { ...(filter.query || {}), $in: matches.map((q) => q._id) };
  }

  const quotes = await Quote.find(filter)
    .sort('-createdAt')
    .limit(limit)
    .populate({ path: 'query', select: 'queryNumber guest destinations nights', populate: { path: 'destinations', select: 'name' } });
  return ok(res, quotes);
});

// POST /api/quotes/:id/clone  { query: <target trip id> }
// Copies an existing quote onto another trip as a fresh draft.
export const cloneQuote = asyncHandler(async (req, res) => {
  const source = await Quote.findById(req.params.id);
  if (!source) throw ApiError.notFound('Source quote not found');
  const target = await Query.findById(req.body.query);
  if (!target) throw ApiError.badRequest('Target trip not found');

  const src = source.toObject();
  // Drop subdocument _ids so Mongoose assigns fresh ones on the copy.
  const stripIds = (v) => JSON.parse(JSON.stringify(v, (k, val) => (k === '_id' ? undefined : val)));

  const quote = await Quote.create({
    query: target._id,
    title: src.title,
    currency: src.currency || target.currency || 'INR',
    startDate: target.startDate || src.startDate,
    nights: target.nights ?? src.nights,
    pax: target.pax || src.pax,
    packages: stripIds(src.packages || []),
    pricingStrategy: src.pricingStrategy,
    totalFoc: src.totalFoc,
    selectedPackageIndex: src.selectedPackageIndex,
    inclusions: src.inclusions,
    exclusions: src.exclusions,
    terms: src.terms,
    createdBy: req.user._id,
  });
  await syncQuery(target._id);
  await logActivity(target._id, req.user._id, `created quote from suggestion #${src.quoteNumber}`, 'quote');
  if (target.status === 'new_query') {
    await Query.findByIdAndUpdate(target._id, { status: 'in_progress' });
    await logActivity(target._id, req.user._id, 'updated stage from New Query to In Progress', 'stage');
  }
  return created(res, quote);
});

// GET /api/quotes/:id
export const getQuote = asyncHandler(async (req, res) => {
  const quote = await Quote.findById(req.params.id)
    .populate(POPULATE)
    .populate({ path: 'query', select: 'queryNumber guest destinations nights startDate pax', populate: { path: 'destinations', select: 'name' } });
  if (!quote) throw ApiError.notFound('Quote not found');
  return ok(res, quote);
});

// POST /api/quotes
export const createQuote = asyncHandler(async (req, res) => {
  const query = await Query.findById(req.body.query);
  if (!query) throw ApiError.badRequest('Parent query not found');

  const quote = await Quote.create({
    ...req.body,
    createdBy: req.user._id,
    // Snapshot trip basics from the query if not supplied
    startDate: req.body.startDate || query.startDate,
    nights: req.body.nights ?? query.nights,
    pax: req.body.pax || query.pax,
    currency: req.body.currency || query.currency || 'INR',
  });
  await syncQuery(query._id);
  await logActivity(query._id, req.user._id, `gave quote with ${quote.currency} ${(quote.pricing?.total || 0).toLocaleString('en-IN')}`, 'quote');
  // Building the first quotation moves a brand-new lead into the In Progress stage.
  if (query.status === 'new_query') {
    await Query.findByIdAndUpdate(query._id, { status: 'in_progress' });
    await logActivity(query._id, req.user._id, 'updated stage from New Query to In Progress', 'stage');
  }
  return created(res, quote);
});

// PUT /api/quotes/:id
export const updateQuote = asyncHandler(async (req, res) => {
  const quote = await Quote.findById(req.params.id);
  if (!quote) throw ApiError.notFound('Quote not found');

  // Assign fields then save() so pre-validate pricing hook runs.
  const fields = [
    'title', 'currency', 'startDate', 'nights', 'pax', 'days', 'costItems',
    'markupType', 'markupValue', 'taxPercent', 'inclusions', 'exclusions', 'terms', 'status',
    'packages', 'pricingStrategy', 'totalFoc', 'selectedPackageIndex', 'daysCustomized',
  ];
  for (const f of fields) if (req.body[f] !== undefined) quote[f] = req.body[f];
  await quote.save();
  await syncQuery(quote.query);
  return ok(res, quote);
});

// PATCH /api/quotes/:id/status
export const updateQuoteStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['draft', 'sent', 'accepted', 'rejected'].includes(status)) {
    throw ApiError.badRequest('Invalid status');
  }
  const quote = await Quote.findById(req.params.id);
  if (!quote) throw ApiError.notFound('Quote not found');
  quote.status = status;
  await quote.save();

  // Accepting a quote converts the query. Only one quote per trip can be
  // accepted — demote any previously accepted quote back to 'sent'.
  if (status === 'accepted') {
    await Quote.updateMany({ query: quote.query, _id: { $ne: quote._id }, status: 'accepted' }, { status: 'sent' });
    await Query.findByIdAndUpdate(quote.query, { status: 'converted' });
  }
  await syncQuery(quote.query);
  return ok(res, quote);
});

// Load a quote fully populated for the PDF / email.
async function loadFullQuote(id) {
  const quote = await Quote.findById(id)
    .populate(POPULATE)
    .populate({ path: 'query', select: 'queryNumber guest destinations nights startDate pax', populate: { path: 'destinations', select: 'name' } })
    .populate({ path: 'packages.hotels.hotel', select: 'name imageUrl detailsLink address notes stars' })
    .populate({ path: 'packages.transports.service', select: 'startCity endCity imageUrl items.name items.description items.imageUrl' })
    .populate({ path: 'packages.activities.activity', select: 'name imageUrl details ticketTypes.name ticketTypes.details' });
  if (!quote) throw ApiError.notFound('Quote not found');
  // Fill dynamic defaults from the Inclusions/Exclusions master when the quote
  // has no lists of its own (config defaults remain the last-resort fallback).
  if (!quote.inclusions?.length || !quote.exclusions?.length) {
    const items = await InclusionExclusion.find({ isActive: { $ne: false } }).sort('order createdAt').lean();
    if (items.length) {
      if (!quote.inclusions?.length) quote.inclusions = items.filter((i) => i.type === 'inclusion').map((i) => i.text);
      if (!quote.exclusions?.length) quote.exclusions = items.filter((i) => i.type === 'exclusion').map((i) => i.text);
    }
  }
  return quote;
}

// GET /api/quotes/:id/pdf — server-rendered PDF (inline download)
export const quotePdf = asyncHandler(async (req, res) => {
  const quote = await loadFullQuote(req.params.id);
  const pdf = await htmlToPdf(quotationHtml(quote.toObject()));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Quotation-${quote.quoteNumber}.pdf"`);
  return res.send(pdf);
});

// GET /api/quotes/email-status — whether SMTP is configured
export const emailStatus = asyncHandler(async (req, res) => ok(res, { enabled: emailEnabled() }));

// POST /api/quotes/:id/email — email the quotation PDF to the guest
export const emailQuote = asyncHandler(async (req, res) => {
  const quote = await loadFullQuote(req.params.id);
  const obj = quote.toObject();
  const to = req.body.email || obj.query?.guest?.email;
  if (!to) throw ApiError.badRequest('No recipient — guest has no email on file and none was provided');

  const pdf = await htmlToPdf(quotationHtml(obj));
  const guestName = [obj.query?.guest?.salutation, obj.query?.guest?.name].filter(Boolean).join(' ') || 'Guest';
  await sendMail({
    to,
    subject: `Your Andaman Tour Quotation #${quote.quoteNumber} — ${company.name}`,
    html: `<p>Dear ${guestName},</p>
      <p>Thank you for your interest! Please find attached your tour quotation <b>#${quote.quoteNumber}</b>${obj.title ? ` (${obj.title})` : ''} totalling <b>₹${(obj.pricing?.total || 0).toLocaleString('en-IN')}</b>.</p>
      <p>To confirm your booking, a ${company.advancePercent}% advance is payable. We'd love to host you in the Andamans!</p>
      <p>Warm regards,<br/>${company.name}<br/>${company.phones[0]} · ${company.emails[0]}</p>`,
    attachments: [{ filename: `Quotation-${quote.quoteNumber}.pdf`, content: pdf }],
  });

  quote.status = 'sent';
  await quote.save();
  return ok(res, { sent: true, to, quoteNumber: quote.quoteNumber });
});

// DELETE /api/quotes/:id
export const deleteQuote = asyncHandler(async (req, res) => {
  const quote = await Quote.findByIdAndDelete(req.params.id);
  if (!quote) throw ApiError.notFound('Quote not found');
  await syncQuery(quote.query);
  return ok(res, { id: req.params.id });
});
