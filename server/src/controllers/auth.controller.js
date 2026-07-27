import { User } from '../models/User.js';
import { Organization } from '../models/Organization.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/apiResponse.js';
import { signToken, setAuthCookie } from '../utils/token.js';
import { effectivePermissions } from '../config/permissions.js';
import { assertOrgAccess } from '../middleware/auth.js';

// Serialises a user doc with its resolved permission list for the client.
const withPermissions = (user) => ({
  ...user.toJSON(),
  permissions: effectivePermissions(user),
});

// There is no public registration. Tenant companies are created by the
// platform owner (POST /api/owner/organizations); the owner account itself is
// bootstrapped via `npm run bootstrap:owner`.

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password +isActive');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) throw ApiError.forbidden('Account disabled');

  if (user.role !== 'owner') {
    const org = await Organization.findById(user.organization).select('isActive subscription');
    assertOrgAccess(org);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user);
  setAuthCookie(res, token);
  user.password = undefined;
  if (user.organization) await user.populate('organization', 'name isActive subscription');
  return ok(res, { user: withPermissions(user), token });
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token');
  return ok(res, { message: 'Logged out' });
});

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate('team', 'name')
    .populate('organization', 'name isActive subscription');
  return ok(res, { user: withPermissions(user) });
});

// PATCH /api/auth/profile — update own name/phone, and optionally change password.
export const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!user) throw ApiError.notFound('User not found');

  const { name, phone, currentPassword, newPassword } = req.body;
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;

  if (newPassword) {
    if (!currentPassword || !(await user.comparePassword(currentPassword))) {
      throw ApiError.badRequest('Current password is incorrect');
    }
    user.password = newPassword; // re-hashed by pre-save hook
  }

  await user.save();
  user.password = undefined;
  return ok(res, { user });
});
