// Standard entry-ticket prices for well-known Andaman sightseeing spots.
// Mirrors server/src/pdf/quotationHtml.js's STD_TICKETS (kept in sync by
// hand — the server copy drives the PDF's default-ticket chip, this one
// drives auto-adding a real priced ticket row in the Quote Builder when a
// matching Transport Service is picked and nothing already covers it).
// minAge: travellers below this age don't need (or aren't charged for) the
// ticket — 0 means everyone, including infants, is counted.
export const STD_TICKETS = [
  { svc: /cellular\s*jail/i, act: /cellular\s*jail/i, label: 'Cellular Jail Ticket', price: 30, minAge: 0, ageNote: '' },
  { svc: /light\s*(&|and)\s*sound|sound\s*(&|and)\s*light/i, act: /\bl\s*&\s*s\b|light\s*(&|and)\s*sound|sound\s*(&|and)\s*light/i, label: 'L&S Ticket', price: 300, minAge: 5, ageNote: 'above 5 yrs' },
  { svc: /baratang|lime\s*stone|limestone/i, act: /lime\s*stone|limestone|baratang/i, label: 'Lime Stone Ticket', price: 1200, minAge: 3, ageNote: 'above 3 yrs' },
  { svc: /elephant\s*beach/i, act: /speed\s*boat|elephant/i, label: 'Speed Boat Ticket', price: 1200, minAge: 2, ageNote: 'above 2 yrs' },
  { svc: /ross\s*island/i, act: /\bboat\b|ross/i, label: 'Boat Ticket', price: 500, minAge: 2, ageNote: 'above 2 yrs' },
  { svc: /north\s*bay/i, act: /\bboat\b|north\s*bay/i, label: 'Boat Ticket', price: 600, minAge: 2, ageNote: 'above 2 yrs' },
];
