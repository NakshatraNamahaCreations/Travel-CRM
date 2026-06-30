import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/User.js';
import { userCan } from '../config/permissions.js';

// Verifies the Bearer token (or auth cookie) and attaches req.user.
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

  const user = await User.findById(decoded.sub).select('+isActive');
  if (!user || !user.isActive) throw ApiError.unauthorized('Account not found or disabled');

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
