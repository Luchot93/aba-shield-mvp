// ACD-71 (A5): Makes "Invite Staff" / "Revoke Staff" create and remove real
// accounts instead of the local-state-only mock in StaffPage.jsx. Requires
// the service role key (auth.admin.*), so this must run server-side --
// called by the frontend via supabase.functions.invoke, with the caller's
// session JWT forwarded so we can verify they're an admin before doing
// anything. Admin-only for both actions per the ticket's AC.
//
// Note on profiles: inviteUserByEmail() inserts into auth.users, which fires
// the existing on_auth_user_created -> handle_new_user() trigger (see
// supabase/migrations/20260714221150_profiles_table.sql). That trigger
// already creates the profiles row (defaulted to role='bcba') -- so invite
// below UPDATEs that row to the submitted role rather than inserting a
// second one, which would violate the profiles primary key.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PROFILE_ROLES = ['admin', 'bcba', 'bcaba', 'rbt']

// Basic plausibility checks, not full RFC/format validation -- ACD-92 (E3)
// asks for exactly that: reject obviously malformed input before it ever
// reaches the Admin API, not exhaustively validate every edge case.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CERT_NUMBER_RE = /^[A-Za-z0-9\- /]{1,50}$/
const NPI_RE = /^\d{10}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  return !Number.isNaN(new Date(value).getTime())
}

// Validates the full invite payload up front so the request is rejected
// with one 400 instead of partially applying (e.g. creating the auth user,
// then failing on a malformed npi while inserting the staff row).
function validateInvitePayload(payload: {
  name?: string
  email?: string
  role?: string
  cert_number?: string
  npi?: string
  hire_date?: string
}): string | null {
  const { name, email, role, cert_number, npi, hire_date } = payload

  if (!name || !email) return 'name and email are required'
  if (!EMAIL_RE.test(email)) return 'email is not a valid email address'
  if (role && !PROFILE_ROLES.includes(role)) return `role must be one of: ${PROFILE_ROLES.join(', ')}`
  if (cert_number && !CERT_NUMBER_RE.test(cert_number)) return 'cert_number is not a valid format'
  if (npi && !NPI_RE.test(npi)) return 'npi must be exactly 10 digits'
  if (hire_date && !isValidDateString(hire_date)) return 'hire_date must be a valid date (YYYY-MM-DD)'

  return null
}

// Audit trail for admin actions on staff (ACD-92 / AC 2). Separate table
// from the client-scoped `activity_log` -- see the ACD-92 migration note.
// Logging failure should never fail the admin action itself; the error is
// surfaced via console so it's visible in function logs for troubleshooting
// without ever including request secrets.
async function logStaffActivity(
  admin: ReturnType<typeof createClient>,
  actorId: string,
  action: 'invite' | 'revoke',
  detail: Record<string, unknown>
) {
  const { error } = await admin.from('staff_activity_log').insert({ actor_id: actorId, action, detail })
  if (error) console.error('staff_activity_log insert failed:', error.message)
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceRoleKey)

  // --- Auth: caller must be a logged-in admin -------------------------------
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return jsonResponse({ error: 'Missing Authorization header' }, 401)

  const { data: callerData, error: callerError } = await admin.auth.getUser(jwt)
  if (callerError || !callerData?.user) {
    return jsonResponse({ error: 'Invalid or expired session' }, 401)
  }

  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', callerData.user.id)
    .single()

  if (profileError || callerProfile?.role !== 'admin') {
    return jsonResponse({ error: 'Admin only' }, 403)
  }

  // --- Body -------------------------------------------------------------
  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'invalid JSON body' }, 400)
  }

  const { action } = payload
  if (action === 'invite') return handleInvite(admin, payload, callerData.user.id)
  if (action === 'revoke') return handleRevoke(admin, payload, callerData.user.id)
  return jsonResponse({ error: 'action must be "invite" or "revoke"' }, 400)
})

