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

// "Check in - 1 Oct, Check out - 2 Oct (1N)" — the explicit wording used on
// the booking tables. `isRepeat` marks a second stay at the same hotel later
// in the same trip, which reads as a re-check-in rather than a new booking.
export function stayCheckInOut(r, isRepeat = false) {
  const nights = r.nightRates?.length || r.nights?.length || 1;
  const inLabel = isRepeat ? 'Re Check in' : 'Check in';
  const ci = r.checkIn ? format(new Date(r.checkIn), 'd MMM') : '—';
  const co = r.checkOut ? format(new Date(r.checkOut), 'd MMM') : '—';
  return `${inLabel} - ${ci}, Check out - ${co} (${nights}N)`;
}

// Flags each row that repeats a hotel already stayed at earlier in the list,
// so the table can label it "Re Check in".
export function markRepeatStays(rows) {
  const seen = new Set();
  return (rows || []).map((r) => {
    const key = String(r.hotelRef || r.name || r.hotelName || '').toLowerCase();
    const isRepeat = key ? seen.has(key) : false;
    if (key) seen.add(key);
    return { row: r, isRepeat };
  });
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
