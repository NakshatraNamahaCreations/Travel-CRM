// Fine-grained permission catalog layered on top of roles.
//
// Each user's effective permission for a key is resolved as:
//   1. explicit per-user override (user.permissionOverrides[key], true/false) — wins if set
//   2. otherwise the role default (see ROLE_DEFAULTS / SUPER_ROLES below)
//
// The role defaults below intentionally mirror the pre-permission route
// `authorize(...)` lists, so turning the system on does not change any
// existing access — admins simply gain the ability to grant/revoke per user.

export const PERMISSION_MODULES = [
  { key: 'trips', label: 'Trips / Queries', actions: ['create', 'edit', 'delete'] },
  { key: 'bookings', label: 'Bookings', actions: ['create', 'cancel'] },
  { key: 'payments', label: 'Payments', actions: ['create', 'cancel'] },
  { key: 'hotels', label: 'Hotels & Hotel Prices', actions: ['create', 'edit', 'delete'] },
  { key: 'transport', label: 'Transport & Prices', actions: ['create', 'edit', 'delete'] },
  { key: 'activities', label: 'Activities & Prices', actions: ['create', 'edit', 'delete'] },
  { key: 'users', label: 'Users', actions: ['create', 'edit'] },
];

export const ACTION_LABELS = {
  create: 'Create / Add',
  edit: 'Edit',
  delete: 'Delete',
  cancel: 'Cancel / Delete',
};

export const ALL_PERMISSIONS = PERMISSION_MODULES.flatMap((m) =>
  m.actions.map((a) => `${m.key}.${a}`)
);

// Roles that implicitly hold every permission.
export const SUPER_ROLES = ['admin', 'manager'];

// Baseline grants for the remaining roles (mirrors previous route authorize lists).
const BASE = ['trips.create', 'trips.edit', 'bookings.create'];
export const ROLE_DEFAULTS = {
  sales: [...BASE],
  operations: [
    ...BASE,
    'hotels.create', 'hotels.edit', 'hotels.delete',
    'transport.create', 'transport.edit', 'transport.delete',
    'activities.create', 'activities.edit', 'activities.delete',
  ],
  accounts: [...BASE, 'payments.create', 'payments.cancel'],
};

export function roleDefaults(role) {
  if (SUPER_ROLES.includes(role)) return ALL_PERMISSIONS;
  return ROLE_DEFAULTS[role] || [];
}

// Reads an override from either a Mongoose Map or a plain object.
function readOverride(overrides, key) {
  if (!overrides) return undefined;
  if (typeof overrides.get === 'function') return overrides.get(key);
  return overrides[key];
}

export function userCan(user, key) {
  if (!user) return false;
  const ov = readOverride(user.permissionOverrides, key);
  if (ov !== undefined && ov !== null) return !!ov;
  return roleDefaults(user.role).includes(key);
}

// Flat list of every permission this user effectively holds (sent to the client).
export function effectivePermissions(user) {
  return ALL_PERMISSIONS.filter((k) => userCan(user, k));
}
