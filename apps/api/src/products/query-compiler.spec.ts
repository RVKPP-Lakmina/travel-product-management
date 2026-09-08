import { describe, expect, it, vi } from 'vitest';
import type { ProductQuery } from '@travel/validation';
import { productQueryToFilter, runProductQuery } from './query-compiler.js';

describe('productQueryToFilter — adapts plain list params onto the shared filter DSL', () => {
  const baseQuery: ProductQuery = {
    status: 'any',
    sort: 'created_desc',
    limit: 20,
    offset: 0,
  };

  it('wraps a single destination/category into the DSL arrays', () => {
    const filter = productQueryToFilter({ ...baseQuery, destination: 'Colombo', category: 'dining' });
    expect(filter.destinations).toEqual(['Colombo']);
    expect(filter.categories).toEqual(['dining']);
  });

  it('splits a multi-word q into individual keyword tokens', () => {
    const filter = productQueryToFilter({ ...baseQuery, q: 'dinner buffet colombo' });
    expect(filter.keywords).toEqual(['dinner', 'buffet', 'colombo']);
  });

  it('produces empty arrays when no destination/category/q given', () => {
    const filter = productQueryToFilter(baseQuery);
    expect(filter.destinations).toEqual([]);
    expect(filter.categories).toEqual([]);
    expect(filter.keywords).toEqual([]);
  });

  it('passes sort/limit/offset through unchanged', () => {
    const filter = productQueryToFilter({ ...baseQuery, sort: 'price_asc', limit: 5, offset: 10 });
    expect(filter.sort).toBe('price_asc');
    expect(filter.limit).toBe(5);
    expect(filter.offset).toBe(10);
  });
});

/**
 * A minimal fluent mock of the subset of the supabase-js query builder
 * `runProductQuery` uses. Records every call so tests can assert exactly
 * which PostgREST methods were invoked and with what arguments — this is
 * what proves the validity/injection-safety properties without needing a
 * live database: e.g. "keywords never reach .or()" is a static fact about
 * which mock methods get called, not something that needs a real DB to see.
 */
function createMockQuery(result: { data: unknown[]; count: number; error: unknown }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['in', 'eq', 'gte', 'lte', 'textSearch', 'order', 'range', 'or', 'filter', 'not']) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  // A plain object with a `then` is a legitimate, minimal thenable — it's
  // what lets `await query` resolve after the chain of .in()/.eq()/etc.
  // calls, mirroring how the real supabase-js query builder works
  // (PostgrestBuilder is itself thenable). A deliberate, narrowly-scoped
  // test double of that real API, not the accidental-thenable footgun this
  // lint rule otherwise guards against.
  // oxlint-disable-next-line unicorn/no-thenable
  builder.then = (resolve: (v: typeof result) => unknown) => resolve(result);
  return { builder, calls };
}

describe('runProductQuery — the compiled query, asserted by which methods fire', () => {
  function mockSupabase(result = { data: [], count: 0, error: null }) {
    const { builder, calls } = createMockQuery(result);
    const supabase: any = {
      from: vi.fn(() => ({ select: vi.fn(() => builder) })),
    };
    return { supabase, calls };
  }

  const emptyFilter = {
    destinations: [],
    categories: [],
    status: 'any' as const,
    price: null,
    inventory: null,
    validOn: null,
    keywords: [],
    sort: 'relevance' as const,
    limit: 20,
    offset: 0,
  };

  it('reads products_listable, never the base products table', async () => {
    const { supabase } = mockSupabase();
    await runProductQuery(supabase, emptyFilter);
    expect(supabase.from).toHaveBeenCalledWith('products_listable');
    expect(supabase.from).not.toHaveBeenCalledWith('products');
  });

  it('uses .in() for multi-value category/destination matching — never .or()', async () => {
    const { supabase, calls } = mockSupabase();
    await runProductQuery(supabase, {
      ...emptyFilter,
      categories: ['dining'],
      destinations: ['Colombo'],
    });
    const methods = calls.map((c) => c.method);
    expect(methods).toContain('in');
    expect(methods).not.toContain('or');
    expect(methods).not.toContain('filter');
  });

  it('keywords go through .textSearch with websearch semantics, never .or()/.filter()', async () => {
    const { supabase, calls } = mockSupabase();
    await runProductQuery(supabase, { ...emptyFilter, keywords: ['buffet', 'dinner'] });
    const textSearchCall = calls.find((c) => c.method === 'textSearch');
    expect(textSearchCall).toBeDefined();
    expect(textSearchCall?.args[0]).toBe('search_tsv');
    expect(textSearchCall?.args[1]).toBe('buffet dinner');
    const options = textSearchCall?.args[2] as { type?: string } | undefined;
    expect(options?.type).toBe('websearch');
    expect(calls.map((c) => c.method)).not.toContain('or');
  });

  it('applies price range as bound gte/lte calls, not string interpolation', async () => {
    const { supabase, calls } = mockSupabase();
    await runProductQuery(supabase, {
      ...emptyFilter,
      price: { min: 1000, max: 10000, currency: 'LKR' },
    });
    const gte = calls.find((c) => c.method === 'gte');
    const lte = calls.find((c) => c.method === 'lte');
    expect(gte?.args).toEqual(['price', 1000]);
    expect(lte?.args).toEqual(['price', 10000]);
  });

  it('maps every sort option to a fixed, known column — never an arbitrary one', async () => {
    for (const [sort, expectedColumn] of [
      ['price_asc', 'price'],
      ['price_desc', 'price'],
      ['valid_until_asc', 'valid_until'],
      ['created_desc', 'created_at'],
    ] as const) {
      const { supabase, calls } = mockSupabase();
      await runProductQuery(supabase, { ...emptyFilter, sort });
      const orderCall = calls.find((c) => c.method === 'order');
      expect(orderCall?.args[0]).toBe(expectedColumn);
    }
  });

  it('always applies .range() from limit/offset, regardless of what was asked for elsewhere', async () => {
    const { supabase, calls } = mockSupabase();
    await runProductQuery(supabase, { ...emptyFilter, limit: 10, offset: 20 });
    const rangeCall = calls.find((c) => c.method === 'range');
    expect(rangeCall?.args).toEqual([20, 29]);
  });

  it('throws on a Supabase error rather than silently returning an empty result', async () => {
    const { supabase } = mockSupabase({ data: [], count: 0, error: { message: 'boom' } as any });
    await expect(runProductQuery(supabase, emptyFilter)).rejects.toBeTruthy();
  });
});
