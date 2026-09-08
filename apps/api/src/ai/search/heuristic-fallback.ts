import { searchFilterSchema, type CategorySlug, type SearchFilter } from '@travel/validation';

export interface CategoryLookup {
  slug: CategorySlug;
  name: string;
  synonyms: string[];
}

const STATUS_ACTIVE_RE = /\bactive\b/i;
const STATUS_INACTIVE_RE = /\binactive\b/i;

const PRICE_MAX_RE = /(?:below|under|less\s*than|cheaper\s*than)\s*(?:lkr|rs\.?)?\s*([\d,]+)/i;
const PRICE_MIN_RE = /(?:above|over|more\s*than|starting\s*(?:from|at))\s*(?:lkr|rs\.?)?\s*([\d,]+)/i;
const PRICE_RANGE_RE = /(?:lkr|rs\.?)?\s*([\d,]+)\s*(?:-|to)\s*(?:lkr|rs\.?)?\s*([\d,]+)/i;

const STOPWORDS = new Set([
  'show', 'me', 'please', 'find', 'search', 'looking', 'for', 'the', 'a', 'an',
  'of', 'with', 'and', 'in', 'at', 'is', 'are', 'products', 'product', 'that',
  'below', 'under', 'above', 'over', 'less', 'than', 'more', 'lkr', 'rs',
  'active', 'inactive',
]);

function parseNumber(token: string): number {
  return Number(token.replace(/,/g, ''));
}

/**
 * Pure function: (query, known categories, known destinations) -> a
 * SearchFilter. No network, no database, no OpenAI — this is what runs
 * when the AI call times out, errors, gets refused, or returns something
 * that fails schema validation. "Never 500 on an AI outage; search
 * degrades, it does not fail" (Phase 3 plan) is only true because this
 * function exists and is always the fallback path, not an afterthought.
 *
 * Deliberately simple regex/keyword matching, not a second AI call — the
 * whole point is that this path has no external dependency to fail.
 */
export function heuristicParse(
  query: string,
  categories: CategoryLookup[],
  knownDestinations: string[],
): SearchFilter {
  const lower = query.toLowerCase();
  const consumed = new Set<string>();

  const matchedCategories: CategorySlug[] = [];
  for (const cat of categories) {
    const terms = [cat.slug, cat.name.toLowerCase(), ...cat.synonyms.map((s) => s.toLowerCase())];
    for (const term of terms) {
      if (term.length >= 2 && new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(lower)) {
        matchedCategories.push(cat.slug);
        consumed.add(term);
        break;
      }
    }
  }

  const matchedDestinations: string[] = [];
  for (const dest of knownDestinations) {
    if (dest.length >= 2 && new RegExp(`\\b${escapeRegExp(dest)}\\b`, 'i').test(lower)) {
      matchedDestinations.push(dest);
      consumed.add(dest.toLowerCase());
    }
  }

  let status: SearchFilter['status'] = 'any';
  if (STATUS_ACTIVE_RE.test(lower)) status = 'active';
  else if (STATUS_INACTIVE_RE.test(lower)) status = 'inactive';

  let priceMin: number | null = null;
  let priceMax: number | null = null;
  const rangeMatch = lower.match(PRICE_RANGE_RE);
  const maxMatch = lower.match(PRICE_MAX_RE);
  const minMatch = lower.match(PRICE_MIN_RE);
  if (maxMatch) {
    priceMax = parseNumber(maxMatch[1]);
  } else if (minMatch) {
    priceMin = parseNumber(minMatch[1]);
  } else if (rangeMatch) {
    const a = parseNumber(rangeMatch[1]);
    const b = parseNumber(rangeMatch[2]);
    priceMin = Math.min(a, b);
    priceMax = Math.max(a, b);
  }

  // Leftover tokens: whatever wasn't consumed as a category/destination
  // match and isn't a stopword or bare number becomes a full-text keyword.
  const tokens = lower.split(/[^a-z0-9]+/i).filter(Boolean);
  const keywords: string[] = [];
  for (const token of tokens) {
    if (STOPWORDS.has(token)) continue;
    if (/^\d+$/.test(token)) continue;
    if (consumed.has(token)) continue;
    if (token.length < 2) continue;
    if (!keywords.includes(token)) keywords.push(token);
    if (keywords.length >= 6) break;
  }

  return searchFilterSchema.parse({
    destinations: matchedDestinations.slice(0, 5),
    categories: [...new Set(matchedCategories)].slice(0, 5),
    status,
    price: priceMin != null || priceMax != null ? { min: priceMin, max: priceMax, currency: 'LKR' } : null,
    keywords,
    sort: 'relevance',
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
