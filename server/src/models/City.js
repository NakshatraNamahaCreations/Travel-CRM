import mongoose from 'mongoose';

const citySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    state: { type: mongoose.Schema.Types.ObjectId, ref: 'State', index: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

citySchema.index({ name: 'text' });
citySchema.set('toJSON', { virtuals: true });

export const City = mongoose.model('City', citySchema);
