import { Global, Module } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { AppConfigService } from '../../config/app-config.service.js';
import { SUPABASE_CLIENT } from './supabase.constants.js';

/**
 * The ONE Supabase client in the whole API, built with the service_role
 * key. This client bypasses RLS entirely — see supabase/migrations/
 * 20260908000002_rls.sql for why RLS still matters (it protects the
 * publishable key's direct-to-PostgREST path, which this client doesn't
 * use). Authorization for everything this client touches lives in the
 * guard (who) + the service layer (what — ownership filters on
 * update/delete). Never construct a second Supabase client anywhere else
 * in the codebase, and never accept a client-supplied key.
 */
@Global()
@Module({
  providers: [
    {
      provide: SUPABASE_CLIENT,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }),
    },
  ],
  exports: [SUPABASE_CLIENT],
})
export class SupabaseModule {}
