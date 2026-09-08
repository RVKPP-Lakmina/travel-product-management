import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDateAnchors } from './date-anchors.js';

describe('buildDateAnchors', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves correctly on an ordinary Tuesday mid-month (2026-09-08)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T04:00:00Z')); // ~09:30 Colombo

    const anchors = buildDateAnchors();

    expect(anchors.today).toBe('2026-09-08');
    expect(anchors.endOfThisWeek).toBe('2026-09-13'); // next Sunday
    expect(anchors.endOfThisMonth).toBe('2026-09-30');
    expect(anchors.endOfNextMonth).toBe('2026-10-31');
    expect(anchors.endOfThisQuarter).toBe('2026-09-30'); // Jul-Aug-Sep
    expect(anchors.endOfThisYear).toBe('2026-12-31');
    expect(anchors.plus7d).toBe('2026-09-15');
    expect(anchors.plus30d).toBe('2026-10-08');
    expect(anchors.plus90d).toBe('2026-12-07');
  });

  it('the spec\'s own example: "available until the end of this month" resolves across a month boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T20:00:00Z')); // ~01:30 Colombo, still Jan 31 local

    const anchors = buildDateAnchors();
    expect(anchors.today).toBe('2026-02-01'); // UTC+5:30 rolled over to Feb 1
    expect(anchors.endOfThisMonth).toBe('2026-02-28'); // not a leap year
  });

  it('handles a leap-year February correctly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2028-02-10T04:00:00Z'));

    const anchors = buildDateAnchors();
    expect(anchors.endOfThisMonth).toBe('2028-02-29');
  });

  it('when today IS Sunday, endOfThisWeek is today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T04:00:00Z')); // a Sunday

    const anchors = buildDateAnchors();
    expect(anchors.endOfThisWeek).toBe(anchors.today);
  });

  it('endOfThisQuarter correctly resolves for each quarter boundary', () => {
    const cases: [string, string][] = [
      ['2026-01-15T04:00:00Z', '2026-03-31'], // Q1
      ['2026-04-15T04:00:00Z', '2026-06-30'], // Q2
      ['2026-07-15T04:00:00Z', '2026-09-30'], // Q3
      ['2026-10-15T04:00:00Z', '2026-12-31'], // Q4
    ];
    for (const [now, expected] of cases) {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(now));
      expect(buildDateAnchors().endOfThisQuarter).toBe(expected);
      vi.useRealTimers();
    }
  });

  it('endOfNextMonth rolls over the year boundary correctly', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-15T04:00:00Z'));

    const anchors = buildDateAnchors();
    expect(anchors.endOfThisMonth).toBe('2026-12-31');
    expect(anchors.endOfNextMonth).toBe('2027-01-31');
  });
});
