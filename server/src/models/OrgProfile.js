import mongoose from 'mongoose';
import { company } from '../config/company.js';

// Singleton organization profile — the editable version of the static company
// config. Seeded from config on first read; documents that render seller /
// bank blocks (e.g. proforma invoices) read from here so admins can update
// details without a code change.
const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true },
    address: { type: String, trim: true }, // multiline
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    gstin: { type: String, trim: true }, // billing addresses only
    primary: { type: Boolean, default: false },
  },
  { _id: true }
);

const bankAccountSchema = new mongoose.Schema(
  {
    holder: { type: String, trim: true },
    bank: { type: String, trim: true },
    branch: { type: String, trim: true },
    ifsc: { type: String, trim: true },
    accNo: { type: String, trim: true },
    currency: { type: String, trim: true, default: 'INR' },
  },
  { _id: true }
);

const orgProfileSchema = new mongoose.Schema(
  {
    officialName: { type: String, trim: true },
    brandName: { type: String, trim: true },
    supportPhones: [{ type: String, trim: true }],
    emails: [{ type: String, trim: true }],
    website: { type: String, trim: true },
    brandPrefixCode: { type: String, trim: true },
    colorTheme: { type: String, trim: true, default: '#1e56d6' },
    autoLockDays: { type: Number, default: 0 }, // 0 = not active

    // Brand images stored as data URIs (small, downscaled client-side) so
    // they inline directly into generated PDFs with no static hosting.
    images: {
      logo: { type: String },
      headerBanner: { type: String }, // branded PDF header/letterhead
      footerBanner: { type: String }, // branded PDF footer
      headerBannerPlain: { type: String }, // used when Hide Branding is on
      footerBannerPlain: { type: String },
    },
    contactAddresses: [addressSchema],
    billingAddresses: [addressSchema],
    bankAccounts: [bankAccountSchema],
  },
  { timestamps: true }
);

// Fetch the singleton, creating it from the static config the first time.
orgProfileSchema.statics.get = async function get() {
  const existing = await this.findOne();
  if (existing) return existing;
  return this.create({
    officialName: company.name,
    brandName: company.name,
    supportPhones: company.phones || [],
    emails: company.emails || [],
    website: company.website || '',
    contactAddresses: [
      { label: 'Address', address: (company.address || []).join('\n'), phone: company.phones?.[0] || '', email: company.emails?.[0] || '', primary: true },
    ],
    billingAddresses: [
      { label: 'Registered Office', address: (company.address || []).join('\n'), phone: company.phones?.[0] || '', email: company.emails?.[0] || '', gstin: company.gstin || '', primary: true },
    ],
    bankAccounts: company.bank
      ? [{ holder: company.bank.holder, bank: company.bank.bank, branch: company.bank.address, ifsc: company.bank.ifsc, accNo: company.bank.accNo, currency: 'INR' }]
      : [],
  });
};

export const OrgProfile = mongoose.model('OrgProfile', orgProfileSchema);
