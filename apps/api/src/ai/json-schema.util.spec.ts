import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toStrictOpenAiSchema } from './json-schema.util.js';

describe('toStrictOpenAiSchema', () => {
  it('sets additionalProperties: false and lists every key in required, at every nesting level', () => {
    const schema = z.object({
      a: z.string(),
      nested: z.object({
        b: z.number().nullable(),
        deeper: z.object({ c: z.boolean() }),
      }),
    });

    const result = toStrictOpenAiSchema(schema, 'test_schema');

    expect(result.name).toBe('test_schema');
    expect(result.strict).toBe(true);
    expect(result.schema.additionalProperties).toBe(false);
    expect(result.schema.required).toEqual(['a', 'nested']);

    const props = result.schema.properties as Record<string, any>;
    expect(props.nested.additionalProperties).toBe(false);
    expect(props.nested.required).toEqual(['b', 'deeper']);
    expect(props.nested.properties.deeper.additionalProperties).toBe(false);
    expect(props.nested.properties.deeper.required).toEqual(['c']);
  });

  it('strictens objects nested inside array items', () => {
    const schema = z.object({
      items: z.array(z.object({ x: z.string(), y: z.number() })),
    });
    const result = toStrictOpenAiSchema(schema, 'test');
    const itemSchema = (result.schema.properties as any).items.items;
    expect(itemSchema.additionalProperties).toBe(false);
    expect(itemSchema.required).toEqual(['x', 'y']);
  });

  it('strictens objects nested inside a nullable union (anyOf)', () => {
    const schema = z.object({
      maybe: z.object({ x: z.string() }).nullable(),
    });
    const result = toStrictOpenAiSchema(schema, 'test');
    const anyOf = (result.schema.properties as any).maybe.anyOf;
    const objectBranch = anyOf.find((b: any) => b.type === 'object');
    expect(objectBranch.additionalProperties).toBe(false);
    expect(objectBranch.required).toEqual(['x']);
  });

  it('strips `default` annotations — not part of the strict-mode keyword set and unnecessary since every field is required regardless', () => {
    const schema = z.object({ a: z.array(z.string()).default([]) });
    const result = toStrictOpenAiSchema(schema, 'test');
    expect((result.schema.properties as any).a.default).toBeUndefined();
  });

  it('is called once and produces a stable, reusable schema (no per-call randomness)', () => {
    const schema = z.object({ a: z.string() });
    const first = toStrictOpenAiSchema(schema, 'test');
    const second = toStrictOpenAiSchema(schema, 'test');
    expect(first.schema).toEqual(second.schema);
  });
});
