import { z } from 'zod';
import { CATEGORY_SLUGS } from './categories.js';
import { productResponseSchema } from './product.schema.js';

// ============================================================================
// Date anchors — how the API tells the model "today" and common relative
// dates without ever asking it to compute one. The server resolves an
// anchor name to a literal date from its own table (apps/api/src/ai/
// generation/date-anchors.ts); the model's only job is picking the right
// anchor, or reporting an explicit date the user actually typed. See
// aiGeneratedProductWire.validity below and Phase 3c of the plan for why.
// ============================================================================
export const DATE_ANCHORS = [
  'today',
  'endOfThisWeek',
  'endOfThisMonth',
  'endOfNextMonth',
  'endOfThisQuarter',
  'endOfThisYear',
  'plus7d',
  'plus30d',
  'plus90d',
] as const;

export type DateAnchor = (typeof DATE_ANCHORS)[number];

const anchoredDateSchema = z.object({
  kind: z.enum(['anchor', 'explicit', 'unknown']),
  anchor: z.enum(DATE_ANCHORS).nullable(),
  date: z.iso.date().nullable(),
});

// ============================================================================
// AI product generation — the OpenAI Structured Outputs wire contract.
//
// Deliberately flat and loose: plain strings, closed enums, arrays, and
// NULLABLE (never optional) fields. OpenAI's strict JSON Schema subset
// requires every property to be listed in `required` with
// `additionalProperties: false` — optional fields aren't representable
// there, but a nullable field is. The REAL constraints (min lengths, price
// bounds, date ordering) live in createProductSchema (product.schema.ts)
// and are applied AFTER parsing — model output is untrusted input,
// validated exactly like a hostile HTTP body, never trusted because it came
// from "our own" AI call.
// ============================================================================
export const aiGeneratedProductWire = z.object({
  name: z.string(),
  description: z.string(),
  highlights: z.array(z.string()),
  inclusions: z.array(z.string()),
  suggestedCategory: z.enum(CATEGORY_SLUGS),
  destination: z.string().nullable(),
  tags: z.array(z.string()),
  price: z.object({
    amount: z.number().nullable(),
    currency: z.literal('LKR'),
    confidence: z.enum(['stated', 'inferred', 'unknown']),
  }),
  validity: z.object({
    from: anchoredDateSchema,
    until: anchoredDateSchema,
  }),
  assumptions: z.array(z.string()),
});

export type AiGeneratedProductWire = z.infer<typeof aiGeneratedProductWire>;

/**
 * What the generation endpoint actually returns to the frontend, after the
 * wire response has been resolved (anchors → real dates), re-validated
 * against createProductSchema's real constraints, and reshaped into the
 * same camelCase the product form uses. The draft is form state ONLY — see
 * Phase 3c: saving always goes through the ordinary POST /products path
 * with the ordinary validation, so there is no route by which model output
 * reaches the database without the same checks as hand-typed input.
 */
export const aiGenerateProductResponseSchema = z.object({
  requestId: z.uuid(),
  source: z.enum(['ai', 'heuristic']),
  draft: z.object({
    name: z.string().nullable(),
    description: z.string().nullable(),
    destination: z.string().nullable(),
    category: z.enum(CATEGORY_SLUGS).nullable(),
    price: z.number().nullable(),
    inventoryCount: z.number().nullable(),
    validFrom: z.iso.date().nullable(),
    validUntil: z.iso.date().nullable(),
    status: z.enum(['active', 'inactive']),
    highlights: z.array(z.string()),
    inclusions: z.array(z.string()),
    tags: z.array(z.string()),
  }),
  meta: z.object({
    assumptions: z.array(z.string()),
    warnings: z.array(z.string()),
    unresolvedFields: z.array(z.string()),
    resolvedAnchors: z.record(z.string(), z.string()),
    model: z.string(),
    latencyMs: z.number(),
    tokens: z.object({ in: z.number(), out: z.number() }),
  }),
});

export type AiGenerateProductResponse = z.infer<typeof aiGenerateProductResponseSchema>;

/**
 * The natural-language generation request itself. Length-capped BEFORE the
 * call reaches OpenAI — rejecting an oversized prompt at the pipe is the
 * cheapest possible defense against both cost abuse and a longer surface
 * for injection payloads.
 */
export const aiGenerateProductRequestSchema = z.strictObject({
  prompt: z.string().trim().min(5).max(1000),
});

