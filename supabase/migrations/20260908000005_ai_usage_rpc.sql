-- ============================================================================
-- 0005: Atomic AI usage counter increment.
--
-- AiUsageService (apps/api/src/ai/ai-usage.service.ts) needs to increment
-- today's call count for a user without a read-then-write race between two
-- concurrent requests from the same user (both could read `calls = 9`,
-- both write `calls = 10`, and the quota check would then admit an 11th
-- call that should have been rejected). `insert ... on conflict ... do
-- update set calls = calls + 1` is a single atomic statement — Postgres
-- serializes it per row, so concurrent callers correctly see 10 and 11.
-- ============================================================================

create or replace function public.increment_ai_usage(p_user_id uuid, p_day date, p_tokens bigint)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.ai_usage (user_id, day, calls, estimated_tokens)
  values (p_user_id, p_day, 1, greatest(p_tokens, 0))
  on conflict (user_id, day)
  do update set
    calls = public.ai_usage.calls + 1,
    estimated_tokens = public.ai_usage.estimated_tokens + greatest(excluded.estimated_tokens, 0);
$$;

comment on function public.increment_ai_usage(uuid, date, bigint) is
  'Atomic upsert-increment for the daily AI usage counter. Called only by '
  'the API''s service_role client — ai_usage has no Data API policies for '
  'any other role (see 0002_rls.sql), and this function is not granted to '
  'anon/authenticated regardless.';

revoke all on function public.increment_ai_usage(uuid, date, bigint) from public;
grant execute on function public.increment_ai_usage(uuid, date, bigint) to service_role;
