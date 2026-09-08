import { z } from 'zod';
import { categorySchema } from './product.schema.js';

/**
 * Response shape of GET /api/products/analytics — the single-payload read
 * model from `public.product_analytics()` (migration 0008). The API
 * Zod-parses the RPC output against this on the way out, so any drift
 * between a jsonb key and this schema is a hard 500 at the boundary rather
 * than an `undefined` inside a chart.
 */

export const EXPIRY_BUCKETS = ['expired', 'd7', 'd30', 'd90', 'later'] as const;
export type ExpiryBucket = (typeof EXPIRY_BUCKETS)[number];

export const EXPIRY_BUCKET_LABELS: Record<ExpiryBucket, string> = {
  expired: 'Expired',
  d7: 'Next 7 days',
  d30: '8–30 days',
  d90: '31–90 days',
  later: '90+ days',
};

const int = z.number().int();

export const analyticsTotalsSchema = z.object({
  totalProducts: int,
  totalInventory: int,
  catalogValue: z.number(),
  avgPrice: z.number(),
  minPrice: z.number(),
  maxPrice: z.number(),
  active: int,
  expired: int,
  inactive: int,
  outOfStock: int,
  distinctDestinations: int,
});
export type AnalyticsTotals = z.infer<typeof analyticsTotalsSchema>;

export const categoryBreakdownSchema = z.object({
  category: categorySchema,
  label: z.string(),
  count: int,
  inventory: int,
  value: z.number(),
  avgPrice: z.number(),
});
export type CategoryBreakdown = z.infer<typeof categoryBreakdownSchema>;

export const productAnalyticsSchema = z.object({
  generatedAt: z.iso.datetime(),
  today: z.iso.date(),
  totals: analyticsTotalsSchema,
  byCategory: z.array(categoryBreakdownSchema),
  /**
   * `inactive` here EXCLUDES expired so the three counts sum to
   * totalProducts — unlike totals.inactive, which follows the dashboard's
   * non-exclusive definition (see migration 0003's orthogonality note).
   */
  byStatus: z
    .array(z.object({ key: z.enum(['active', 'expired', 'inactive']), count: int }))
    .length(3),
  topDestinations: z
    .array(z.object({ destination: z.string(), count: int, inventory: int, value: z.number() }))
    .max(8),
  expiry: z.array(z.object({ bucket: z.enum(EXPIRY_BUCKETS), count: int })).length(5),
  createdByMonth: z
    .array(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), count: int }))
    .length(12),
});

export type ProductAnalytics = z.infer<typeof productAnalyticsSchema>;
