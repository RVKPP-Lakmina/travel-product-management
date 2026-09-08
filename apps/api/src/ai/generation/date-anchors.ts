import type { DateAnchor } from '@travel/validation';
import { colomboToday } from '../../common/date/colombo-date.js';

/**
 * Resolves the AI product-generation date anchors ("endOfThisMonth" etc.)
 * to literal YYYY-MM-DD dates — server-side, deterministically, with no
 * model involved. The model's only job (see generation/prompt.ts) is
 * picking the right anchor NAME; arithmetic never happens in the prompt or
 * the model's head.
 *
 * All arithmetic below treats a date string as a pure calendar value (no
 * time-of-day, no real timezone) by parsing it into UTC-midnight `Date`
 * objects and using the UTC getters/setters throughout. This is the
 * standard "neutral calendar math" pattern — it avoids the timezone ever
 * silently shifting a calendar day, which mixing local-timezone Date
 * methods with a Colombo-anchored "today" string would risk.
 */
export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function addYears(date: Date, years: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCFullYear(copy.getUTCFullYear() + years);
  return copy;
}

/** Day 0 of a given (1-based) month is the last day of the PREVIOUS month — the standard "end of month N" trick. */
function endOfMonth(year: number, zeroBasedMonth: number): Date {
  return new Date(Date.UTC(year, zeroBasedMonth + 1, 0));
}

export function buildDateAnchors(): Record<DateAnchor, string> {
  const today = parseYmd(colomboToday());
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth(); // 0-based

  // Week ends Sunday. dow: 0=Sun..6=Sat. If today IS Sunday, "end of this
  // week" is today.
  const dow = today.getUTCDay();
  const daysUntilSunday = (7 - dow) % 7;
  const endOfThisWeek = addDays(today, daysUntilSunday);

  const quarterStartMonth = Math.floor(month / 3) * 3; // 0, 3, 6, or 9
  const quarterEndMonth = quarterStartMonth + 2; // last month IN the quarter, 0-based

  return {
    today: formatYmd(today),
    endOfThisWeek: formatYmd(endOfThisWeek),
    endOfThisMonth: formatYmd(endOfMonth(year, month)),
    endOfNextMonth: formatYmd(endOfMonth(year, month + 1)),
    endOfThisQuarter: formatYmd(endOfMonth(year, quarterEndMonth)),
    endOfThisYear: formatYmd(endOfMonth(year, 11)),
    plus7d: formatYmd(addDays(today, 7)),
    plus30d: formatYmd(addDays(today, 30)),
    plus90d: formatYmd(addDays(today, 90)),
  };
}

export function formatAnchorsBlock(anchors: Record<DateAnchor, string>): string {
  return Object.entries(anchors)
    .map(([name, date]) => `- ${name}: ${date}`)
    .join('\n');
}
