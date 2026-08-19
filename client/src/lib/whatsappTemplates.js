// Catalog of the WhatsApp Business templates used across a trip's lifecycle.
//
// IMPORTANT: `name` must match a template that already exists AND is approved
// in the Gallabox dashboard, and every key in `vars` must match that
// template's {{placeholder}} names exactly — Gallabox rejects the send
// otherwise. `body` here is only the on-screen preview so an agent can see
// what the guest will receive; the real copy lives in Gallabox.
//
// `fill(ctx)` maps our trip data onto those placeholders. ctx is:
//   { query, quote, booking, installment, invoice, org, links }

import { format } from 'date-fns';
import { company } from '../config/company.js';
import { tripNo } from './format.js';

const inr = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const dt = (d) => (d ? format(new Date(d), 'd MMM, yyyy') : '');

const guestName = (q) => [q?.guest?.salutation, q?.guest?.name].filter(Boolean).join(' ') || 'Guest';
const travellers = (q) => {
  const a = q?.pax?.adults || 0;
  const c = q?.pax?.children?.length || 0;
  return `${a} Adult${a === 1 ? '' : 's'}${c ? `, ${c} Child${c === 1 ? '' : 'ren'}` : ''}`;
};
const travelDates = (q, quote) => {
  const start = quote?.startDate || q?.startDate;
  const nights = quote?.nights ?? q?.nights ?? 0;
  if (!start) return 'To be confirmed';
  const end = new Date(start);
  end.setDate(end.getDate() + nights);
  return `${dt(start)} – ${dt(end)}`;
};
const duration = (q, quote) => {
  const n = quote?.nights ?? q?.nights ?? 0;
  return `${n} Night${n === 1 ? '' : 's'} / ${n + 1} Day${n === 1 ? '' : 's'}`;
};
const pkgName = (quote) => quote?.packages?.[quote?.selectedPackageIndex || 0]?.name
  || quote?.packages?.[0]?.name || 'Andaman Holiday Package';
const pkgValue = (quote) => quote?.pricing?.total
  || quote?.packages?.[quote?.selectedPackageIndex || 0]?.sellingPrice || 0;

const hotelSummary = (quote) => {
  const pkg = quote?.packages?.[quote?.selectedPackageIndex || 0] || quote?.packages?.[0];
  const names = [...new Set((pkg?.hotels || []).filter((h) => !h.isAlternative).map((h) => h.hotelName).filter(Boolean))];
  return names.join(', ') || 'As per itinerary';
};
const ferrySummary = (quote) => {
  const pkg = quote?.packages?.[quote?.selectedPackageIndex || 0] || quote?.packages?.[0];
  const names = [...new Set((pkg?.activities || [])
    .filter((a) => /ferry|cruise|makruzz|nautika|green ocean/i.test(`${a.name} ${a.ticketType}`))
    .map((a) => String(a.ticketType || a.name).split(':')[0].trim())
    .filter(Boolean))];
  return names.join(', ') || 'As per itinerary';
};

