import mongoose from 'mongoose';

// Owner-defined subscription plans (Basic / Pro ...). Platform-level data —
// NOT tenant-scoped. Billing is manual: the owner records offline payments
// against an organization and the plan only drives the default duration/price.
const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    price: { type: Number, default: 0 },
    durationMonths: { type: Number, default: 1, min: 1 },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Plan = mongoose.model('Plan', planSchema);
