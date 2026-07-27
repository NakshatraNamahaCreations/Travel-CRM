/* Starter master data for a tenant organization: option lists, query sources,
   tags and destinations. Used by the owner "create company" flow and by the
   seed scripts. Expects an open mongoose connection; wraps its own tenant
   context so every upsert is stamped with the target organization. */
import { runWithTenant } from '../tenant/context.js';
import { Option } from '../models/Option.js';
import { QuerySource } from '../models/QuerySource.js';
import { Tag } from '../models/Tag.js';
import { Destination } from '../models/Destination.js';

export const DEFAULT_OPTIONS = {
  city: [
    'Port Blair', 'Havelock Island', 'Neil Island', 'Baratang Island',
    'Diglipur', 'Rangat', 'Mayabunder', 'Long Island',
    'Little Andaman', 'Jolly Buoy Island', 'Ross Island',
    'North Bay Island', 'Radhanagar Beach',
  ],
  state: ['Andaman and Nicobar Islands'],
  country: ['India'],
  mealPlan: ['Room only', 'CP', 'MAP', 'AP', 'CP MAP'],
  salutation: ['Mr.', 'Mrs.', 'Ms.'],
  currency: ['INR', 'USD', 'EUR', 'GBP', 'AED', 'THB'],
  paymentMode: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'],
  vehicleType: [
    'Sedan (Dzire/Etios)', 'SUV (Xylo/Ertiga)',
    '17 Seater Tempo Traveller', '26 Seater Tempo Traveller',
  ],
  paxConfig: ['Adult', 'Child (2-12)', 'Child (6-12)', 'Child (1-2)', 'Infant'],
  hotelGroup: ['Taj', 'Lemon Tree', 'Symphony', 'Silver Sand', 'TSG', 'NK', 'Aquays', 'Ocean Tree'],
  hotelService: [
    'Candle Light Dinner', 'Beach Side Candle Light Dinner', 'Gala Dinner',
    'Honeymoon Cake', 'Flower Bed Decoration', 'Fruit Basket', 'Early Check-in', 'Late Check-out',
  ],
  tripService: [
    'Cake and Room Decoration', 'Candle Light Dinner', 'Candle Light Dinner (Pool Side)',
    'Off Road Dinner', 'Side Treking', 'Bonfire', 'Photography / Videography', 'Scuba Diving',
  ],
  paymentPreference: [
    '25% on Booking Date, 75% 1 day after Checkin Date',
    '25% on Booking Date, 75% 2 days before Checkin Date',
    'Full payment on booking',
    '50% advance, 50% on arrival',
  ],
};

const DEFAULT_QUERY_SOURCES = ['Website', 'B2B', 'WhatsApp', 'Referral', 'Walk-in', 'Instagram', 'Google Ads'];
const DEFAULT_TAGS = ['honeymoon', 'family', 'group', 'luxury', 'budget'];
const DEFAULT_DESTINATIONS = [
  { name: 'Andaman', country: 'India', region: 'Islands' },
  { name: 'Andaman and Nicobar Islands', country: 'India', region: 'Andaman' },
];

export async function seedMasterData(orgId) {
  return runWithTenant(orgId, async () => {
    for (const [category, values] of Object.entries(DEFAULT_OPTIONS)) {
      for (let i = 0; i < values.length; i++) {
        await Option.findOneAndUpdate(
          { category, value: values[i] },
          { category, value: values[i], label: values[i], order: i },
          { upsert: true, setDefaultsOnInsert: true }
        );
      }
    }
    for (const name of DEFAULT_QUERY_SOURCES) {
      await QuerySource.findOneAndUpdate({ name }, { name }, { upsert: true, setDefaultsOnInsert: true });
    }
    for (const name of DEFAULT_TAGS) {
      await Tag.findOneAndUpdate({ name }, { name }, { upsert: true, setDefaultsOnInsert: true });
    }
    for (const d of DEFAULT_DESTINATIONS) {
      await Destination.findOneAndUpdate({ name: d.name }, d, { upsert: true, setDefaultsOnInsert: true });
    }
  });
}
