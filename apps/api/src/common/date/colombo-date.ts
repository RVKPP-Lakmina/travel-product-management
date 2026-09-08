/**
 * "Today" in Asia/Colombo, as YYYY-MM-DD. Supabase's server timezone is UTC,
 * so a naive `new Date().toISOString().slice(0, 10)` would call a product
 * expired up to 5.5 hours early (or late) relative to Sri Lanka time. Every
 * expiry comparison in the API must go through this — never compute "today"
 * any other way.
 *
 * Uses the native Intl API rather than a date library: Sri Lanka has no DST,
 * so there's no edge case a library would handle that Intl doesn't, and it
 * avoids adding date-fns-tz/luxon as a dependency for one function.
 */
const COLOMBO_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Colombo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function colomboToday(): string {
  // en-CA locale formats as YYYY-MM-DD directly.
  return COLOMBO_FORMATTER.format(new Date());
}

export function isExpired(validUntil: string): boolean {
  return validUntil < colomboToday();
}
