import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { userCan } from '../config/permissions.js';

// Throws when a tenant organization must not be served: suspended by the
// platform owner, or its subscription has lapsed. Shared by `protect` and the
// login flow so lockout applies both to existing sessions and new logins.
export function assertOrgAccess(org) {
  if (!org || !org.isActive) {
    throw ApiError.forbidden('Your organization is suspended. Contact support.', 'ORG_SUSPENDED');
  }
  const exp = org.subscription?.expiresAt;
  if (exp && exp.getTime() < Date.now()) {
    throw ApiError.forbidden('Your subscription has expired. Contact support to renew.', 'SUBSCRIPTION_EXPIRED');
  }
}

// Verifies the Bearer token (or auth cookie) and attaches req.user.
// For tenant users the organization is loaded and verified (active +
// subscription not expired) on every request, so owner-side suspension takes
// effect immediately.
export const protect = asyncHandler(async (req, res, next) => {
  let token;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) throw ApiError.unauthorized('Not authenticated');

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  // No tenant context exists yet at this point, so this lookup is unscoped by
  // design; the _id filter is sufficient.
  const user = await User.findById(decoded.sub).select('+isActive');
  if (!user || !user.isActive) throw ApiError.unauthorized('Account not found or disabled');

  if (user.role !== 'owner') {
    const org = await Organization.findById(user.organization).select('isActive subscription');
    assertOrgAccess(org);
    req.organizationId = user.organization;
  }

  req.user = user;
  next();
});

// Restricts a route to one or more roles. Usage: authorize('admin', 'manager')
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`));
    }
    next();
  };

// Restricts a route to users holding a fine-grained permission key.
// Usage: can('payments.cancel'). Resolves role defaults + per-user overrides.
export const can =
  (key) =>
  (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!userCan(req.user, key)) {
      return next(ApiError.forbidden(`You don't have permission to perform this action (${key})`));
    }
    next();
  };
