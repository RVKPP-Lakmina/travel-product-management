import type { SupabaseClient } from '@supabase/supabase-js';
import { searchFilterSchema, type ProductQuery, type SearchFilter } from '@travel/validation';
import type { ProductRow } from './products.types.js';

/**
 * The ONE place a SearchFilter becomes a database query. Both the plain
 * (non-AI) list endpoint and — from Phase 3 — AI search funnel through
 * this same function, via `productQueryToFilter()` below or directly with
 * a model-produced (and zod-revalidated) filter. One code path means one
 * thing to test and one thing to review for the validity predicate.
 *
 * Always reads `products_listable`, never the base `products` table — that
 * view is what excludes expired rows (see supabase/migrations/
 * 20260908000003_views.sql). This function has no way to accidentally read
 * the base table, which is the point: the AI search path cannot forget the
 * validity filter because it was never given the option.
 *
 * A note on what this function deliberately does NOT do: it never
 * interpolates a string into `.or()`, `.filter()`, or `.not()` — those take
 * a raw PostgREST filter grammar string, and concatenating user/model text
 * into one is a PostgREST-level injection vector that "we're using an ORM"
 * does not protect against. Multi-value matching uses `.in()` (bound
 * values); keyword matching uses `.textSearch()` with `websearch_to_tsquery`
 * semantics, which never throws on malformed input and treats operators as
 * literal search terms rather than executable syntax.
 */
export async function runProductQuery(
  supabase: SupabaseClient,
  filter: SearchFilter,
): Promise<{ rows: ProductRow[]; total: number }> {
  let query = supabase.from('products_listable').select('*', { count: 'exact' });

  if (filter.categories.length > 0) {
    query = query.in('category', filter.categories);
  }
  if (filter.destinations.length > 0) {
    query = query.in('destination', filter.destinations);
  }
  if (filter.status !== 'any') {
    query = query.eq('status', filter.status);
  }
  if (filter.price?.min != null) {
    query = query.gte('price', filter.price.min);
  }
  if (filter.price?.max != null) {
    query = query.lte('price', filter.price.max);
  }
  if (filter.inventory?.min != null) {
    query = query.gte('inventory_count', filter.inventory.min);
  }
  if (filter.validOn) {
    query = query.lte('valid_from', filter.validOn).gte('valid_until', filter.validOn);
  }
  if (filter.keywords.length > 0) {
    query = query.textSearch('search_tsv', filter.keywords.join(' '), {
      type: 'websearch',
      config: 'english',
    });
  }

  switch (filter.sort) {
    case 'price_asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false });
      break;
    case 'valid_until_asc':
      query = query.order('valid_until', { ascending: true });
      break;
    case 'created_desc':
      query = query.order('created_at', { ascending: false });
      break;
    case 'relevance':
    default:
      // True relevance ranking (ts_rank_cd) isn't reachable through
      // supabase-js's builder surface without a dedicated RPC — a
      // reasonable future enhancement (a `search_products_ranked` SQL
      // function). Newest-first is a sane default in the meantime.
      query = query.order('created_at', { ascending: false });
      break;
  }

  query = query.range(filter.offset, filter.offset + filter.limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { rows: (data ?? []) as ProductRow[], total: count ?? 0 };
}

/**
 * Adapts the plain (non-AI) list endpoint's simpler query params onto the
 * same SearchFilter shape AI search produces, so both paths share the one
 * compiler above.
 */
export function productQueryToFilter(query: ProductQuery): SearchFilter {
  return searchFilterSchema.parse({
    destinations: query.destination ? [query.destination] : [],
    categories: query.category ? [query.category] : [],
    status: query.status,
    // Split into individual tokens (schema caps each at 6/40 chars) rather
    // than passing the whole phrase as one element, which would blow the
    // per-keyword length cap on anything longer than a couple of words.
    keywords: query.q ? query.q.trim().split(/\s+/).slice(0, 6) : [],
    sort: query.sort,
    limit: query.limit,
    offset: query.offset,
  });
}
