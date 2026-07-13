import { createClient } from '@supabase/supabase-js';

/**
 * Verify the Supabase session token on an incoming API request.
 *
 * Reads the `Authorization: Bearer <token>` header and validates it against
 * Supabase. Both endpoints (/api/generate, /api/generate-definition) call this
 * before any Anthropic request so unauthenticated POSTs cannot burn tokens.
 *
 * On success also returns a Supabase client that carries the user's Bearer
 * token, so downstream RPCs (e.g. check_rate_limit, granted to `authenticated`)
 * execute under the user's role rather than anon.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<{ user: object|null, supabase?: object, error?: string }>}
 */
export async function verifyAuth(req) {
  const authHeader = req.headers?.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return { user: null, error: 'missing token' };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return { user: null, error: error?.message ?? 'invalid token' };
  }

  return { user: data.user, supabase };
}
