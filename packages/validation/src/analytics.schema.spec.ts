import { describe, expect, it } from 'vitest';
import { productAnalyticsSchema, EXPIRY_BUCKETS } from './analytics.schema.js';

const fixture = {
  generatedAt: '2026-09-08T09:30:00Z',
  today: '2026-09-08',
  totals: {
    totalProducts: 21,
    totalInventory: 372,
    catalogValue: 5123400,
    avgPrice: 21430.5,
    minPrice: 3200,
    maxPrice: 78200,
    active: 15,
    expired: 4,
    inactive: 2,
    outOfStock: 4,
    distinctDestinations: 12,
  },
  byCategory: [
    { category: 'cultural', label: 'Cultural', count: 4, inventory: 40, value: 100000, avgPrice: 12000 },
  ],
  byStatus: [
    { key: 'active', count: 15 },
    { key: 'expired', count: 4 },
    { key: 'inactive', count: 2 },
  ],
  topDestinations: [{ destination: 'Colombo', count: 7, inventory: 120, value: 900000 }],
  expiry: [
    { bucket: 'expired', count: 4 },
    { bucket: 'd7', count: 1 },
    { bucket: 'd30', count: 3 },
    { bucket: 'd90', count: 5 },
    { bucket: 'later', count: 8 },
  ],
  createdByMonth: Array.from({ length: 12 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, '0')}`,
    count: i,
  })),
};

describe('productAnalyticsSchema', () => {
  it('accepts a well-formed payload', () => {
    expect(productAnalyticsSchema.safeParse(fixture).success).toBe(true);
  });

  it('requires exactly 12 months and 5 expiry buckets', () => {
    expect(
      productAnalyticsSchema.safeParse({ ...fixture, createdByMonth: fixture.createdByMonth.slice(0, 11) })
        .success,
    ).toBe(false);
    expect(
      productAnalyticsSchema.safeParse({ ...fixture, expiry: fixture.expiry.slice(0, 4) }).success,
    ).toBe(false);
  });

  it('rejects an unknown expiry bucket key', () => {
    const bad = { ...fixture, expiry: [...fixture.expiry.slice(0, 4), { bucket: 'someday', count: 1 }] };
    expect(productAnalyticsSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects the "+00:00" offset form of generatedAt (must be Z)', () => {
    expect(
      productAnalyticsSchema.safeParse({ ...fixture, generatedAt: '2026-09-08T09:30:00+00:00' }).success,
    ).toBe(false);
  });

  it('exposes the five buckets in ordinal order', () => {
    expect(EXPIRY_BUCKETS).toEqual(['expired', 'd7', 'd30', 'd90', 'later']);
  });
});
