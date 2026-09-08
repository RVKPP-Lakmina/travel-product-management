import { describe, expect, it, vi } from 'vitest';
import { AiUsageService, AiQuotaExceededError } from './ai-usage.service.js';
import type { AppConfigService } from '../config/app-config.service.js';

function makeConfig(dailyQuota = 200): AppConfigService {
  return { aiDailyQuota: dailyQuota } as unknown as AppConfigService;
}

describe('AiUsageService', () => {
  it('allows a user under quota', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { calls: 5 }, error: null }),
            }),
          }),
        }),
      }),
    } as any;
    const service = new AiUsageService(supabase, makeConfig(200));
    await expect(service.assertWithinQuota('user-1')).resolves.toBeUndefined();
  });

  it('allows a user with no usage row yet', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    } as any;
    const service = new AiUsageService(supabase, makeConfig(200));
    await expect(service.assertWithinQuota('user-1')).resolves.toBeUndefined();
  });

  it('rejects a user at or above the daily quota', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { calls: 200 }, error: null }),
            }),
          }),
        }),
      }),
    } as any;
    const service = new AiUsageService(supabase, makeConfig(200));
    await expect(service.assertWithinQuota('user-1')).rejects.toBeInstanceOf(AiQuotaExceededError);
  });

  it('calls the atomic increment RPC to record usage, never a read-then-write', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const supabase = { rpc } as any;
    const service = new AiUsageService(supabase, makeConfig());

    await service.recordUsage('user-1', 200);
    expect(rpc).toHaveBeenCalledWith(
      'increment_ai_usage',
      expect.objectContaining({ p_user_id: 'user-1', p_tokens: 200 }),
    );
  });
});
