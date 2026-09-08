/**
 * The closed category list. Mirrors `public.categories` in
 * supabase/migrations/20260908000001_init.sql — keep the two in sync.
 *
 * This list is a security control as much as a data-modeling one: it is
 * the enum used both by the AI product-generation schema
 * (`aiGeneratedProductWire.suggestedCategory`) and the AI search filter DSL
 * (`searchFilterSchema.categories`), so neither the model nor an attacker
 * can smuggle an arbitrary string into a column/filter that every other
 * layer treats as a closed enum.
 */
export const CATEGORY_SLUGS = [
  'dining',
  'excursion',
  'safari',
  'accommodation',
  'transport',
  'family',
  'wellness',
  'cultural',
  'adventure',
  'shopping',
] as const;

export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export const CATEGORY_LABELS: Record<CategorySlug, string> = {
  dining: 'Dining',
  excursion: 'Excursion',
  safari: 'Wildlife Safari',
  accommodation: 'Accommodation',
  transport: 'Transport',
  family: 'Family Package',
  wellness: 'Wellness & Spa',
  cultural: 'Cultural',
  adventure: 'Adventure',
  shopping: 'Shopping',
};