// ============================================================================
// AI search filter DSL — what the model is allowed to say, full stop.
//
// This is the core security + architecture decision for AI search: the
// model NEVER produces SQL or a query string. It produces exactly this
// closed, typed object, which is re-validated here (never trust the model's
// own claim that its JSON matches the schema) and then compiled into a
// supabase-js query by apps/api/src/products/query-compiler.ts — the same
// compiler the plain (non-AI) list endpoint uses.
//
// No generic {field, op, value} triples — a closed record of NAMED fields
// is far harder to abuse and each field maps to exactly one known SQL
// construct. `sort` is a fixed enum (arbitrary sort-column selection is a
// real injection-adjacent bug class in filter DSLs). `limit`/`offset` are
// clamped here AND again server-side regardless of what the model claims.
// ============================================================================
// Extracted as a plain shape object (not a schema) so it can be reused by
// TWO schemas below: `searchFilterSchema` (the DSL as re-validated and
// compiled into a query) and `searchFilterWireSchema` (what the model is
// actually asked to produce, which additionally needs an `explanation`
// field). Kept as one shape definition rather than two independently
// maintained schemas that could silently drift apart.
const searchFilterShape = {
  destinations: z.array(z.string().trim().min(2).max(60)).max(5).default([]),
  categories: z.array(z.enum(CATEGORY_SLUGS)).max(5).default([]),
  status: z.enum(['active', 'inactive', 'any']).default('any'),
  price: z
    .strictObject({
      min: z.number().nonnegative().max(100_000_000).nullable(),
      max: z.number().nonnegative().max(100_000_000).nullable(),
      currency: z.literal('LKR'),
    })
    .nullable()
    .default(null),
  inventory: z
    .strictObject({
      min: z.number().int().min(0).nullable(),
    })
    .nullable()
    .default(null),
  validOn: z.iso.date().nullable().default(null),
  keywords: z.array(z.string().trim().min(2).max(40)).max(6).default([]),
  sort: z
    .enum(['relevance', 'price_asc', 'price_desc', 'valid_until_asc', 'created_desc'])
    .default('relevance'),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).max(1000).default(0),
};

function priceRangeRefine(val: { price: { min: number | null; max: number | null } | null }, ctx: z.RefinementCtx) {
  if (val.price && val.price.min != null && val.price.max != null && val.price.min > val.price.max) {
    ctx.addIssue({ code: 'custom', path: ['price', 'min'], message: 'price.min must be <= price.max' });
  }
}

export const searchFilterSchema = z.strictObject(searchFilterShape).superRefine(priceRangeRefine);

export type SearchFilter = z.infer<typeof searchFilterSchema>;

/**
 * What the model is actually asked to produce for AI search — the DSL
 * fields above PLUS a one-sentence `explanation`. This, not
 * `searchFilterSchema`, is what gets turned into the OpenAI strict JSON
 * Schema (apps/api/src/ai/search/search.service.ts). Sending
 * `searchFilterSchema` alone would leave the model with literally nowhere
 * to put the explanation the prompt asks for — strict mode's
 * `additionalProperties: false` means a field absent from the schema
 * cannot appear in the output at all, prompt instructions notwithstanding.
 * The server extracts `filter` fields back out via `searchFilterSchema`
 * before compiling a query — the wire schema is never used as the trusted
 * shape on its own.
 */
export const searchFilterWireSchema = z
  .strictObject({
    ...searchFilterShape,
    explanation: z.string(),
  })
  .superRefine(priceRangeRefine);

export const aiSearchRequestSchema = z.strictObject({
  query: z.string().trim().min(2).max(400),
});

export const aiSearchResponseSchema = z.object({
  requestId: z.uuid(),
  source: z.enum(['ai', 'heuristic']),
  filter: searchFilterSchema,
  // The one free-text field the model controls that reaches the UI.
  // Capped and stripped of control chars server-side; rendered as a plain
  // React text node on the frontend, never through dangerouslySetInnerHTML
  // or a markdown renderer.
  explanation: z.string().max(200),
  results: z.array(productResponseSchema),
  total: z.number().int(),
  meta: z.object({
    latencyMs: z.number(),
    cached: z.boolean(),
    model: z.string().nullable(),
  }),
});

export type AiSearchResponse = z.infer<typeof aiSearchResponseSchema>;
