import mongoose from 'mongoose';
import { Counter } from './Counter.js';

const guestSnap = new mongoose.Schema(
  {
    salutation: String,
    name: String,
    email: String,
    location: String,
    phones: [{ countryCode: String, number: String, isPrimary: Boolean }],
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    bookingNumber: { type: Number, unique: true, index: true },
    query: { type: mongoose.Schema.Types.ObjectId, ref: 'Query', index: true },
    quote: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote' },

    title: { type: String, trim: true },
    guest: guestSnap,
    destinations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Destination' }],

    startDate: { type: Date },
    endDate: { type: Date },
    nights: { type: Number, default: 0 },
    pax: { adults: Number, children: [{ age: Number }] },

    status: {
      type: String,
      enum: ['confirmed', 'on_trip', 'completed', 'cancelled'],
      default: 'confirmed',
      index: true,
    },

    // Itinerary + cost snapshot copied from the accepted quote.
    days: [{ dayNumber: Number, date: Date, title: String, description: String }],
    costItems: [{ category: String, label: String, meta: String, qty: Number, rate: Number, amount: Number }],

    currency: { type: String, default: 'INR' },
    totalAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 }, // maintained by the accounting module
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

bookingSchema.virtual('balanceDue').get(function () {
  return Math.round(Math.max(0, (this.totalAmount || 0) - (this.paidAmount || 0)) * 100) / 100;
});
bookingSchema.virtual('days_count').get(function () {
  return (this.nights || 0) + 1;
});

bookingSchema.pre('validate', function computeEnd(next) {
  if (this.startDate && this.nights != null && !this.endDate) {
    const end = new Date(this.startDate);
    end.setDate(end.getDate() + this.nights);
    this.endDate = end;
  }
  next();
});

bookingSchema.pre('save', async function assignNumber(next) {
  if (this.isNew && !this.bookingNumber) {
    this.bookingNumber = await Counter.next('booking', 7100000);
  }
  next();
});

bookingSchema.set('toJSON', { virtuals: true });
bookingSchema.set('toObject', { virtuals: true });

export const Booking = mongoose.model('Booking', bookingSchema);
