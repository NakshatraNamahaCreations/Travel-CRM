// Human-friendly trip/query id: zero-padded to at least 4 digits (1 → "0001").
export const tripNo = (n) => {
  const s = String(n ?? '').trim();
  return /^\d+$/.test(s) ? s.padStart(4, '0') : s;
};
