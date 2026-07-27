import { Organization } from '../models/Organization.js';
import { Plan } from '../models/Plan.js';
import { SubscriptionPayment } from '../models/SubscriptionPayment.js';
import { User } from '../models/User.js';
import { Query } from '../models/Query.js';
import { Booking } from '../models/Booking.js';
import { OrgProfile } from '../models/OrgProfile.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/apiResponse.js';
import { seedMasterData } from '../seed/masterData.js';

// Owner-panel handlers. These run WITHOUT a tenant context (the owner has no
// organization), so tenantPlugin is inert here — every query below passes its
// organization filter explicitly.

const orgSummary = (org, counts = {}) => ({
  ...org.toJSON(),
  subscriptionStatus: org.subscriptionStatus(),
  ...counts,
});

// GET /api/owner/organizations
export const listOrganizations = asyncHandler(async (req, res) => {
  const orgs = await Organization.find().sort('-createdAt');
  const userCounts = await User.aggregate([
    { $match: { organization: { $ne: null } } },
    { $group: { _id: '$organization', users: { $sum: 1 } } },
  ]);
  const byOrg = new Map(userCounts.map((u) => [u._id.toString(), u.users]));
  return ok(res, orgs.map((o) => orgSummary(o, { users: byOrg.get(o._id.toString()) || 0 })));
});

// POST /api/owner/organizations — create a company + its first admin.
export const createOrganization = asyncHandler(async (req, res) => {
  const { name, adminName, adminEmail, adminPassword, planId } = req.body || {};
  if (!name?.trim()) throw ApiError.badRequest('Company name is required');
  if (!adminName?.trim() || !adminEmail?.trim() || !adminPassword) {
    throw ApiError.badRequest('First admin name, email and password are required');
  }

  // Email is globally unique — check before creating anything.
  const emailTaken = await User.findOne({ email: adminEmail.toLowerCase().trim() });
  if (emailTaken) throw ApiError.conflict('Email already registered');

  const nameTaken = await Organization.findOne({ name: name.trim() });
  if (nameTaken) throw ApiError.conflict('A company with this name already exists');

  const subscription = {};
  if (planId) {
    const plan = await Plan.findById(planId);
    if (!plan) throw ApiError.badRequest('Plan not found');
    subscription.plan = plan._id;
    subscription.planName = plan.name;
  }

  const org = await Organization.create({
    name: name.trim(),
    createdBy: req.user._id,
    subscription,
  });

  try {
    const admin = await User.create({
      name: adminName.trim(),
      email: adminEmail.toLowerCase().trim(),
      password: adminPassword,
      role: 'admin',
      organization: org._id,
    });
    await OrgProfile.getFor(org._id); // profile from the config template
    await seedMasterData(org._id); // starter dropdowns / sources / tags
    return created(res, { organization: orgSummary(org, { users: 1 }), admin: admin.toJSON() });
  } catch (err) {
    // Roll back the half-created company so the name is reusable.
    await Organization.deleteOne({ _id: org._id }).catch(() => {});
    await OrgProfile.deleteOne({ organization: org._id }).catch(() => {});
    throw err;
  }
});

// GET /api/owner/organizations/:id
export const getOrganization = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id).populate('subscription.plan', 'name price durationMonths');
  if (!org) throw ApiError.notFound('Organization not found');
  const [users, queries, bookings, payments] = await Promise.all([
    User.find({ organization: org._id }).select('name email role isActive lastLoginAt createdAt').setOptions({ skipTenant: true }),
    Query.countDocuments({ organization: org._id }),
    Booking.countDocuments({ organization: org._id }),
    SubscriptionPayment.find({ organization: org._id }).sort('-paidOn').populate('plan', 'name'),
  ]);
  return ok(res, {
    organization: orgSummary(org, { users: users.length, queries, bookings }),
    users,
    subscriptionPayments: payments,
  });
});

// PATCH /api/owner/organizations/:id — rename / suspend / reactivate.
export const updateOrganization = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id);
  if (!org) throw ApiError.notFound('Organization not found');
  const { name, isActive } = req.body || {};
  if (name !== undefined) {
    if (!name.trim()) throw ApiError.badRequest('Company name cannot be empty');
    org.name = name.trim();
  }
  if (isActive !== undefined) org.isActive = !!isActive;
  await org.save();
  return ok(res, orgSummary(org));
});

// POST /api/owner/organizations/:id/subscription — record an offline payment
// and extend the subscription. Extends from the current expiry while still
// active, from today when lapsed.
export const recordSubscriptionPayment = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id);
  if (!org) throw ApiError.notFound('Organization not found');

  const { planId, months, amount, paidOn, notes } = req.body || {};
  const plan = planId ? await Plan.findById(planId) : null;
  if (planId && !plan) throw ApiError.badRequest('Plan not found');

  const effectiveMonths = Number(months) || plan?.durationMonths || 1;
  if (effectiveMonths < 1) throw ApiError.badRequest('Months must be at least 1');

  const payment = await SubscriptionPayment.create({
    organization: org._id,
    plan: plan?._id,
    planName: plan?.name,
    amount: Number(amount) || plan?.price || 0,
    months: effectiveMonths,
    paidOn: paidOn ? new Date(paidOn) : new Date(),
    notes,
    recordedBy: req.user._id,
  });

  const current = org.subscription?.expiresAt;
  const base = current && current.getTime() > Date.now() ? new Date(current) : new Date();
  base.setMonth(base.getMonth() + effectiveMonths);
  org.subscription = {
    plan: plan?._id || org.subscription?.plan,
    planName: plan?.name || org.subscription?.planName,
    expiresAt: base,
  };
  await org.save();

  return created(res, { organization: orgSummary(org), payment });
});

// ---- Plans ----

// GET /api/owner/plans
export const listPlans = asyncHandler(async (req, res) => ok(res, await Plan.find().sort('price')));

// POST /api/owner/plans
export const createPlan = asyncHandler(async (req, res) => {
  const { name, price, durationMonths, description } = req.body || {};
  if (!name?.trim()) throw ApiError.badRequest('Plan name is required');
  const plan = await Plan.create({ name: name.trim(), price, durationMonths, description });
  return created(res, plan);
});

// PATCH /api/owner/plans/:id
export const updatePlan = asyncHandler(async (req, res) => {
  const plan = await Plan.findById(req.params.id);
  if (!plan) throw ApiError.notFound('Plan not found');
  const { name, price, durationMonths, description, isActive } = req.body || {};
  if (name !== undefined) plan.name = name.trim();
  if (price !== undefined) plan.price = price;
  if (durationMonths !== undefined) plan.durationMonths = durationMonths;
  if (description !== undefined) plan.description = description;
  if (isActive !== undefined) plan.isActive = !!isActive;
  await plan.save();
  return ok(res, plan);
});
