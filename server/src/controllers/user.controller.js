import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created, paginate } from '../utils/apiResponse.js';
import { ALL_PERMISSIONS } from '../config/permissions.js';

// Keep only known permission keys with explicit boolean values.
function sanitizeOverrides(input) {
  if (!input || typeof input !== 'object') return undefined;
  const out = {};
  for (const key of ALL_PERMISSIONS) {
    if (typeof input[key] === 'boolean') out[key] = input[key];
  }
  return Object.keys(out).length ? out : undefined;
}

// GET /api/users
export const listUsers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.search) {
    const rx = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  if (req.query.role) filter.role = req.query.role;
  if (req.query.team) filter.team = req.query.team;

  const total = await User.countDocuments(filter);
  const meta = paginate(req.query, total);
  const users = await User.find(filter)
    .populate('team', 'name')
    .sort('-createdAt')
    .skip(meta.skip)
    .limit(meta.limit);
  return ok(res, users, meta);
});

// GET /api/users/:id
export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).populate('team', 'name');
  if (!user) throw ApiError.notFound('User not found');
  return ok(res, user);
});

// POST /api/users  (admin/manager)
export const createUser = asyncHandler(async (req, res) => {
  const exists = await User.findOne({ email: req.body.email });
  if (exists) throw ApiError.conflict('Email already registered');
  const user = await User.create({
    ...req.body,
    permissionOverrides: sanitizeOverrides(req.body.permissionOverrides),
  });
  return created(res, user);
});

// PUT /api/users/:id  — password only updated if provided
export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('+password');
  if (!user) throw ApiError.notFound('User not found');

  const { name, phone, role, team, avatarUrl, password, permissionOverrides } = req.body;
  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (role !== undefined) user.role = role;
  if (team !== undefined) user.team = team || undefined;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
  if (password) user.password = password; // re-hashed by pre-save hook
  if (permissionOverrides !== undefined) {
    user.permissionOverrides = sanitizeOverrides(permissionOverrides);
    user.markModified('permissionOverrides');
  }

  await user.save();
  user.password = undefined;
  return ok(res, user);
});

// PATCH /api/users/:id/status  — activate / deactivate
export const setUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive: !!req.body.isActive },
    { new: true }
  );
  if (!user) throw ApiError.notFound('User not found');
  return ok(res, user);
});
