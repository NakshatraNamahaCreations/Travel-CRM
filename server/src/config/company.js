// Branding + boilerplate for server-rendered PDFs / emails.
export const company = {
  name: 'Andaman TravelCare',
  tagline: 'Quality Tours. Exceptional Service.',
  address: ['M.A Road, Phoenix Bay,', 'Port Blair, A&N Islands,', 'PIN: 744101'],
  emails: ['info@andamantravelcare.com', 'bookings@andamantravelcare.com'],
  phones: ['+91 89009 12121', '+91 94742 07541'],
  website: 'www.andamantravelcare.com',
  bank: {
    holder: 'Andaman TravelCare (Current Account)',
    bank: 'HDFC',
    address: 'Junglighat, Port Blair, South Andaman, 744103',
    accNo: '50200066269962',
    ifsc: 'HDFC0001994',
    paymentLink: 'www.andamantravelcare.com/pay',
  },
  advancePercent: 50,
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
  gstin: '35BTEPK8670E1ZK',

  // Terms & Conditions rendered on the quotation PDF. Each item may start with
  // a "Label: " prefix — the label (text before ": ") is rendered in bold.
  termsAndConditions: [
    {
      heading: 'Payment Policy',
      items: [
        '25% at Booking: 25% of the total package cost is due at the time of booking (1st installment) via bank transfer or payment gateway (3.5% extra gateway fee).',
        '25% after Confirmation: 25% is due 5 days after receiving confirmation (2nd installment).',
        '50% on Arrival: The remaining 50% is due on the day of arrival. If you wish to pay the third installment online, notify us at least 3 days before travel. Online payments incur an additional 2% fee.',
      ],
    },
    {
      heading: 'Cancellation Policy',
      items: [
        '30+ Days Before Travel: 30% of the total package cost is charged as a cancellation fee.',
        '15-30 Days Before Travel: 70% of the total package cost is charged as a cancellation fee.',
        '0-15 Days Before Travel: 100% of the total package cost is charged as a cancellation fee.',
        'Weather/Government Restrictions: No refunds for cancellations due to weather, government restrictions, or unforeseen circumstances, though alternate activities will be provided when possible.',
      ],
    },
    {
      heading: 'Last-Minute Cancellations',
      items: [
        'For cancellations due to flight cancellations, natural calamities, or changes in flight schedules/ferry services (due to technical/weather issues), 100% of the booking amount is non-refundable.',
        'Andaman TravelCare is not responsible for missed sightseeing, closures, or delays due to strikes, roadblocks, or unforeseen circumstances.',
      ],
    },
    {
      heading: 'Check-in/Check-out and Special Requests',
      items: [
        'Check-in time at the hotels is 11:00 AM, with early check-in available based on room availability.',
        'Check-out time at hotels in Andaman is 8:00 AM. If clients wish to extend their stay, they will need to pay additional charges, subject to availability.',
        'If the listed hotel is unavailable, a similar alternative will be provided in the same category. Availability is subject to change without prior notice.',
        'Special Requests: Requests for early check-in, late check-out, room type, or other special accommodations are subject to availability and cannot be guaranteed.',
        'If a Gala dinner is held at your hotel (on Christmas, New Year, or other special occasions), it is mandatory and charges will be directly applied by the hotel.',
        'Meals must be taken as per hotel timings. An extra bed refers to an extra mattress. The meal plans are: EP (Accommodation only), CP (Accommodation with breakfast), MAP (Accommodation with breakfast and one additional meal), and AP (Accommodation with all meals).',
      ],
    },
    {
      heading: 'Ferry and Cruise Operations',
      items: [
        "Ferry and cruise operations are subject to government clearance and weather conditions. If a ferry cannot sail due to weather or other restrictions, alternative arrangements will be made. However, no refund will be provided for non-sailing ferries, and cancellations will be handled as per the company's cancellation policy.",
      ],
    },
    {
      heading: 'Water Activities and Weather Conditions',
      items: [
        'All water activities are subject to weather conditions. If any activity is not conducted due to weather, no refund will be provided. Alternative activities will be arranged when possible.',
      ],
    },
    {
      heading: 'Urgent Bookings',
      items: [
        'For bookings made within 15 days of travel, 50% of the total package cost is required upfront. Vouchers and payment invoices will be emailed within 7 days of booking.',
      ],
    },
    {
      heading: 'Instalment Payment Terms, Booking Cancellation, and Package Changes',
      items: [
        'Instalment Extensions: Clients can request an extension on instalment dates in special cases, subject to approval from the Travel Consultant. Any changes will be assessed on a case-by-case basis.',
        'Payment Non-Compliance: Failure to meet payment terms may result in booking cancellation. If the instalment is not paid within 3 days of the due date, a rebooking fee of 10% applies to continue the trip.',
        'Package Changes and Extra Costs: Changes due to government orders, pandemics, strikes, or natural disasters incur additional costs, which must be borne by the client. These charges apply even if the package is altered for any reason.',
        'Postponement charges vary between 10% and 30%, depending on remaining days. Seasonal surcharges during peak times and long weekends are applicable and must be borne by the guest.',
      ],
    },
    {
      heading: 'Changes to Itineraries',
      items: [
        'By Andaman TravelCare: We reserve the right to make changes to your itinerary or accommodations due to unforeseen circumstances. We will make every effort to inform you of such changes as soon as possible.',
        'By You: Any changes requested by you to your itinerary may be subject to fees or penalties, as determined by the service providers and Andaman TravelCare.',
      ],
    },
    {
      heading: 'Disclaimer on Verbal Commitments, Sightseeing Delays, and Tour Expectations',
      items: [
        'Verbal commitments are not valid. Heavy traffic during peak season may cause missed sightseeing, for which Andaman TravelCare is not responsible. We cannot guarantee the tour will meet your expectations.',
      ],
    },
    {
      heading: 'General Terms',
      items: [
        'Personal Responsibility: Guests are responsible for their personal belongings. The company is not liable for any lost or damaged items during the trip.',
        'Amendments and Changes: If you wish to amend your itinerary or postpone your travel dates, you must bear additional charges. Changes are subject to availability and may incur extra costs.',
        'Non-Compliance: If payment terms are not met, the booking may be canceled, and rebooking charges may apply.',
        'Local Attractions and Closures: Andaman museums and monuments remain closed on Mondays, while Ross Island is closed on Wednesdays. If any attraction is missed due to unforeseen closures, efforts will be made to cover the sightseeing when possible.',
      ],
    },
    {
      heading: 'Additional Important Notes',
      items: [
        'Mobile Networks: Only BSNL, Airtel, and Vodafone networks are supported in Andaman.',
        'Foreign Nationals: Foreign nationals and Indians holding passports from other countries (PIO/OCI) must register at Port Blair airport upon arrival and obtain a Restricted Area Permit (RAP), valid for 30 days.',
      ],
    },
  ],

  whyUs: {
    headline: 'Andaman TravelCare believes in Quality Tours and Warm Hospitality.',
    testimonials: [
      {
        name: 'Nabarun Chakraborty',
        platform: 'Google',
        rating: 5,
        review: 'From the day of booking to the time of flight taking off they made our trip hassle free, comfortable, and fine. The beautiful archipelago has become more and more beautiful for their cordial support, class of service with reasonable price and punctuality.',
      },
      {
        name: 'Anupama Saxena',
        platform: 'Google',
        rating: 5,
        review: 'I would have given 10 stars out of 5 — great team work! I have never seen in my life that a tour operator calls you every evening during your tour and takes the feedback of each place covered in the itinerary. Not at all a money-minded company.',
      },
      {
        name: 'Amit Singh',
        platform: 'Tripadvisor',
        rating: 5,
        review: 'Very well explained, updated itinerary day wise and executed really well. They believe in Punctuality, Quality, Value. Andaman TravelCare provided us with best service — on time pickup and drop, clean sanitized cars, sightseeing, hassle free booking of ferries and boats.',
      },
    ],
    reviewLinks: [
      { label: 'Google', url: 'www.andamantravelcare.com' },
      { label: 'Tripadvisor', url: 'www.andamantravelcare.com' },
    ],
  },

  galleryImages: [
    'https://images.unsplash.com/photo-1586500036706-41963de24d8b?w=400&q=80',
    'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?w=400&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400&q=80',
    'https://images.unsplash.com/photo-1596895111956-bf1cf0599ce5?w=400&q=80',
    'https://images.unsplash.com/photo-1559494007-9f5847c49d94?w=400&q=80',
  ],
};
