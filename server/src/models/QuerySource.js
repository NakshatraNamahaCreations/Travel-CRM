import mongoose from 'mongoose';

// Where a lead came from: Website, B2B, WhatsApp, Referral, Walk-in, etc.
const querySourceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

querySourceSchema.set('toJSON', { virtuals: true });

export const QuerySource = mongoose.model('QuerySource', querySourceSchema);
