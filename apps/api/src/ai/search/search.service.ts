import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type OpenAI from 'openai';
import { randomUUID, createHash } from 'node:crypto';
import { searchFilterSchema, searchFilterWireSchema, type SearchFilter, type AiSearchResponse } from '@travel/validation';
import { OPENAI_CLIENT } from '../openai.client.js';
import { SUPABASE_CLIENT } from '../../common/supabase/supabase.constants.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { sanitize, wrapUntrusted } from '../sanitize.js';
import { toStrictOpenAiSchema } from '../json-schema.util.js';
import { SEARCH_SYSTEM_PROMPT } from './prompt.js';
import { heuristicParse, type CategoryLookup } from './heuristic-fallback.js';
import { LruTtlCache } from './lru-ttl-cache.js';
import { ProductsService } from '../../products/products.service.js';
import { AiUsageService } from '../ai-usage.service.js';

const QUERY_MAX_CHARS = 400;
const SEARCH_TIMEOUT_MS = 8_000;
const EXPLANATION_MAX_CHARS = 200;
const LOOKUP_CACHE_TTL_MS = 5 * 60_000;

// Derived from searchFilterWireSchema, NOT searchFilterSchema — the model
// is asked to also produce `explanation`, which plain searchFilterSchema
// has no room for (see ai.schema.ts's comment on searchFilterWireSchema).
const RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: toStrictOpenAiSchema(searchFilterWireSchema, 'travel_search_filter'),
};

