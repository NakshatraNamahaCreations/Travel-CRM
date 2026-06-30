import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/apiResponse.js';
import { signToken, setAuthCookie } from '../utils/token.js';
import { effectivePermissions } from '../config/permissions.js';

// Serialises a user doc with its resolved permission list for the client.
const withPermissions = (user) => ({
  ...user.toJSON(),
  permissions: effectivePermissions(user),
});

// POST /api/auth/register
// First-ever user becomes admin; afterwards only admins create users (enforced in routes).
export const register = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const exists = await User.findOne({ email });
  if (exists) throw ApiError.conflict('Email already registered');

  const userCount = await User.estimatedDocumentCount();
  const role = userCount === 0 ? 'admin' : req.body.role || 'sales';

  const user = await User.create({ ...req.body, role });
  const token = signToken(user);
  setAuthCookie(res, token);
  return created(res, { user: withPermissions(user), token });
});

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password +isActive');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) throw ApiError.forbidden('Account disabled');

  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user);
  setAuthCookie(res, token);
  user.password = undefined;
  return ok(res, { user: withPermissions(user), token });
});

// POST /api/auth/logout
export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token');
  return ok(res, { message: 'Logged out' });
});

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('team', 'name');
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
