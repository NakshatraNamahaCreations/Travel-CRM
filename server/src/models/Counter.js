import mongoose from 'mongoose';

// Atomic sequence generator for human-friendly IDs (query numbers, invoice numbers...).
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // sequence key, e.g. 'query'
  seq: { type: Number, default: 0 },
});

counterSchema.statics.next = async function next(key, start = 0) {
  const doc = await this.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  // If a brand-new counter and a start floor is given, jump to it.
  if (doc.seq === 1 && start) {
    const bumped = await this.findByIdAndUpdate(key, { seq: start }, { new: true });
    return bumped.seq;
  }
  return doc.seq;
};

export const Counter = mongoose.model('Counter', counterSchema);
