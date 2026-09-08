import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductQuery,
  ExpiredQuery,
  ProductResponse,
  DashboardStats,
  ProductAnalytics,
  SearchFilter,
} from '@travel/validation';
import { productAnalyticsSchema } from '@travel/validation';
import { SUPABASE_CLIENT } from '../common/supabase/supabase.constants.js';
import { toProductResponse } from './mappers.js';
import { productQueryToFilter, runProductQuery } from './query-compiler.js';
import type { DashboardStatsRow, ProductRow } from './products.types.js';

@Injectable()
export class ProductsService {
  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient) {}

  async create(userId: string, input: CreateProductInput): Promise<ProductResponse> {
    const { data, error } = await this.supabase
      .from('products')
      .insert({
        name: input.name,
        destination: input.destination,
        category: input.category,
        description: input.description,
        price: input.price,
        inventory_count: input.inventoryCount,
        valid_from: input.validFrom,
        valid_until: input.validUntil,
        status: input.status,
        highlights: input.highlights,
        inclusions: input.inclusions,
        tags: input.tags,
        // Cosmetic provenance hint, and the one create field that DOES come
        // from the body (see migration 0006 / product.schema.ts).
        ai_generated: input.aiGenerated,
        // created_by is NEVER taken from the request body — it isn't even
        // in createProductSchema. It comes exclusively from the verified
        // JWT subject via @CurrentUser().
        created_by: userId,
      })
      .select('*')
      .single();

    if (error) throw error;
    return toProductResponse(data as ProductRow);
  }

  async findMany(query: ProductQuery): Promise<{ items: ProductResponse[]; total: number }> {
    const filter = productQueryToFilter(query);
    return this.findManyByFilter(filter);
  }

  /** Used directly by AI search (Phase 3) with a model-produced, zod-revalidated filter. */
  async findManyByFilter(filter: SearchFilter): Promise<{ items: ProductResponse[]; total: number }> {
    const { rows, total } = await runProductQuery(this.supabase, filter);
    return { items: rows.map(toProductResponse), total };
  }

  /**
   * Deliberately reads the BASE table, not `products_listable` — an
   * expired product must still be openable so its dates can be corrected.
   * `isExpired` on the response drives the UI's warning banner for this
   * case. Not ownership-scoped: any authenticated user may view any
   * product's detail (this is a catalog, not a personal workspace) — only
   * mutation is ownership-restricted, below.
   */
  async findOne(id: string): Promise<ProductResponse> {
    const { data, error } = await this.supabase.from('products').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Product not found');
    return toProductResponse(data as ProductRow);
  }

  /**
   * Ownership check happens IN the query (`.eq('created_by', userId)`),
   * not as a separate existence check beforehand. Zero rows updated is
   * reported as 404, not 403 — a 403 would confirm the row exists under
   * someone else's id, which is a (minor, but free to avoid) enumeration
   * oracle.
   */
  async update(id: string, userId: string, input: UpdateProductInput): Promise<ProductResponse> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.destination !== undefined) patch.destination = input.destination;
    if (input.category !== undefined) patch.category = input.category;
    if (input.description !== undefined) patch.description = input.description;
    if (input.price !== undefined) patch.price = input.price;
    if (input.inventoryCount !== undefined) patch.inventory_count = input.inventoryCount;
    if (input.validFrom !== undefined) patch.valid_from = input.validFrom;
    if (input.validUntil !== undefined) patch.valid_until = input.validUntil;
    if (input.status !== undefined) patch.status = input.status;
    if (input.highlights !== undefined) patch.highlights = input.highlights;
    if (input.inclusions !== undefined) patch.inclusions = input.inclusions;
    if (input.tags !== undefined) patch.tags = input.tags;

    const { data, error } = await this.supabase
      .from('products')
      .update(patch)
      .eq('id', id)
      .eq('created_by', userId)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundException('Product not found');
    return toProductResponse(data as ProductRow);
  }

  async remove(id: string, userId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('created_by', userId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundException('Product not found');
  }

  /**
   * Browse the rows `products_listable` hides. Reads `products_expired`
   * (0007) directly — a separate, narrow path that the AI search compiler
   * never touches, so the "can't accidentally read expired rows" invariant
   * in query-compiler.ts stays intact. Sort is fixed to most-recently-
   * expired first; the only optional slice is by category.
   */
  async findExpired(query: ExpiredQuery): Promise<{ items: ProductResponse[]; total: number }> {
    let q = this.supabase
      .from('products_expired')
      .select('*', { count: 'exact' })
      .order('valid_until', { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (query.category) q = q.eq('category', query.category);

    const { data, error, count } = await q;
    if (error) throw error;
    return { items: (data ?? []).map((r) => toProductResponse(r as ProductRow)), total: count ?? 0 };
  }

  /** Reads the base table via RPC — expired rows stay countable even though they're not listable. */
  async dashboardStats(): Promise<DashboardStats> {
    const { data, error } = await this.supabase.rpc('dashboard_stats').single();
    if (error) throw error;
    const row = data as DashboardStatsRow;
    return {
      total: row.total,
      active: row.active,
      expired: row.expired,
      inactive: row.inactive,
    };
  }

  /**
   * The Analytics page read model — one jsonb payload from
   * `product_analytics()` (migration 0008), over the BASE table so expired
   * rows are counted. Zod-parsed here (not an `as` cast like elsewhere in
   * this file) precisely because the payload is hand-built JSON in SQL: a
   * mistyped jsonb key should fail loudly at the boundary, not surface as
   * `undefined` inside a chart.
   */
  async analytics(): Promise<ProductAnalytics> {
    const { data, error } = await this.supabase.rpc('product_analytics');
    if (error) throw error;
    return productAnalyticsSchema.parse(data);
  }

  /**
   * For export: same validity-filtered, same-compiler read as listing —
   * an exported spreadsheet must not contain expired products either.
   * Capped well under Supabase's `max_rows` config as a backstop, not the
   * primary control (the primary control is the caller's rate limit).
   */
  async findAllForExport(filter: SearchFilter): Promise<ProductResponse[]> {
    const { rows } = await runProductQuery(this.supabase, { ...filter, limit: 1000, offset: 0 });
    return rows.map(toProductResponse);
  }
}
