import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Public } from '../common/decorators/public.decorator.js';
import { SUPABASE_CLIENT } from '../common/supabase/supabase.constants.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient) {}

  @Public()
  @Get()
  liveness() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  async readiness() {
    // A trivial, cheap query against a reference table — proves the
    // service-role client can actually reach Postgres, not just that the
    // process is running.
    const { error } = await this.supabase.from('categories').select('slug').limit(1);
    if (error) {
      throw new ServiceUnavailableException('Database unreachable');
    }
    return { status: 'ok' };
  }
}
