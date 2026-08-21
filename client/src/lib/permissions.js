// Mirror of server/src/config/permissions.js — used to render the per-user
// permission matrix and to compute the role default for each checkbox.
// Keep this in sync with the server catalog.

export const PERMISSION_MODULES = [
  { key: 'trips', label: 'Trips / Queries', actions: ['create', 'edit', 'delete'] },
  { key: 'quotes', label: 'Quotes & Itineraries', actions: ['create', 'edit', 'delete'] },
  { key: 'bookings', label: 'Bookings', actions: ['create', 'cancel'] },
  { key: 'payments', label: 'Payments', actions: ['create', 'cancel'] },
  { key: 'invoices', label: 'Invoices (Proforma / GST)', actions: ['create', 'edit', 'delete'] },
  { key: 'accounting', label: 'Accounts & Transactions', actions: ['create', 'edit', 'delete'] },
  { key: 'hotels', label: 'Hotels & Hotel Prices', actions: ['create', 'edit', 'delete'] },
  { key: 'transport', label: 'Transport & Prices', actions: ['create', 'edit', 'delete'] },
  { key: 'activities', label: 'Activities & Prices', actions: ['create', 'edit', 'delete'] },
  { key: 'masterdata', label: 'Destinations, Cities, Tags & Sources', actions: ['create', 'edit', 'delete'] },
  { key: 'teams', label: 'Teams', actions: ['create', 'edit', 'delete'] },
  { key: 'settings', label: 'Organization Profile', actions: ['edit'] },
  { key: 'imports', label: 'Excel Imports', actions: ['create'] },
  { key: 'users', label: 'Users', actions: ['create', 'edit', 'delete'] },
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

const BASE = [
  'trips.create', 'trips.edit', 'bookings.create',
  'quotes.create', 'quotes.edit',
];
export const ROLE_DEFAULTS = {
  sales: [...BASE],
  operations: [
    ...BASE,
    'hotels.create', 'hotels.edit', 'hotels.delete',
    'transport.create', 'transport.edit', 'transport.delete',
    'activities.create', 'activities.edit', 'activities.delete',
    'masterdata.create', 'masterdata.edit',
    'imports.create',
  ],
  accounts: [
    ...BASE,
    'payments.create', 'payments.cancel',
    'invoices.create', 'invoices.edit', 'invoices.delete',
    'accounting.create', 'accounting.edit', 'accounting.delete',
  ],
};

// Whether a role grants a permission by default (before per-user overrides).
export function roleDefaultGranted(role, key) {
  if (SUPER_ROLES.includes(role)) return true;
  return (ROLE_DEFAULTS[role] || []).includes(key);
}
