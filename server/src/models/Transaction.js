import mongoose from 'mongoose';
import crypto from 'crypto';

// A double-entry transaction: amount moves from debitAccount to creditAccount.
const transactionSchema = new mongoose.Schema(
  {
    txnId: { type: String, unique: true, index: true }, // short human code, e.g. FA0F0521
    date: { type: Date, default: Date.now, index: true },
    debitAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    creditAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    refId: { type: String, trim: true }, // external reference (UTR / settlement id)
    narration: { type: String, trim: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    tripId: { type: Number },
    source: { type: String, enum: ['manual', 'system', 'gateway'], default: 'manual' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

transactionSchema.pre('validate', function assignTxnId(next) {
  if (!this.txnId) this.txnId = crypto.randomBytes(4).toString('hex').toUpperCase();
  next();
});

transactionSchema.set('toJSON', { virtuals: true });

export const Transaction = mongoose.model('Transaction', transactionSchema);
