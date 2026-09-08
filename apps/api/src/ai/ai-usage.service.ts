import { Inject, Injectable } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../common/supabase/supabase.constants.js';
import { AppConfigService } from '../config/app-config.service.js';
import { colomboToday } from '../common/date/colombo-date.js';

export class AiQuotaExceededError extends Error {
  constructor() {
    super('Daily AI usage quota exceeded');
    this.name = 'AiQuotaExceededError';
  }
}

/**
 * A daily-per-user call counter, independent of the per-minute throttler
 * buckets (`ai`/`image` in ThrottlerModule.forRoot). The throttler alone
 * does not stop a slow-drip cost attack — a caller who stays just under
 * 10 calls/minute for hours is invisible to it but still runs up a real
 * OpenAI bill. This closes that gap. Uses the `ai_usage` table added in
 * supabase/migrations/20260908000001_init.sql, which the Data API never
 * exposes to any client role (RLS + a blanket revoke in
 * 20260908000002_rls.sql) — only this service's service-role client can
 * read or write it.
 */
@Injectable()
export class AiUsageService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly config: AppConfigService,
  ) {}

  /** Throws AiQuotaExceededError if the user is already at today's cap. Call BEFORE the paid OpenAI request. */
  async assertWithinQuota(userId: string): Promise<void> {
    const today = colomboToday();
    const { data, error } = await this.supabase
      .from('ai_usage')
      .select('calls')
      .eq('user_id', userId)
      .eq('day', today)
      .maybeSingle();

    if (error) throw error;
    if (data && data.calls >= this.config.aiDailyQuota) {
      throw new AiQuotaExceededError();
    }
  }

  /** Call AFTER a completed OpenAI request (success or failure — a failed call still cost tokens/latency). */
  async recordUsage(userId: string, estimatedTokens: number): Promise<void> {
    const today = colomboToday();
    const { error } = await this.supabase.rpc('increment_ai_usage', {
      p_user_id: userId,
      p_day: today,
      p_tokens: estimatedTokens,
    });
    if (error) throw error;
  }
}
