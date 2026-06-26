import mongoose from 'mongoose';

const tagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, lowercase: true },
    color: { type: String, default: '#64748b' },
  },
  { timestamps: true }
);

tagSchema.set('toJSON', { virtuals: true });

export const Tag = mongoose.model('Tag', tagSchema);
