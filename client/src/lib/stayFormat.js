// Formatting for a hotel ServiceBooking row's "Stay and Services" cell, shared
// by the trip's Services Bookings tab and the cross-trip Hotel Bookings list.
import { format, addDays } from 'date-fns';

export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// "7th September - 1st N" / "8th September - 2nd,3rd N" — check-in date plus
// which trip nights this stay covers.
export function stayHeading(r) {
  const date = r.checkIn ? `${ordinal(Number(format(new Date(r.checkIn), 'd')))} ${format(new Date(r.checkIn), 'MMMM')}` : '';
  const nights = (r.nights || []).map(ordinal).join(',');
  return [date, nights ? `${nights} N` : ''].filter(Boolean).join(' - ') || '—';
}

// The actual calendar date of each night in the stay, so a multi-night row
// spells out every date it covers rather than only its check-in date.
export function stayNightDates(r) {
  const count = Math.max(1, r.nights?.length || 1);
  return Array.from({ length: count }, (_, i) => {
    const fromRate = r.nightRates?.[i]?.date;
    if (fromRate) return new Date(fromRate);
    return r.checkIn ? addDays(new Date(r.checkIn), i) : null;
  });
}
