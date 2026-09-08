import { describe, expect, it, vi } from 'vitest';
import type { ExpiredQuery } from '@travel/validation';
import { ProductsService } from './products.service.js';

const ANALYTICS_PAYLOAD = {
  generatedAt: '2026-09-08T09:30:00Z',
  today: '2026-09-08',
  totals: {
    totalProducts: 2,
    totalInventory: 10,
    catalogValue: 1000,
    avgPrice: 500,
    minPrice: 200,
    maxPrice: 800,
    active: 1,
    expired: 1,
    inactive: 0,
    outOfStock: 1,
    distinctDestinations: 2,
  },
  byCategory: [{ category: 'dining', label: 'Dining', count: 2, inventory: 10, value: 1000, avgPrice: 500 }],
  byStatus: [
    { key: 'active', count: 1 },
    { key: 'expired', count: 1 },
    { key: 'inactive', count: 0 },
  ],
  topDestinations: [{ destination: 'Colombo', count: 2, inventory: 10, value: 1000 }],
  expiry: [
    { bucket: 'expired', count: 1 },
    { bucket: 'd7', count: 0 },
    { bucket: 'd30', count: 1 },
    { bucket: 'd90', count: 0 },
    { bucket: 'later', count: 0 },
  ],
  createdByMonth: Array.from({ length: 12 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, '0')}`,
    count: 0,
  })),
};

/**
 * Fluent mock of the subset of the supabase-js builder `findExpired` uses,
 * in the same "assert by which methods fire" style as query-compiler.spec.
 * The security-relevant fact under test: this path reads `products_expired`
 * and never the base `products` table.
 */
function mockSupabase(result: { data: unknown[]; count: number; error: unknown } = { data: [], count: 0, error: null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'order', 'range', 'eq']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  // oxlint-disable-next-line unicorn/no-thenable
  builder.then = (resolve: (v: typeof result) => unknown) => resolve(result);
  const from = vi.fn(() => builder);
  return { supabase: { from } as any, from, calls };
}

const baseQuery: ExpiredQuery = { limit: 20, offset: 0 };

describe('ProductsService.findExpired', () => {
  it('reads products_expired, never the base products table', async () => {
    const { supabase, from } = mockSupabase();
    await new ProductsService(supabase).findExpired(baseQuery);
    expect(from).toHaveBeenCalledWith('products_expired');
    expect(from).not.toHaveBeenCalledWith('products');
  });

  it('sorts most-recently-expired first and paginates from limit/offset', async () => {
    const { supabase, calls } = mockSupabase();
    await new ProductsService(supabase).findExpired({ limit: 10, offset: 20 });
    const order = calls.find((c) => c.method === 'order');
    const range = calls.find((c) => c.method === 'range');
    expect(order?.args).toEqual(['valid_until', { ascending: false }]);
    expect(range?.args).toEqual([20, 29]);
  });

  it('filters by category only when one is supplied', async () => {
    const withCat = mockSupabase();
    await new ProductsService(withCat.supabase).findExpired({ ...baseQuery, category: 'dining' });
    expect(withCat.calls.find((c) => c.method === 'eq')?.args).toEqual(['category', 'dining']);

    const withoutCat = mockSupabase();
    await new ProductsService(withoutCat.supabase).findExpired(baseQuery);
    expect(withoutCat.calls.some((c) => c.method === 'eq')).toBe(false);
  });

  it('throws on a Supabase error rather than returning an empty page', async () => {
    const { supabase } = mockSupabase({ data: [], count: 0, error: { message: 'boom' } });
    await expect(new ProductsService(supabase).findExpired(baseQuery)).rejects.toBeTruthy();
  });
});

describe('ProductsService.analytics', () => {
  it('calls the product_analytics RPC and returns the parsed payload', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: ANALYTICS_PAYLOAD, error: null });
    const result = await new ProductsService({ rpc } as any).analytics();
    expect(rpc).toHaveBeenCalledWith('product_analytics');
    expect(result.totals.totalProducts).toBe(2);
    expect(result.byStatus).toHaveLength(3);
  });

  it('throws (not returns undefined) when the RPC payload drifts from the schema', async () => {
    const bad = { ...ANALYTICS_PAYLOAD, expiry: ANALYTICS_PAYLOAD.expiry.slice(0, 3) };
    const rpc = vi.fn().mockResolvedValue({ data: bad, error: null });
    await expect(new ProductsService({ rpc } as any).analytics()).rejects.toBeTruthy();
  });

  it('throws on a Supabase RPC error', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(new ProductsService({ rpc } as any).analytics()).rejects.toBeTruthy();
  });
});
