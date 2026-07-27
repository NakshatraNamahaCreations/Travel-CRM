import mongoose from 'mongoose';

// Tenant company. Every tenant-owned document carries an `organization` ref
// (added by tenantPlugin); users belong to exactly one organization except the
// platform owner. Subscription is managed manually by the owner — expiresAt
// null means "never expires" (e.g. the migrated default org until a plan is
// assigned).
const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, trim: true, lowercase: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    subscription: {
      plan: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
      planName: { type: String, trim: true },
      expiresAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

organizationSchema.pre('save', function slugify(next) {
  if (!this.slug && this.name) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  next();
});

// Subscription state helper: 'active' | 'expiring' (≤7 days left) | 'expired'.
organizationSchema.methods.subscriptionStatus = function subscriptionStatus() {
  const exp = this.subscription?.expiresAt;
  if (!exp) return 'active';
  const now = Date.now();
  if (exp.getTime() < now) return 'expired';
  if (exp.getTime() - now <= 7 * 24 * 60 * 60 * 1000) return 'expiring';
  return 'active';
};

export const Organization = mongoose.model('Organization', organizationSchema);
