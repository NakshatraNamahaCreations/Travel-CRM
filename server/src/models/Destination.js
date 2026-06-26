import mongoose from 'mongoose';

const destinationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    country: { type: String, trim: true, default: 'India' },
    region: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

destinationSchema.index({ name: 'text' });
destinationSchema.set('toJSON', { virtuals: true });

export const Destination = mongoose.model('Destination', destinationSchema);
