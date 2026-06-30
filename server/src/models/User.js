import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['admin', 'manager', 'sales', 'operations', 'accounts'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ROLES, default: 'sales', index: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', index: true },
    // Per-user permission overrides: { 'payments.cancel': false, 'trips.create': true }.
    // Unset keys fall back to the role default. See config/permissions.js.
    permissionOverrides: { type: Map, of: Boolean, default: undefined },
    avatarUrl: { type: String },
    isActive: { type: Boolean, default: true, select: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Strip sensitive fields from JSON output
userSchema.set('toJSON', {
  virtuals: true,
  transform(doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