async function handleInvite(
  admin: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  actorId: string
) {
  const { name, email, phone, role, cert_number, cert_expiry, npi, hire_date } = payload as {
    name?: string
    email?: string
    phone?: string
    role?: string
    cert_number?: string
    cert_expiry?: string
    npi?: string
    hire_date?: string
  }

  const validationError = validateInvitePayload({ name, email, role, cert_number, npi, hire_date })
  if (validationError) return jsonResponse({ error: validationError }, 400)

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email!)
  if (inviteError || !inviteData?.user) {
    return jsonResponse({ error: inviteError?.message ?? 'invite failed' }, 400)
  }
  const newUserId = inviteData.user.id

  // Create the full staff row BEFORE touching profiles.role below. This
  // order matters: if the submitted role is 'admin', updating profiles.role
  // fires the handle_admin_promoted() trigger (see the ACD-71 migration),
  // which inserts a staff row of its own on conflict-do-nothing. Inserting
  // our fully-detailed row first means that trigger just no-ops instead of
  // racing us for a bare-bones duplicate -- and if this insert fails, we
  // bail before the profile is ever promoted, so we never end up with an
  // admin who has no staff row (the exact gap that prompted this ticket).
  const { data: staffRow, error: staffError } = await admin
    .from('staff')
    .insert({
      user_id: newUserId,
      name,
      email,
      phone: phone ?? null,
      role: role ?? 'bcba',
      cert_number: cert_number ?? null,
      // cert_expiry/hire_date are `date` columns -- the invite form sends ''
      // (not undefined) when left blank, and '??' only catches null/undefined,
      // so an empty string was reaching Postgres as `invalid input syntax for
      // type date: ""`, failing the staff insert AFTER the auth user was
      // already created (orphaned auth.users + profiles row, no staff row,
      // invisible anywhere in the UI). '|| null' catches the empty-string case.
      cert_expiry: cert_expiry || null,
      npi: npi ?? null,
      hire_date: hire_date || null,
      status: 'pending',
    })
    .select()
    .single()

  if (staffError) {
    return jsonResponse({ error: `invite sent but staff row creation failed: ${staffError.message}` }, 500)
  }

  // handle_new_user() already inserted a profiles row (role defaults to
  // 'bcba') as a side effect of the auth.users insert above -- update it to
  // the submitted role rather than inserting a duplicate row.
  if (role) {
    const { error: profileUpdateError } = await admin
      .from('profiles')
      .update({ role })
      .eq('id', newUserId)
    if (profileUpdateError) {
      return jsonResponse({ error: `invite created but profile role update failed: ${profileUpdateError.message}` }, 500)
    }
  }

  await logStaffActivity(admin, actorId, 'invite', { staff_id: staffRow.id, email })

  return jsonResponse({ staff: staffRow })
}

// Revoke is only reachable in the UI for invites that haven't been accepted
// yet, so there's no session/case data tied to this user anywhere else --
// it fully deletes the account rather than deactivating it.
// staff.user_id -> auth.users is ON DELETE NO ACTION, so the staff row must
// be deleted BEFORE the auth user, or the auth delete fails with a DB error
// because the staff row still references it.
async function handleRevoke(
  admin: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  actorId: string
) {
  const { staffId } = payload as { staffId?: string }
  if (!staffId) return jsonResponse({ error: 'staffId is required' }, 400)

  const { data: staffRow, error: staffLookupError } = await admin
    .from('staff')
    .select('id, user_id, email')
    .eq('id', staffId)
    .single()

  if (staffLookupError || !staffRow) return jsonResponse({ error: 'staff record not found' }, 404)

  const { error: deleteStaffError } = await admin
    .from('staff')
    .delete()
    .eq('id', staffId)

  if (deleteStaffError) return jsonResponse({ error: `revoke failed: ${deleteStaffError.message}` }, 500)

  if (staffRow.user_id) {
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(staffRow.user_id)
    if (deleteUserError) return jsonResponse({ error: `staff record removed but account deletion failed: ${deleteUserError.message}` }, 500)
  }

  await logStaffActivity(admin, actorId, 'revoke', { staff_id: staffRow.id, email: staffRow.email })

  return jsonResponse({ success: true })
}