export const WHATSAPP_TEMPLATES = [
  {
    key: 'quotation_sent',
    needs: { kind: 'quote', as: 'quotation' },
    label: 'Quotation Sent',
    name: 'quotation_sent',
    stage: 'quote',
    body: `🌴 *Your Andaman Holiday Quotation Is Ready*

Hi {{customer_name}} 👋

Thank you for choosing ${company.shortName}.

Your customized Andaman holiday quotation is ready:

📅 Travel dates: {{travel_dates}}
👨‍👩‍👧‍👦 Travellers: {{traveller_count}}
🌴 Duration: {{duration}}
💰 Package value: ₹{{amount}}

📄 View your quotation: {{quotation_link}}

Please review the itinerary and let us know if you'd like any changes.`,
    fill: ({ query, quote, links }) => ({
      customer_name: guestName(query),
      travel_dates: travelDates(query, quote),
      traveller_count: travellers(query),
      duration: duration(query, quote),
      amount: inr(pkgValue(quote)),
      quotation_link: links?.quotation || '',
    }),
  },
  {
    key: 'quotation_followup',
    needs: { kind: 'quote', as: 'quotation' },
    label: 'Quotation Follow-up',
    name: 'quotation_followup',
    stage: 'quote',
    body: `*Quotation Follow-up*

Hi {{customer_name}} 👋

Just checking in regarding your ${company.shortName} holiday quotation for {{travel_dates}}. 🌴

If you'd like changes to hotels, itinerary, activities, duration or budget, our team will be happy to customize it.

📄 View your quotation: {{quotation_link}}

If everything looks good, reply "APPROVE" and we'll take you through the next steps.`,
    fill: ({ query, quote, links }) => ({
      customer_name: guestName(query),
      travel_dates: travelDates(query, quote),
      quotation_link: links?.quotation || '',
    }),
  },
  {
    key: 'payment_request',
    label: 'Quotation Approved — Payment Request',
    name: 'payment_request',
    stage: 'payment',
    body: `*Quotation Approved - Payment Request*

Hi {{customer_name}} 👋

Your ${company.shortName} package has been approved and is ready for booking.

💰 Amount payable: ₹{{payment_amount}}

💳 Make Payment: {{payment_link}}

Once payment is received, we'll proceed with the hotel, ferry and travel arrangements.`,
    fill: ({ query, installment, quote, links }) => ({
      customer_name: guestName(query),
      payment_amount: inr(installment?.amount ?? pkgValue(quote)),
      payment_link: links?.payment || '',
    }),
  },
  {
    key: 'payment_receipt',
    needs: { kind: 'receipt', as: 'receipt' },
    label: 'Payment Receipt',
    name: 'payment_receipt',
    stage: 'payment',
    body: `✅ *Payment Receipt*

Hi {{customer_name}},

Thank you for your payment towards your ${company.shortName} holiday package.

💰 Amount received: ₹{{amount}}
🧾 Receipt No.: {{receipt_number}}
📅 Payment Date: {{payment_date}}

📄 View / Download Receipt: {{receipt_link}}

Your booking arrangements will continue as planned. 🌴`,
    fill: ({ query, installment, links }) => ({
      customer_name: guestName(query),
      amount: inr(installment?.paidAmount ?? installment?.amount),
      receipt_number: String(installment?.installmentNumber || ''),
      payment_date: dt(installment?.paidOn),
      receipt_link: links?.receipt || '',
    }),
  },
  {
    key: 'next_instalment',
    label: 'Next Instalment Reminder',
    name: 'next_instalment_reminder',
    stage: 'payment',
    body: `🌴 *Next Instalment Reminder – ${company.shortName}*

Hi {{customer_name}},

Thank you for your initial payment. ❤️

The next instalment of ₹{{pending_amount}} is now due, so our team can confirm your hotels, ferry tickets and transfers.

📅 Travel dates: {{travel_dates}}
💰 Next instalment: ₹{{pending_amount}}

💳 Complete Payment: {{payment_link}}

If you've already paid, simply share the payment reference with us.`,
    fill: ({ query, quote, installment, links }) => ({
      customer_name: guestName(query),
      pending_amount: inr((installment?.amount || 0) - (installment?.paidAmount || 0) || installment?.amount),
      travel_dates: travelDates(query, quote),
      payment_link: links?.payment || '',
    }),
  },
  {
    key: 'gst_invoice',
    needs: { kind: 'invoice', as: 'invoice' },
    label: 'GST Invoice',
    name: 'gst_invoice',
    stage: 'payment',
    body: `🧾 *GST Invoice*

Hi {{customer_name}},

Your GST Invoice for your Andaman holiday package has been generated.

Invoice No.: {{invoice_number}}
Invoice Date: {{invoice_date}}
Invoice Amount: ₹{{invoice_amount}}

📄 View / Download Invoice: {{invoice_link}}

Please keep this invoice for your records.`,
    fill: ({ query, invoice, links }) => ({
      customer_name: guestName(query),
      invoice_number: String(invoice?.invoiceNumber || ''),
      invoice_date: dt(invoice?.invoiceDate),
      invoice_amount: inr(invoice?.amount),
      invoice_link: links?.invoice || '',
    }),
  },
  {
    key: 'package_confirmed',
    needs: { kind: 'quote', as: 'booking' },
    label: 'Package Confirmed',
    name: 'package_confirmed',
    stage: 'booking',
    body: `🎉 *Your Andaman Holiday Is Confirmed!*

Hi {{customer_name}},

We're happy to officially confirm your ${company.shortName} holiday package.

🌴 Package: {{package_name}}
📅 Travel dates: {{travel_dates}}
👨‍👩‍👧‍👦 Travellers: {{traveller_count}}
🏨 Hotels: {{hotel_summary}}
🚢 Ferry: {{ferry_summary}}

📄 View confirmed package: {{booking_link}}`,
    fill: ({ query, quote, links }) => ({
      customer_name: guestName(query),
      package_name: pkgName(quote),
      travel_dates: travelDates(query, quote),
      traveller_count: travellers(query),
      hotel_summary: hotelSummary(quote),
      ferry_summary: ferrySummary(quote),
      booking_link: links?.booking || '',
    }),
  },
  {
    key: 'travel_documents',
    needs: { kind: 'voucher', as: 'documents' },
    label: 'Final Travel Documents',
    name: 'travel_documents',
    stage: 'booking',
    body: `🌴 *Your Andaman Travel Documents Are Ready!*

Hi {{customer_name}},

Your final travel documents are ready — hotel details, ferry details, transfers, sightseeing plan, day-wise itinerary and activity details.

📄 View Your Travel Documents: {{document_link}}

Please keep these accessible during your trip. Our local team will assist you throughout. 🌊`,
    fill: ({ query, links }) => ({
      customer_name: guestName(query),
      document_link: links?.documents || '',
    }),
  },
  {
    key: 'post_trip_review',
    label: 'Post-Trip / Review',
    name: 'post_trip_review',
    stage: 'booking',
    body: `❤️ *We Hope You Had an Amazing Andaman Journey*

Hi {{customer_name}},

We hope you had a wonderful time exploring the Andaman Islands with ${company.shortName}. 🌴🌊

If you enjoyed your experience, we'd truly appreciate a review.

⭐ Share your experience: {{review_link}}

Thank you once again — we hope to welcome you back soon!`,
    fill: ({ query, links }) => ({
      customer_name: guestName(query),
      review_link: links?.review || company.whyUs?.reviewLinks?.[0]?.url || company.website || '',
    }),
  },
];

export const templateByKey = (key) => WHATSAPP_TEMPLATES.find((t) => t.key === key);

// Substitute {{placeholders}} into the preview body so the agent sees the
// exact message the guest will get.
export function renderTemplateBody(tpl, values) {
  return String(tpl?.body || '').replace(/\{\{(\w+)\}\}/g, (m, k) => (values?.[k] ?? m));
}
