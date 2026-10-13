// Per-user, per-endpoint rate limiting for Supabase Edge Functions (ACD-95).
//
// Deno equivalent of api/_lib/rateLimit.js -- wraps the same ACD-35
// check_rate_limit Postgres RPC (SECURITY DEFINER), but Edge Functions run
// on Deno and can't import that Node-targeted helper directly, so this is a
// parallel implementation of the identical call pattern.
//
// FAIL-OPEN by design: if the RPC errors (outage, migration drift, transient
// network fault) we log server-side and return true (allow) -- see
// api/_lib/rateLimit.js for the full rationale.
//
// `service_role` already carries EXECUTE on check_rate_limit via Supabase's
// default privilege grants (confirmed in Postgres: the ACD-35 migration only
// explicitly revoked anon/public), so each caller's existing service-role
// admin client can be passed straight through -- no separate user-context
// client is needed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function checkRateLimit(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string,
  endpoint: string,
  maxCalls: number
): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient.rpc('check_rate_limit', {
      p_user_id: userId,
      p_endpoint: endpoint,
      p_max_calls: maxCalls,
    })

    if (error) {
      console.error(`[rateLimit] ${endpoint} — RPC error, failing open:`, error.message)
      return true
    }

    return data === true
  } catch (err) {
    console.error(`[rateLimit] ${endpoint} — unexpected error, failing open:`, err)
    return true
  }
}
