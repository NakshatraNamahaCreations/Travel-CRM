import mongoose from 'mongoose';

// Master list of default inclusion / exclusion lines shown on quotations.
// Quotes can still override with their own lists; these are the defaults.
const inclusionExclusionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    type: { type: String, enum: ['inclusion', 'exclusion'], required: true, index: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

inclusionExclusionSchema.set('toJSON', { virtuals: true });

export const InclusionExclusion = mongoose.model('InclusionExclusion', inclusionExclusionSchema);