interface LookupCacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  // Filter-translation cache: query text -> resolved SearchFilter. Global
  // (not per-user) because the translation of "dinner buffets in colombo"
  // doesn't depend on who's asking — this maximizes the hit rate, which
  // matters most for the handful of example queries the spec itself lists.
  private readonly filterCache = new LruTtlCache<{ filter: SearchFilter; explanation: string; source: 'ai' | 'heuristic' }>(
    500,
    10 * 60_000,
  );

  private categoriesCache: LookupCacheEntry<CategoryLookup[]> | null = null;
  private destinationsCache: LookupCacheEntry<string[]> | null = null;

  constructor(
    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly config: AppConfigService,
    private readonly products: ProductsService,
    private readonly aiUsage: AiUsageService,
  ) {}

  async search(userId: string, rawQuery: string): Promise<AiSearchResponse> {
    const requestId = randomUUID();
    const start = Date.now();

    const query = sanitize(rawQuery, QUERY_MAX_CHARS);
    const cacheKey = normalizeForCacheKey(query);

    let filter: SearchFilter;
    let explanation: string;
    let source: 'ai' | 'heuristic';
    let cached = false;
    let modelUsed: string | null = null;

    const cachedEntry = this.filterCache.get(cacheKey);
    if (cachedEntry) {
      ({ filter, explanation, source } = cachedEntry);
      cached = true;
    } else {
      const resolved = await this.resolveFilter(requestId, query);
      filter = resolved.filter;
      explanation = resolved.explanation;
      source = resolved.source;
      modelUsed = resolved.model;
      this.filterCache.set(cacheKey, { filter, explanation, source });

      // Only a genuine, uncached OpenAI call spends tokens — a cache hit
      // or a fallback to the heuristic parser costs nothing to record.
      if (source === 'ai' && resolved.tokens) {
        try {
          await this.aiUsage.recordUsage(userId, resolved.tokens.in + resolved.tokens.out);
        } catch (err) {
          this.logger.warn(
            `[${requestId}] failed to record AI usage: ${err instanceof Error ? err.message : 'unknown error'}`,
          );
        }
      }
    }

    // If neither path produced any actual constraint, don't hand back the
    // entire catalogue — fall back to a plain full-text search over the
    // raw query so the user still gets something relevant-ish.
    if (isEmptyFilter(filter)) {
      const words = query
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter((w) => w.length >= 2)
        .slice(0, 6);
      if (words.length > 0) {
        filter = { ...filter, keywords: words };
      }
    }

    const { items, total } = await this.products.findManyByFilter(filter);
    const latencyMs = Date.now() - start;

    return {
      requestId,
      source,
      filter,
      explanation,
      results: items,
      total,
      meta: { latencyMs, cached, model: modelUsed },
    };
  }

  private async resolveFilter(
    requestId: string,
    query: string,
  ): Promise<{
    filter: SearchFilter;
    explanation: string;
    source: 'ai' | 'heuristic';
    model: string | null;
    tokens: { in: number; out: number } | null;
  }> {
    try {
      const completion = await this.openai.chat.completions.create(
        {
          model: this.config.openaiModelSearch,
          messages: [
            { role: 'system', content: SEARCH_SYSTEM_PROMPT },
            { role: 'user', content: wrapUntrusted(query) },
          ],
          response_format: RESPONSE_FORMAT,
          max_completion_tokens: 250,
        },
        { timeout: SEARCH_TIMEOUT_MS },
      );

      const choice = completion.choices[0];
      if (choice?.finish_reason === 'content_filter' || choice?.message?.refusal) {
        throw new Error('model refused the request');
      }
      const rawContent = choice?.message?.content;
      if (!rawContent) {
        throw new Error('empty model response');
      }

      const parsedJson = JSON.parse(rawContent);

      // Never trust the model's own claim that its JSON matches the
      // schema, even under strict mode — re-validate exactly as if this
      // were a hostile HTTP body. Validated against the WIRE schema first
      // (which includes `explanation`), then the filter portion is
      // re-extracted through the plain `searchFilterSchema` below so the
      // compiled query never carries an `explanation` field alongside it.
      const wireResult = searchFilterWireSchema.safeParse(parsedJson);
      if (!wireResult.success) {
        const digest = createHash('sha256').update(rawContent).digest('hex').slice(0, 16);
        this.logger.warn(`[${requestId}] AI_SCHEMA_REJECT sha256=${digest}`);
        throw new Error('model response did not match the filter schema');
      }
      const { explanation: rawExplanation, ...filterFields } = wireResult.data;

      // Never trust the model's own limit/offset regardless of schema
      // validity — this tool never paginates via natural language, and
      // "always 20/0" is enforced here rather than merely requested in the
      // prompt. Re-parsed through searchFilterSchema (not just spread) so
      // any future divergence between the two shapes still gets caught.
      const filter: SearchFilter = searchFilterSchema.parse({ ...filterFields, limit: 20, offset: 0 });

      const explanation =
        sanitize(rawExplanation, EXPLANATION_MAX_CHARS) || 'Interpreted your search into the filters above.';

      return {
        filter,
        explanation,
        source: 'ai',
        model: this.config.openaiModelSearch,
        tokens: {
          in: completion.usage?.prompt_tokens ?? 0,
          out: completion.usage?.completion_tokens ?? 0,
        },
      };
    } catch (err) {
      this.logger.warn(
        `[${requestId}] AI search failed, using heuristic fallback: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      const categories = await this.getCategories();
      const destinations = await this.getKnownDestinations();
      const filter = heuristicParse(query, categories, destinations);
      return {
        filter,
        explanation: 'Interpreted using keyword matching (AI unavailable).',
        source: 'heuristic',
        model: null,
        tokens: null,
      };
    }
  }

  private async getCategories(): Promise<CategoryLookup[]> {
    if (this.categoriesCache && this.categoriesCache.expiresAt > Date.now()) {
      return this.categoriesCache.value;
    }
    const { data, error } = await this.supabase.from('categories').select('slug, name, synonyms');
    if (error) throw error;
    const value = (data ?? []) as CategoryLookup[];
    this.categoriesCache = { value, expiresAt: Date.now() + LOOKUP_CACHE_TTL_MS };
    return value;
  }

  private async getKnownDestinations(): Promise<string[]> {
    if (this.destinationsCache && this.destinationsCache.expiresAt > Date.now()) {
      return this.destinationsCache.value;
    }
    const { data, error } = await this.supabase.from('products_listable').select('destination');
    if (error) throw error;
    const value = [...new Set((data ?? []).map((r: { destination: string }) => r.destination))];
    this.destinationsCache = { value, expiresAt: Date.now() + LOOKUP_CACHE_TTL_MS };
    return value;
  }
}

function normalizeForCacheKey(query: string): string {
  return query.toLowerCase().replace(/\s+/g, ' ').replace(/[.!?]+$/g, '').trim();
}

function isEmptyFilter(filter: SearchFilter): boolean {
  return (
    filter.destinations.length === 0 &&
    filter.categories.length === 0 &&
    filter.status === 'any' &&
    filter.price === null &&
    filter.inventory === null &&
    filter.validOn === null &&
    filter.keywords.length === 0
  );
}
