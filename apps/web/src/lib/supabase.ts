import { createClient } from '@supabase/supabase-js'

// These two values are PUBLIC BY DESIGN — Row Level Security (see
// supabase/migrations/0002_rls.sql) is what protects the publishable key,
// not secrecy of the key itself. Never add SUPABASE_SERVICE_ROLE_KEY,
// SUPABASE_SECRET_KEY, or OPENAI_API_KEY anywhere under apps/web — any
// VITE_-prefixed variable is statically inlined into the built JS bundle.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY')
}

// Auth only — the app never reads/writes product data directly through
// this client. All product data goes through the Nest API, which enforces
// its own guards, validation, throttling, and the validity filter.
export const supabase = createClient(supabaseUrl, supabaseKey)
