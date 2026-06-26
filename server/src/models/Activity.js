import mongoose from 'mongoose';

// Lightweight audit trail of notable actions on a query/trip (stage changes, quotes, etc.).
const activitySchema = new mongoose.Schema(
  {
    query: { type: mongoose.Schema.Types.ObjectId, ref: 'Query', required: true, index: true },
    type: { type: String, trim: true }, // 'created' | 'stage' | 'quote' | 'booking' | 'team' | 'note'
    message: { type: String, required: true, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

activitySchema.set('toJSON', { virtuals: true });

export const Activity = mongoose.model('Activity', activitySchema);
