import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType, ZodError } from 'zod';

/**
 * Applied per-route with the exact schema that route expects — e.g.
 * `@Body(new ZodValidationPipe(createProductSchema))`. A global pipe can't
 * know which schema applies to which route without another layer of
 * decorators/metadata; per-route instantiation is simpler and just as safe
 * for a codebase this size.
 *
 * Every schema passed here should be a `z.strictObject` — unknown fields
 * are REJECTED, not silently stripped, so a client attempting mass
 * assignment (e.g. `{ createdBy: '<someone-else>' }`) gets a 400 that
 * surfaces the attempt, rather than a silent no-op that hides it.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Request failed validation',
        fieldErrors: flattenIssues(result.error),
      });
    }
    return result.data;
  }
}

function flattenIssues(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_root';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
