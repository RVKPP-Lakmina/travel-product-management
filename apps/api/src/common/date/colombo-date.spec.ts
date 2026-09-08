import { afterEach, describe, expect, it, vi } from 'vitest';
import { colomboToday, isExpired } from './colombo-date.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('colomboToday', () => {
  it('returns the Colombo-local date even when UTC has already rolled to the next day', () => {
    // 2026-01-01 19:00 UTC = 2026-01-02 00:30 in Asia/Colombo (+05:30).
    // A naive UTC-based "today" would say 2026-01-01; the correct answer
    // is 2026-01-02. This is exactly the class of bug the validity rule
    // depends on not having.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T19:00:00.000Z'));
    expect(colomboToday()).toBe('2026-01-02');
  });

  it('returns the Colombo-local date when UTC is still on the same day', () => {
    // 2026-01-01 10:00 UTC = 2026-01-01 15:30 in Asia/Colombo.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
    expect(colomboToday()).toBe('2026-01-01');
  });
});

describe('isExpired — the validity boundary', () => {
  it('a product valid THROUGH today (validUntil === today) is NOT expired — inclusive boundary', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T06:00:00.000Z')); // 2026-06-15 in Colombo
    expect(isExpired('2026-06-15')).toBe(false);
  });

  it('a product whose window closed yesterday IS expired', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T06:00:00.000Z')); // 2026-06-15 in Colombo
    expect(isExpired('2026-06-14')).toBe(true);
  });

  it('a product valid into the future is not expired', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T06:00:00.000Z'));
    expect(isExpired('2026-06-16')).toBe(false);
  });
});
