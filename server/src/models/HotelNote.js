import mongoose from 'mongoose';

// General hotel notes shown on quotations/vouchers (optionally scoped to meal plans / dates).
const hotelNoteSchema = new mongoose.Schema(
  {
    shareWith: { type: String, default: 'Quotation and Voucher' }, // Quotation and Voucher | Quotation | Voucher
    general: { type: Boolean, default: true }, // applies to all hotel combinations
    mealPlans: [{ type: String, trim: true }],
    dateRange: { start: { type: Date }, end: { type: Date } },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

hotelNoteSchema.set('toJSON', { virtuals: true });
export const HotelNote = mongoose.model('HotelNote', hotelNoteSchema);
