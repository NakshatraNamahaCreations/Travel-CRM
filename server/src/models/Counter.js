import mongoose from 'mongoose';

// Atomic sequence generator for human-friendly IDs (query numbers, invoice numbers...).
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // sequence key, e.g. 'query'
  seq: { type: Number, default: 0 },
});

counterSchema.statics.next = async function next(key, start = 1) {
  // Single atomic operation: increment by 1, but never go below `start`.
  // Uses MongoDB 4.2+ aggregation pipeline update — no race window.
  const floor = Math.max(start - 1, 0);
  const doc = await this.findOneAndUpdate(
    { _id: key },
    [{ $set: { seq: { $add: [{ $max: [{ $ifNull: ['$seq', floor] }, floor] }, 1] } } }],
    { new: true, upsert: true }
  );
  return doc.seq;
};

export const Counter = mongoose.model('Counter', counterSchema);
