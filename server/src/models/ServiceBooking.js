import mongoose from 'mongoose';

// A single bookable service line within a trip (one hotel stay or one operational
// service). Created from the accepted quote, then worked through a status workflow
// with its own price, tag and comments.
export const SERVICE_BOOKING_KINDS = ['hotel', 'operational'];
export const SERVICE_BOOKING_STATUSES = ['initialized', 'booked', 'confirmed', 'cancelled'];

const serviceBookingSchema = new mongoose.Schema(
  {
    query: { type: mongoose.Schema.Types.ObjectId, ref: 'Query', required: true, index: true },
    quote: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote' },
    kind: { type: String, enum: SERVICE_BOOKING_KINDS, required: true, index: true },

    // Display snapshot (copied from the quote at generation time).
    name: { type: String, trim: true }, // hotel name / service title / flight label
    city: { type: String, trim: true },
    stars: { type: Number },
    roomType: { type: String, trim: true },
    mealPlan: { type: String, trim: true },
    rooms: { type: Number },
    aweb: { type: Number, default: 0 },
    cweb: { type: Number, default: 0 },
    nights: [{ type: Number }],
    checkIn: { type: Date },
    checkOut: { type: Date },
    detail: { type: String, trim: true }, // free-text "Stay and Services" breakdown

    status: { type: String, enum: SERVICE_BOOKING_STATUSES, default: 'initialized', index: true },
    price: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    tag: { type: String, trim: true },
    comment: { type: String, trim: true },

    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

serviceBookingSchema.set('toJSON', { virtuals: true });

export const ServiceBooking = mongoose.model('ServiceBooking', serviceBookingSchema);
