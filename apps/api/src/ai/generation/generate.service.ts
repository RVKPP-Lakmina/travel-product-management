import { Inject, Injectable, Logger } from '@nestjs/common';
import type OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import {
  aiGeneratedProductWire,
  type AiGeneratedProductWire,
  type AiGenerateProductResponse,
  type DateAnchor,
} from '@travel/validation';
import { OPENAI_CLIENT } from '../openai.client.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { AiUsageService } from '../ai-usage.service.js';
import { sanitize, wrapUntrusted } from '../sanitize.js';
import { toStrictOpenAiSchema } from '../json-schema.util.js';
import { GENERATION_SYSTEM_PROMPT } from './prompt.js';
import { buildDateAnchors, formatAnchorsBlock, parseYmd, formatYmd, addYears } from './date-anchors.js';
import { colomboToday } from '../../common/date/colombo-date.js';

const PROMPT_MAX_CHARS = 1000;
const GENERATION_TIMEOUT_MS = 15_000;

// Derived once at module load, not per-request — schema derivation is pure
// and OpenAI's strict-mode JSON Schema doesn't change between calls.
const RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: toStrictOpenAiSchema(aiGeneratedProductWire, 'travel_product_draft'),
};

export class AiGenerationFailedError extends Error {
  constructor(reason: string) {
    super(`AI product generation failed: ${reason}`);
    this.name = 'AiGenerationFailedError';
  }
}

interface ResolvedDate {
  value: string | null;
  warning: string | null;
  resolvedAnchor: string | null;
}

@Injectable()
export class GenerateService {
  private readonly logger = new Logger(GenerateService.name);

  constructor(
    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI,
    private readonly config: AppConfigService,
    private readonly aiUsage: AiUsageService,
  ) {}

