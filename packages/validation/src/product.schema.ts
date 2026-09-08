import { z } from 'zod';
import { CATEGORY_SLUGS } from './categories.js';

export const PRODUCT_STATUS = ['active', 'inactive'] as const;
export const productStatusSchema = z.enum(PRODUCT_STATUS);
export const categorySchema = z.enum(CATEGORY_SLUGS);

/**
 * Fields a client may submit when creating a product. Deliberately does NOT
 * include `id`, `createdBy`, `createdAt`, or `updatedAt` — this is the
 * mass-assignment defense. If a client sends `{ createdBy: '<other-user>' }`
 * in the body, `z.strictObject` rejects the request instead of silently
 * stripping the field, because silent stripping would hide the attempt
 * rather than surface it.
 */
export const createProductSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(200),
    destination: z.string().trim().min(2).max(120),
    category: categorySchema,
    description: z.string().trim().min(10).max(4000),
    price: z.number().nonnegative().max(100_000_000),
    inventoryCount: z.number().int().nonnegative(),
    validFrom: z.iso.date(),
    validUntil: z.iso.date(),
    status: productStatusSchema.default('active'),
    highlights: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    inclusions: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
    // Cosmetic provenance hint — true when this product was created from an
    // AI draft. Intentionally client-settable (see migration 0006): it is
    // not an authorization or billing signal, so a dishonest value only
    // mislabels the sparkle icon. `created_by` etc. remain server-only.
    aiGenerated: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    if (val.validUntil < val.validFrom) {
      ctx.addIssue({
        code: 'custom',
        path: ['validUntil'],
        message: 'validUntil must be on or after validFrom',
      });
    }
  });

export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * Partial update — every field optional, but each one that IS present is
 * validated exactly as strictly as on create. Still a `strictObject`, still
 * excludes `id`/`createdBy`/timestamps.
 */
export const updateProductSchema = z
  .strictObject({
    name: z.string().trim().min(2).max(200).optional(),
    destination: z.string().trim().min(2).max(120).optional(),
    category: categorySchema.optional(),
    description: z.string().trim().min(10).max(4000).optional(),
    price: z.number().nonnegative().max(100_000_000).optional(),
    inventoryCount: z.number().int().nonnegative().optional(),
    validFrom: z.iso.date().optional(),
    validUntil: z.iso.date().optional(),
    status: productStatusSchema.optional(),
    highlights: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
    inclusions: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
    tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.validFrom && val.validUntil && val.validUntil < val.validFrom) {
      ctx.addIssue({
        code: 'custom',
        path: ['validUntil'],
        message: 'validUntil must be on or after validFrom',
      });
    }
  });

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/** Query params for GET /products (plain, non-AI list/search). */
export const productQuerySchema = z.strictObject({
  destination: z.string().trim().min(1).max(60).optional(),
  category: categorySchema.optional(),
  status: z.enum(['active', 'inactive', 'any']).default('any'),
  q: z.string().trim().min(1).max(200).optional(),
  sort: z
    .enum(['relevance', 'price_asc', 'price_desc', 'valid_until_asc', 'created_desc'])
    .default('created_desc'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});

export type ProductQuery = z.infer<typeof productQuerySchema>;

/**
 * Query params for GET /products/expired — the browse view over
 * `products_expired` (rows products_listable hides). Intentionally minimal:
 * this list exists to *find and renew* lapsed products, not to slice them.
 * Sort is fixed server-side to most-recently-expired first.
 */
export const expiredQuerySchema = z.strictObject({
  category: categorySchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});

export type ExpiredQuery = z.infer<typeof expiredQuerySchema>;

/**
 * Shape returned to clients. `isExpired` is always computed server-side
 * (never trust or accept it from a client) so the browser never has to do
 * date math or guess a timezone — see products.service's mapper.
 */
export const productResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  destination: z.string(),
  category: categorySchema,
  description: z.string(),
  price: z.number(),
  currency: z.literal('LKR'),
  inventoryCount: z.number().int(),
  validFrom: z.iso.date(),
  validUntil: z.iso.date(),
  status: productStatusSchema,
  highlights: z.array(z.string()),
  inclusions: z.array(z.string()),
  tags: z.array(z.string()),
  imageUrl: z.url().nullable(),
  isExpired: z.boolean(),
  aiGenerated: z.boolean(),
  createdBy: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type ProductResponse = z.infer<typeof productResponseSchema>;

export const dashboardStatsSchema = z.object({
  total: z.number().int(),
  active: z.number().int(),
  expired: z.number().int(),
  inactive: z.number().int(),
});

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
