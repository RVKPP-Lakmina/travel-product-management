import { z, type ZodType } from 'zod';

/**
 * Derives an OpenAI-strict-mode-compatible JSON Schema from a zod schema.
 *
 * OpenAI's Structured Outputs "strict" mode accepts only a subset of JSON
 * Schema: every object needs `additionalProperties: false` and EVERY
 * property listed in `required` (no true optionals — that's why every wire
 * schema in packages/validation/src/ai.schema.ts uses `.nullable()` instead
 * of `.optional()`, so "the model has no opinion" is representable as
 * `null` rather than an absent key). zod v4's `z.toJSONSchema` produces a
 * generic draft-2020-12 schema; this function then walks the result and
 * forces the strict-mode shape onto every nested object.
 *
 * Intentionally NOT using the SDK's `zodResponseFormat`/`zodTextFormat`
 * helpers (`openai/helpers/zod`) — those were built around zod v3's
 * internals, and this repo pins zod v4. Deriving the schema explicitly here
 * is a few extra lines but is not tied to a helper that may not track zod
 * v4's `_zod.def` shape correctly across SDK versions.
 *
 * Called once per process (at module init, not per-request) and the result
 * cached by the caller — schema derivation is pure and has no reason to
 * repeat on every API call.
 */
export function toStrictOpenAiSchema(
  schema: ZodType,
  name: string,
): { name: string; schema: Record<string, unknown>; strict: true } {
  const jsonSchema = z.toJSONSchema(schema, {
    target: 'draft-2020-12',
    io: 'output',
    unrepresentable: 'any',
  }) as Record<string, unknown>;
  strictenInPlace(jsonSchema);
  return { name, schema: jsonSchema, strict: true };
}

function strictenInPlace(node: unknown): void {
  if (node === null || typeof node !== 'object') return;

  const obj = node as Record<string, unknown>;

  // `default` is a pure annotation zod's default()/optional-with-default
  // fields emit; it isn't part of OpenAI's strict-mode keyword allowlist
  // and serves no purpose there (the model must supply every field
  // regardless — that's the whole point of `required` listing everything).
  // Stripped defensively rather than risking an unsupported-keyword
  // rejection at call time.
  delete obj.default;

  if (obj.type === 'object' && obj.properties && typeof obj.properties === 'object') {
    const properties = obj.properties as Record<string, unknown>;
    obj.additionalProperties = false;
    obj.required = Object.keys(properties);
    for (const value of Object.values(properties)) {
      strictenInPlace(value);
    }
  }

  if (obj.type === 'array' && obj.items) {
    strictenInPlace(obj.items);
  }

  for (const key of ['$defs', 'definitions'] as const) {
    const defs = obj[key];
    if (defs && typeof defs === 'object') {
      for (const value of Object.values(defs as Record<string, unknown>)) {
        strictenInPlace(value);
      }
    }
  }

  for (const key of ['anyOf', 'oneOf', 'allOf'] as const) {
    const list = obj[key];
    if (Array.isArray(list)) {
      list.forEach(strictenInPlace);
    }
  }
}
