// supabase.functions.invoke() throws a FunctionsHttpError on any non-2xx response
// BEFORE parsing the body, so `data` is always null and `error.message` is always
// the generic "Edge Function returned a non-2xx status code" — the real message
// from manage-staff's `{ error: '...' }` JSON body lives in error.context (a
// Response object) and must be read via .json(). Falls back to error.message if
// the body can't be parsed as JSON for some other reason.
export async function extractFunctionError(error, fallback) {
  if (!error) return fallback;
  if (error.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.json();
      if (body?.error) return body.error;
    } catch {
      // body wasn't JSON — fall through to error.message
    }
  }
  return error.message || fallback;
}

// Shared by both translators below — Supabase Auth's rate limit can surface
// from inviteUserByEmail() (handleInvite) or, in principle, from
// auth.admin.deleteUser() (handleRevoke), so both need the same check.
function rateLimitMessage(msg) {
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Email rate limit reached — try again later';
  }
  return null;
}

// Translates raw manage-staff / Supabase Auth error text into something a
// clinic admin can read without knowing what "auth.users" or GoTrue is.
export function friendlyInviteError(raw) {
  const msg = (raw || '').toLowerCase();
  if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('already exists')) {
    return 'User already exists';
  }
  if (msg.includes('role must be one of')) return 'Invalid role';
  if (msg.includes('name and email are required')) return 'Missing name or email';
  if (msg.includes('staff row creation failed')) return 'Account created, but details failed to save — edit manually';
  if (msg.includes('profile role update failed')) return 'Account created, but role failed to save — edit manually';
  const rateLimit = rateLimitMessage(msg);
  if (rateLimit) return rateLimit;
  return raw || 'Invite failed';
}

// Translates raw manage-staff error text from the revoke action (see
// handleRevoke in supabase/functions/manage-staff/index.ts) into something a
// clinic admin can read. Mirrors friendlyInviteError's pattern.
export function friendlyRevokeError(raw) {
  const msg = (raw || '').toLowerCase();
  if (msg.includes('staffid is required')) return 'Revoke failed — no staff record selected';
  if (msg.includes('staff record not found')) return 'This invite was already removed';
  if (msg.includes('staff record removed but account deletion failed')) {
    return 'Invite removed, but the account itself could not be deleted — contact support';
  }
  if (msg.includes('revoke failed')) return 'Revoke failed — please try again';
  const rateLimit = rateLimitMessage(msg);
  if (rateLimit) return rateLimit;
  return raw || 'Revoke failed';
}
