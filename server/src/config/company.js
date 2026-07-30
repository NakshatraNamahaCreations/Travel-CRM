// Branding + boilerplate for server-rendered PDFs / emails.
export const company = {
  name: 'Andaman TravelCare',
  tagline: 'Quality Tours. Exceptional Service.',
  address: ['22 AK Anarkali Street,', 'Near Community Hall,', 'Port Blair - 744102'],
  emails: ['info@andamantravelcare.com', 'bookings@andamantravelcare.com'],
  phones: ['+91 89009 12121', '+91 89009 16161'],
  website: 'www.andamantravelcare.com',
  bank: {
    holder: 'ANDAMAN TRAVEL CARE',
    bank: 'ICICI',
    address: 'Garacharma, Port Blair',
    accNo: '387905500122',
    ifsc: 'ICIC0003879',
    paymentLink: 'www.andamantravelcare.com/pay',
  },
  // "Scan to Pay" block on the Additional Information page: a designed image
  // (ICICI/UPI QR) under server/src/assets or an http(s) URL. Clear it to hide
  // the card and let Payment Information span the full width.
  paymentQrImage: 'scanner.png',
  advancePercent: 50,

  // Quotation cover page — "Why Travel with us" bullets over the hero photo.
  coverPoints: [
    'Government Licensed & Local Tour Operator',
    'Transparent Pricing • No Hidden Charges',
    '24x7 On-Ground Assistance',
    'Trusted by 700+ Happy Travellers',
  ],
  // "YOUR PACKAGE INCLUDES" icon row on the cover. `icon` is an HTML entity
  // (rendered raw); `sub` is an optional orange sub-label.
  coverIncludes: [
    { icon: '&#128716;', label: 'Stays' },
    { icon: '&#127796;', label: 'Beaches' },
    { icon: '&#9972;', label: 'Ferry Transfers' },
    { icon: '&#128663;', label: 'Private Cab' },
    { icon: '&#128301;', label: 'Sightseeings' },
    { icon: '&#127859;', label: 'Breakfast', sub: 'Included' },
  ],

  defaultInclusions: [
    'Sightseeing in private A/C vehicles.',
    'Accommodation at all islands as given, including meal plan as mentioned.',
    'Complete all day tours with all transfers including airport pickup and drop.',
    'Complete boat charges, cruise charges, permits and entry tickets.',
    'Complete assistance by our team during your visit.',
    'Cruise tickets as per disposal: Makruzz, Green Ocean, ITT Majestic, Sea Link, Nautika, or Govt. Ferry.',
  ],
  defaultExclusions: [
    'Flight tickets (we recommend booking these yourself for the best fares).',
    'Additional camera charges at certain places during sightseeing.',
    'Personal expenses: incidentals, extra meals, telephone charges, minibar, etc.',
    'Extra room services: food orders, snack orders, etc.',
    'Additional sightseeing or extra use of vehicles other than what is mentioned.',
    'Other meals which are not included in the itinerary.',
  ],
  notes: [
    'This is a private tour.',
    'All packages, hotels & cruises are subject to availability.',
    'Execution of tour is subject to weather conditions. In bad weather the amount will be refunded.',
    'For Ross Island, Rs. 50 entry fee is paid directly by the traveller at the island.',
  ],
  bookingTerms: '50% payment in advance to confirm your package. Balance 50% on day of arrival in Port Blair.',
  // "Please note" strip under the day-wise itinerary in the quotation PDF.
  itineraryNote: 'The itinerary is subject to change due to weather, operational conditions or other unforeseen circumstances.',
  gstin: '35BTEPK8670E1ZK',

  // Terms & Conditions rendered on the quotation PDF. Each item may start with
  // a "Label: " prefix — the label (text before ": ") is rendered in bold.
  termsAndConditions: [
    {
      heading: '1. Booking Policy',
      intro: 'To confirm your Andaman package, please complete the following steps:',
      table: {
        headers: ['Step', 'Requirement'],
        rows: [
          ['Step 1', 'Pay 50% to 70% of the package cost (as advised by your travel consultant) to confirm the booking.'],
          ['Step 2', 'Share a valid Government Photo ID (Aadhaar, Passport, Voter ID, Driving Licence, etc.) for all travellers.'],
          ['Step 3', 'Share your arrival and departure flight details.'],
          ['Step 4', 'Provide the full name, age and gender of all travellers.'],
        ],
      },
      items: [
        'Balance Payment: Remaining amount must be paid 2 days before arrival, or on arrival in Port Blair before commencement of services (if agreed). Bookings are confirmed only after the required advance payment is received.',
      ],
    },
    {
      heading: '2. Payment Policy',
      items: [
        'Payments can be made through Bank Transfer, UPI or other approved online payment methods.',
        'Cash payments are accepted as per applicable Government regulations. Cheques are not accepted.',
        'Payments made to any account other than the official AndamanTravelCare account will not be considered valid.',
      ],
    },
    {
      heading: '3. Cancellation Policy (Land Packages)',
      table: {
        headers: ['Cancellation Before Arrival', 'Cancellation Charges'],
        rows: [
          ['More than 30 Days', '100% refund after deducting ferry cancellation charges (if applicable).'],
          ['21–30 Days', '25% of the total package cost.'],
          ['11–20 Days', '50% of the total package cost.'],
          ['10 Days or Less', '100% cancellation charges. No refund.'],
        ],
      },
      boxTitle: 'Additional Conditions:',
      items: [
        "Ferry tickets are cancelled as per the ferry operator's policy.",
        "Hotel cancellation charges apply as per the respective hotel's policy.",
        'Peak season (15 Dec–15 Jan) bookings may attract 100% cancellation charges depending on hotel/ferry policies.',
        'Premium hotels such as Taj, Barefoot, Munjoh, Seashell, Coral Reef and similar properties may have separate cancellation policies.',
      ],
    },
    {
      heading: '4. Flight Cancellation Policy',
      items: [
        "Flight tickets are governed by airline rules. Airline delays, cancellations or rescheduling are beyond AndamanTravelCare's control. Any airline cancellation charges apply as per airline policy. Refunds for missed hotel nights, ferries or sightseeing due to flight disruptions are subject to the respective providers' policies.",
      ],
    },
    {
      heading: '5. Hotel Policy',
      table: {
        headers: ['Destination', 'Standard Hotels', 'Premium Hotels'],
        rows: [
          ['Port Blair', 'Check-in: 11:00 AM · Check-out: 8:00 AM', 'Same'],
          ['Havelock Island', 'Check-in: 11:00 AM · Check-out: 8:00 AM', 'Check-in: 12:00 PM · Check-out: 8:00 AM'],
          ['Neil Island', 'Check-in: 11:00 AM · Check-out: 8:00 AM', 'Check-in: 12:00 PM · Check-out: 8:00 AM'],
        ],
      },
      items: [
        'Early check-in and late check-out are subject to availability and may incur additional charges.',
        'Similar category hotels may be provided if the booked hotel is unavailable.',
      ],
    },
    {
      heading: '6. Ferry & Sightseeing Policy',
      items: [
        'Ferry schedules are subject to weather, Government regulations and operational conditions. Alternate arrangements will be made wherever possible. Sightseeing order may change. No refund for services missed due to late arrival by guests.',
      ],
    },
    {
      heading: '7. Water Activities',
      items: [
        "All water activities are subject to weather and Government permissions. Refunds, if any, are governed by the activity operator's policy.",
      ],
    },
    {
      heading: '8. Guest Responsibilities',
      items: [
        'Guests must carry original ID, report on time, follow hotel/ferry/activity rules and behave respectfully. Services may be discontinued without refund in cases of misconduct.',
      ],
    },
    {
      heading: '9. Force Majeure',
      items: [
        'AndamanTravelCare is not responsible for disruptions caused by weather, natural disasters, Government restrictions, pandemics, civil unrest, flight or ferry suspensions, or other events beyond our control. Refunds remain subject to supplier policies.',
      ],
    },
    {
      heading: '10. Liability',
      items: [
        'AndamanTravelCare acts as a booking facilitator and is not liable for accidents, injuries, loss or theft occurring during third-party services.',
      ],
    },
    {
      heading: '11. Privacy Policy',
      items: [
        'Personal information is used only for bookings, permits and travel arrangements and is shared only where required for service delivery or by law.',
      ],
    },
    {
      heading: '12. Changes to Itinerary',
      items: [
        'Itineraries may change due to weather, ferry schedules, Government restrictions or operational requirements. Suitable alternatives will be arranged wherever possible.',
      ],
    },
    {
      heading: '13. Dispute Resolution',
      items: [
        'Disputes should first be resolved amicably. If unresolved, they shall be subject to the jurisdiction of competent courts in Port Blair, Andaman & Nicobar Islands.',
      ],
    },
    {
      heading: 'Important Notes',
      items: [
        'Room allocation, ferry seats and flight fares are subject to availability. Package prices may change before confirmation due to supplier price revisions. By confirming a booking, guests agree to these terms and conditions.',
      ],
    },
  ],

  whyUs: {
    headline: 'Andaman TravelCare believes in Quality Tours and Warm Hospitality.',
    // Client review posters shown on the closing pages of the quotation PDF:
    // filenames under server/src/assets (embedded as data URIs) or http(s) URLs.
    // First 4 fill the WHY US page (2x2) — keep same-aspect posters there so the
    // grid aligns; the rest go in a row on the following page.
    reviewImages: ['r1.jpeg', 'r4.jpeg', 'r5.jpeg', 'r6.jpeg', 'r2.jpeg', 'r3.jpeg', 'r7.jpeg'],
    reviewLinks: [
      { label: 'Google', url: 'www.andamantravelcare.com' },
      { label: 'Tripadvisor', url: 'www.andamantravelcare.com' },
    ],
  },

  // Static ferry departure/arrival fallbacks for the quotation PDF, used when a
  // transfer has no start time entered. Matched by keyword in the service name +
  // sector code (PB = Port Blair, HL = Havelock, NL = Neil). Times are 24h "HH:MM".
  ferrySchedule: [
    { match: 'itt majestic', times: { 'PB>HL': ['08:30', '10:00'], 'HL>NL': ['10:45', '11:45'], 'NL>PB': ['11:45', '13:05'], 'HL>PB': ['14:00', '15:30'] } },
    { match: 'green ocean', times: { 'PB>HL': ['06:30', '08:45'], 'HL>NL': ['09:15', '10:30'], 'NL>PB': ['12:30', '14:15'], 'HL>PB': ['12:45', '14:30'] } },
    { match: 'makruzz', times: { 'PB>HL': ['08:00', '09:30'], 'HL>NL': ['10:30', '11:30'], 'NL>PB': ['12:00', '13:30'], 'HL>PB': ['16:00', '17:30'] } },
    { match: 'nautika', times: { 'PB>HL': ['07:45', '09:15'], 'HL>NL': ['12:00', '13:00'], 'NL>PB': ['13:30', '15:00'], 'HL>PB': ['16:30', '18:00'] } },
    { match: 'sea link', times: { 'PB>HL': ['09:00', '11:00'], 'HL>NL': ['11:30', '12:30'], 'NL>PB': ['13:00', '14:45'], 'HL>PB': ['15:00', '17:00'] } },
  ],

  // "Recognised by" badge images on the quotation cover: filenames under
  // server/src/assets (embedded into the PDF) or full http(s) URLs. Shown on the
  // cover under the AWARDED pill, next to the ratings card.
  recognisedBy: ['1.jpeg', '2.jpeg'],

  // Full-width hero photo on the quotation cover page.
  heroImage: 'https://images.unsplash.com/photo-1586500036706-41963de24d8b?w=1400&q=80',

  // Day-wise itinerary photos: first entry whose keyword (|-separated) appears
  // in the service name wins. Set to [] to render the itinerary text-only.
  itineraryImages: [
    { match: 'scuba|dive', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=500&q=80' },
    { match: 'snorkel|sea walk', image: 'https://images.unsplash.com/photo-1682687982501-1e58ab814714?w=500&q=80' },
    { match: 'kayak', image: 'https://images.unsplash.com/photo-1465310477141-6fb93167a273?w=500&q=80' },
    { match: 'jet ski', image: 'https://images.unsplash.com/photo-1755566981084-00c579a061a5?w=500&q=80' },
    { match: 'parasail', image: 'https://images.unsplash.com/photo-1677126578070-6f1afdf453e3?w=500&q=80' },
    { match: 'jail|light & sound|light and sound', image: 'https://images.unsplash.com/photo-1678810982243-2d309522e93e?w=500&q=80' },
    { match: 'ross island|north bay|glass|boat|jetty|baratang|limestone', image: 'https://images.unsplash.com/photo-1470218091926-22a08a325802?w=500&q=80' },
    { match: 'sunset|laxmanpur', image: 'https://images.unsplash.com/photo-1559494007-9f5847c49d94?w=500&q=80' },
    { match: 'cruise|ferry|makruzz|nautika|green ocean|itt|sea link', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=500&q=80' },
    { match: 'radhanagar|kalapathar|elephant|bharatpur|corbyn|beach|chidiya', image: 'https://images.unsplash.com/photo-1586359716568-3e1907e4cf9f?w=500&q=80' },
    { match: 'arrival|airport|leisure|havelock|neil', image: 'https://images.unsplash.com/photo-1586500036706-41963de24d8b?w=500&q=80' },
  ],

  // Optional Activities upsell grid on the quotation PDF. Images are asset
  // filenames (server/src/assets) or http(s) URLs; `icon` is an HTML entity
  // for the navy circle badge; `onRequest: true` prints "On Request" instead
  // of a price. Set to [] to hide the page entirely.
  optionalActivities: [
    { name: 'Scuba Diving', adult: 2500, icon: '&#129343;', image: 'opt-1.jpeg' },
    { name: 'Sea Walk', adult: 3500, icon: '&#129405;', image: 'opt-2.jpeg' },
    { name: 'Parasailing', adult: 3500, icon: '&#129666;', image: 'opt-3.jpeg' },
    { name: 'Bioluminescence Kayaking', adult: 3500, icon: '&#128758;', image: 'opt-4.jpeg' },
    { name: 'Glass Bottom Ride', adult: 1200, icon: '&#128741;', image: 'opt-5.jpeg' },
    { name: 'Jet Ski Ride', adult: 900, icon: '&#128676;', image: 'opt-6.jpeg' },
    { name: 'Snorkeling', adult: 1000, icon: '&#128031;', image: 'opt-7.jpeg' },
    { name: 'Deep Sea Fishing', onRequest: true, icon: '&#127907;', image: 'opt-8.jpeg' },
    { name: 'Candle Light Dinner', adult: 4500, icon: '&#128367;', image: 'opt-9.jpeg' },
  ],

  emergencyContacts: [
    { name: 'Reservations', phone: '8900912121', email: 'booking@andamantravelcare.com', availableOn: 'Call & WhatsApp' },
    { name: 'B2B DMC', phone: '8900916161', email: 'b2b@andamantravelcare.com', availableOn: 'Call & WhatsApp' },
  ],

  social: [
    { label: 'Facebook', short: 'f', color: '#1877f2', url: 'https://facebook.com/andamantravelcare' },
    { label: 'Instagram', short: 'IG', color: '#d6249f', url: 'https://instagram.com/andamantravelcare' },
    { label: 'Youtube', short: '&#9654;', color: '#ff0000', url: 'https://youtube.com/@andamantravelcare' },
    { label: 'Website', short: 'W', color: '#1577bd', url: 'https://www.andamantravelcare.com' },
  ],

  galleryImages: [
    'https://images.unsplash.com/photo-1586500036706-41963de24d8b?w=400&q=80',
    'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?w=400&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
    'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&q=80',
    'https://images.unsplash.com/photo-1596895111956-bf1cf0599ce5?w=400&q=80',
    'https://images.unsplash.com/photo-1559494007-9f5847c49d94?w=400&q=80',
  ],
};