  async generate(userId: string, rawPrompt: string): Promise<AiGenerateProductResponse> {
    const requestId = randomUUID();
    const start = Date.now();

    const prompt = sanitize(rawPrompt, PROMPT_MAX_CHARS);
    const anchors = buildDateAnchors();
    const anchorsBlock = `DATE ANCHORS (Asia/Colombo, resolved server-side — pick a NAME from this list, never compute a date yourself):\n${formatAnchorsBlock(anchors)}`;

    let completion;
    try {
      completion = await this.openai.chat.completions.create(
        {
          model: this.config.openaiModelGeneration,
          messages: [
            { role: 'system', content: GENERATION_SYSTEM_PROMPT },
            { role: 'system', content: anchorsBlock },
            { role: 'user', content: wrapUntrusted(prompt) },
          ],
          response_format: RESPONSE_FORMAT,
          max_completion_tokens: 700,
        },
        { timeout: GENERATION_TIMEOUT_MS },
      );
    } catch (err) {
      this.logger.warn(
        `[${requestId}] generation call failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
      throw new AiGenerationFailedError('the model call failed or timed out');
    }

    const choice = completion.choices[0];
    if (choice?.finish_reason === 'content_filter' || choice?.message?.refusal) {
      // Never echo the model's own refusal text back to the caller — if the
      // refusal was triggered by injected content in the prompt, echoing it
      // could reflect that content back into the response.
      this.logger.warn(`[${requestId}] generation refused by the model`);
      throw new AiGenerationFailedError('the request could not be completed');
    }

    const rawContent = choice?.message?.content;
    if (!rawContent) {
      throw new AiGenerationFailedError('empty model response');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch {
      throw new AiGenerationFailedError('model response was not valid JSON');
    }

    // Never trust the model's own claim that its output matches the
    // schema, even under "strict" mode — re-validate exactly as if this
    // were a hostile HTTP body.
    const wireResult = aiGeneratedProductWire.safeParse(parsedJson);
    if (!wireResult.success) {
      const digest = createHash('sha256').update(rawContent).digest('hex').slice(0, 16);
      this.logger.warn(`[${requestId}] AI_SCHEMA_REJECT sha256=${digest}`);
      throw new AiGenerationFailedError('model response did not match the expected shape');
    }

    const wire = wireResult.data;
    const latencyMs = Date.now() - start;
    const tokensIn = completion.usage?.prompt_tokens ?? 0;
    const tokensOut = completion.usage?.completion_tokens ?? 0;

    // Recorded here, where the real token counts are known, rather than
    // pushed back up to the controller — bookkeeping failing must never
    // fail an otherwise-successful generation response.
    try {
      await this.aiUsage.recordUsage(userId, tokensIn + tokensOut);
    } catch (err) {
      this.logger.warn(
        `[${requestId}] failed to record AI usage: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }

    return this.buildResponse(requestId, wire, anchors, {
      model: this.config.openaiModelGeneration,
      latencyMs,
      tokensIn,
      tokensOut,
    });
  }

  private buildResponse(
    requestId: string,
    wire: AiGeneratedProductWire,
    anchors: Record<DateAnchor, string>,
    meta: { model: string; latencyMs: number; tokensIn: number; tokensOut: number },
  ): AiGenerateProductResponse {
    const warnings: string[] = [];
    const resolvedAnchors: Record<string, string> = {};

    // Only validUntil is rejected for being in the past — that's the
    // specific failure mode that matters (a past validUntil makes the
    // product immediately expired). A past validFrom is harmless: it just
    // means the product has already been available since that date.
    const from = this.resolveAndValidate(wire.validity.from, anchors, 'validFrom', warnings, resolvedAnchors, {
      rejectPast: false,
    });
    const until = this.resolveAndValidate(wire.validity.until, anchors, 'validUntil', warnings, resolvedAnchors, {
      rejectPast: true,
    });

    // Cross-field: until must be on/after from. If both resolved but
    // violate that, the whole validity window is unreliable — clear both
    // rather than silently keeping a nonsensical pair (this is exactly the
    // load-bearing field the spec's expiry rule depends on; never guess).
    let validFrom = from.value;
    let validUntil = until.value;
    if (validFrom && validUntil && validUntil < validFrom) {
      warnings.push('Model proposed validUntil before validFrom; cleared both — please set manually.');
      validFrom = null;
      validUntil = null;
    }

    const unresolvedFields: string[] = [];
    if (!validFrom) unresolvedFields.push('validFrom');
    if (!validUntil) unresolvedFields.push('validUntil');
    if (wire.price.amount == null) unresolvedFields.push('price');

    return {
      requestId,
      source: 'ai',
      draft: {
        name: wire.name || null,
        description: wire.description || null,
        destination: wire.destination,
        category: wire.suggestedCategory,
        price: wire.price.amount,
        inventoryCount: null, // never something the model has grounds to guess
        validFrom,
        validUntil,
        status: 'active',
        highlights: wire.highlights,
        inclusions: wire.inclusions,
        tags: wire.tags,
      },
      meta: {
        assumptions: wire.assumptions,
        warnings,
        unresolvedFields,
        resolvedAnchors,
        model: meta.model,
        latencyMs: meta.latencyMs,
        tokens: { in: meta.tokensIn, out: meta.tokensOut },
      },
    };
  }

  /**
   * Resolves one anchored-date field to a literal date, THEN re-validates
   * it against the real constraints regardless of how it was resolved
   * (anchor lookups are server-computed and trustworthy, but an "explicit"
   * date came from the model parroting back user text, which still gets
   * treated as untrusted input). Downgrades to null + a warning on any
   * violation — never silently keeps an invalid or implausible date.
   */
  private resolveAndValidate(
    anchored: AiGeneratedProductWire['validity']['from'],
    anchors: Record<DateAnchor, string>,
    fieldLabel: string,
    warnings: string[],
    resolvedAnchors: Record<string, string>,
    options: { rejectPast: boolean },
  ): ResolvedDate {
    let value: string | null = null;
    let resolvedAnchor: string | null = null;

    if (anchored.kind === 'anchor') {
      if (anchored.anchor && anchored.anchor in anchors) {
        value = anchors[anchored.anchor];
        resolvedAnchor = anchored.anchor;
        resolvedAnchors[fieldLabel] = anchored.anchor;
      } else {
        warnings.push(`Model referenced an unresolvable date anchor for ${fieldLabel}; left blank.`);
      }
    } else if (anchored.kind === 'explicit') {
      if (anchored.date) {
        value = anchored.date;
      } else {
        warnings.push(`Model claimed an explicit ${fieldLabel} date but provided none; left blank.`);
      }
    }
    // kind === 'unknown': value stays null, no warning — this is the honest, expected case.

    if (value) {
      const today = colomboToday();
      const maxAllowed = formatYmd(addYears(parseYmd(today), 2));
      if (options.rejectPast && value < today) {
        warnings.push(`Model proposed a ${fieldLabel} date in the past; cleared it.`);
        value = null;
        resolvedAnchor = null;
      } else if (value > maxAllowed) {
        warnings.push(`Model proposed a ${fieldLabel} date more than 2 years out; cleared it.`);
        value = null;
        resolvedAnchor = null;
      }
    }

    return { value, warning: null, resolvedAnchor };
  }
}
