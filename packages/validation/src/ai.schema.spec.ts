import { describe, expect, it } from 'vitest';
import {
  aiGeneratedProductWire,
  searchFilterSchema,
  aiSearchRequestSchema,
  aiGenerateProductRequestSchema,
} from './ai.schema.js';

describe('aiGeneratedProductWire — the OpenAI structured-output contract', () => {
  const validWire = {
    name: 'Dinner Buffet at Cinnamon Grand Colombo',
    description: 'An evening seafood buffet.',
    highlights: ['Live grill station'],
    inclusions: ['Buffet dinner'],
    suggestedCategory: 'dining',
    destination: 'Colombo',
    tags: ['buffet', 'dinner'],
    price: { amount: 9450, currency: 'LKR', confidence: 'inferred' },
    validity: {
      from: { kind: 'anchor', anchor: 'today', date: null },
      until: { kind: 'anchor', anchor: 'endOfThisMonth', date: null },
    },
    assumptions: ['Assumed 5-star Colombo hotel pricing'],
  };

  it('accepts a well-formed model response', () => {
    expect(aiGeneratedProductWire.safeParse(validWire).success).toBe(true);
  });

  it('rejects a category outside the closed enum — the model cannot invent one', () => {
    const result = aiGeneratedProductWire.safeParse({
      ...validWire,
      suggestedCategory: 'made-up-category',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown date anchor', () => {
    const result = aiGeneratedProductWire.safeParse({
      ...validWire,
      validity: {
        from: { kind: 'anchor', anchor: 'today', date: null },
        until: { kind: 'anchor', anchor: 'nextCentury', date: null },
      },
    });
    expect(result.success).toBe(false);
  });

  it('allows nulls where the model is unsure (nullable, not optional)', () => {
    const result = aiGeneratedProductWire.safeParse({
      ...validWire,
      destination: null,
      price: { amount: null, currency: 'LKR', confidence: 'unknown' },
    });
    expect(result.success).toBe(true);
  });
});

describe('searchFilterSchema — the AI-search DSL, never SQL', () => {
  it('applies safe defaults for an empty filter', () => {
    const result = searchFilterSchema.parse({});
    expect(result.status).toBe('any');
    expect(result.sort).toBe('relevance');
    expect(result.limit).toBe(20);
    expect(result.destinations).toEqual([]);
  });

  it('rejects an unknown top-level field — the model cannot smuggle new keys', () => {
    const result = searchFilterSchema.safeParse({ sqlInjection: "'; drop table products; --" });
    expect(result.success).toBe(false);
  });

  it('rejects a category outside the closed enum', () => {
    const result = searchFilterSchema.safeParse({ categories: ['made-up'] });
    expect(result.success).toBe(false);
  });

  it('rejects a sort value outside the fixed enum — no arbitrary sort-column injection', () => {
    const result = searchFilterSchema.safeParse({ sort: 'price; drop table products' });
    expect(result.success).toBe(false);
  });

  it('rejects price.min > price.max', () => {
    const result = searchFilterSchema.safeParse({
      price: { min: 10000, max: 5000, currency: 'LKR' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts the spec example: "dinner buffets in Colombo"', () => {
    const result = searchFilterSchema.parse({
      destinations: ['Colombo'],
      categories: ['dining'],
      keywords: ['buffet'],
    });
    expect(result.destinations).toEqual(['Colombo']);
    expect(result.categories).toEqual(['dining']);
  });

  it('accepts the spec example: "show products below LKR 10,000"', () => {
    const result = searchFilterSchema.parse({
      price: { min: null, max: 10000, currency: 'LKR' },
    });
    expect(result.price?.max).toBe(10000);
  });

  it('clamps limit at the schema boundary regardless of what the caller asks for', () => {
    const result = searchFilterSchema.safeParse({ limit: 500 });
    expect(result.success).toBe(false);
  });

  it('caps destinations/keywords array length', () => {
    const result = searchFilterSchema.safeParse({
      destinations: Array.from({ length: 10 }, (_, i) => `Place${i}`),
    });
    expect(result.success).toBe(false);
  });
});

describe('aiSearchRequestSchema / aiGenerateProductRequestSchema — input caps', () => {
  it('rejects an oversized search query before it would reach OpenAI', () => {
    const result = aiSearchRequestSchema.safeParse({ query: 'a'.repeat(500) });
    expect(result.success).toBe(false);
  });

  it('rejects an oversized generation prompt', () => {
    const result = aiGenerateProductRequestSchema.safeParse({ prompt: 'a'.repeat(2000) });
    expect(result.success).toBe(false);
  });

  it('rejects an empty/too-short prompt', () => {
    expect(aiGenerateProductRequestSchema.safeParse({ prompt: 'hi' }).success).toBe(false);
  });
});
