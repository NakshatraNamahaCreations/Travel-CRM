// Mirror of server/src/config/permissions.js — used to render the per-user
// permission matrix and to compute the role default for each checkbox.
// Keep this in sync with the server catalog.

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
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  cancel: 'Cancel',
};

export const ALL_PERMISSIONS = PERMISSION_MODULES.flatMap((m) =>
  m.actions.map((a) => `${m.key}.${a}`)
);

export const SUPER_ROLES = ['admin', 'manager'];

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

// Whether a role grants a permission by default (before per-user overrides).
export function roleDefaultGranted(role, key) {
  if (SUPER_ROLES.includes(role)) return true;
  return (ROLE_DEFAULTS[role] || []).includes(key);
}
