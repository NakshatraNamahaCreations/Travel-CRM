import mongoose from 'mongoose';
import { Counter } from './Counter.js';
import { QUERY_STATUS_VALUES } from '../constants/queryStatus.js';

const childSchema = new mongoose.Schema({ age: { type: Number, min: 0, max: 17 } }, { _id: false });

const phoneSchema = new mongoose.Schema(
  {
    countryCode: { type: String, default: '91' },
    number: { type: String, required: true, trim: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const guestSchema = new mongoose.Schema(
  {
    salutation: { type: String, trim: true },
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    location: { type: String, trim: true }, // origin city/state
    nationality: { type: String, trim: true },
    phones: [phoneSchema],
  },
  { _id: false }
);

const querySchema = new mongoose.Schema(
  {
    queryNumber: { type: Number, unique: true, index: true },

    // Source block
    source: { type: mongoose.Schema.Types.ObjectId, ref: 'QuerySource' },
    referenceId: { type: String, trim: true },
    salesTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],

    // Destination & duration
    destinations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Destination' }],
    startDate: { type: Date },
    nights: { type: Number, default: 1, min: 0 },
    pax: {
      adults: { type: Number, default: 1, min: 1 },
      children: [childSchema],
    },
    foc: { type: Number, default: 0, min: 0 }, // free-of-cost pax

    // Guest
    guest: { type: guestSchema, default: () => ({}) },

    comments: { type: String, trim: true },

    // Pipeline
    status: { type: String, enum: QUERY_STATUS_VALUES, default: 'new_query', index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, // assigned salesperson
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Financials (populated as the query progresses through quote/booking)
    quotedAmount: { type: Number, default: 0 },
    bookedAmount: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },

    lostReason: { type: String, trim: true },
    reminderOn: { type: Date }, // contact reminder for postponed / rescheduled leads
  },
  { timestamps: true }
);

// Derived: total nights/days label, total pax
querySchema.virtual('days').get(function () {
  return (this.nights || 0) + 1;
});
querySchema.virtual('totalPax').get(function () {
  return (this.pax?.adults || 0) + (this.pax?.children?.length || 0);
});

// Assign a human-friendly sequential query number on first save (starts at 1 → shown as 0001).
querySchema.pre('save', async function assignNumber(next) {
  if (this.isNew && !this.queryNumber) {
    this.queryNumber = await Counter.next('query', 1);
  }
  next();
});

querySchema.set('toJSON', { virtuals: true });
querySchema.set('toObject', { virtuals: true });

// Helpful compound index for the pipeline list (status + recency).
querySchema.index({ status: 1, createdAt: -1 });

export const Query = mongoose.model('Query', querySchema);
