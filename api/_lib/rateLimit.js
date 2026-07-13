/**
 * Per-user, per-endpoint rate limiting for the AI API functions.
 *
 * Wraps the ACD-35 `check_rate_limit` Postgres function (SECURITY DEFINER,
 * granted to the `authenticated` role) which atomically increments the caller's
 * hourly window and reports whether they are still under the cap.
 *
 * FAIL-OPEN by design: if the RPC errors (outage, migration drift, transient
 * network fault) we log server-side and return `true` (allow). A limiter outage
 * must never block clinical work — JWT auth + the Anthropic spend cap still
 * bound the downside.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 *        A client authenticated as the user (carries their Bearer token), so the
 *        RPC runs as `authenticated` and matches the function's grant.
 * @param {string} userId    The authenticated user's id (auth.users.id).
 * @param {string} endpoint  Logical endpoint key, e.g. 'generate'.
 * @param {number} maxCalls  Allowed calls per hourly window.
 * @returns {Promise<boolean>} true = allowed, false = over the limit.
 */
export async function checkRateLimit(supabaseClient, userId, endpoint, maxCalls) {
  try {
    const { data, error } = await supabaseClient.rpc('check_rate_limit', {
      p_user_id: userId,
      p_endpoint: endpoint,
      p_max_calls: maxCalls,
    });

    if (error) {
      console.error(`[rateLimit] ${endpoint} — RPC error, failing open:`, error.message);
      return true;
    }

    return data === true;
  } catch (err) {
    console.error(`[rateLimit] ${endpoint} — unexpected error, failing open:`, err);
    return true;
  }
}
