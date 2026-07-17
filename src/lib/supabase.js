import { createClient } from '@supabase/supabase-js'
import { IS_E2E } from './e2e/flag.js'
import { createMockSupabaseClient } from './e2e/mockSupabase.js'

// VITE_E2E is orthogonal to VITE_DEMO_MODE: demo mode only gates AI draft
// generation, whereas E2E mode swaps auth + data for a backend-free mock so CI
// runs with no secrets. IS_E2E is statically false in production builds, so
// Rollup drops the mock arm below.
export const supabase = IS_E2E
  ? createMockSupabaseClient()
  : createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    )
