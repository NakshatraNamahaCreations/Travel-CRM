import mongoose from 'mongoose';

const stateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    country: { type: String, trim: true, default: 'India' },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

stateSchema.index({ name: 'text' });
stateSchema.set('toJSON', { virtuals: true });

export const State = mongoose.model('State', stateSchema);
