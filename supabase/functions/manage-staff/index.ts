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
  if (action === 'invite') return handleInvite(admin, payload)
  if (action === 'revoke') return handleRevoke(admin, payload)
  return jsonResponse({ error: 'action must be "invite" or "revoke"' }, 400)
})

async function handleInvite(admin: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
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

  if (!name || !email) return jsonResponse({ error: 'name and email are required' }, 400)
  if (role && !PROFILE_ROLES.includes(role)) {
    return jsonResponse({ error: `role must be one of: ${PROFILE_ROLES.join(', ')}` }, 400)
  }

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email)
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
      cert_expiry: cert_expiry ?? null,
      npi: npi ?? null,
      hire_date: hire_date ?? null,
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

  return jsonResponse({ staff: staffRow })
}

async function handleRevoke(admin: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  const { staffId } = payload as { staffId?: string }
  if (!staffId) return jsonResponse({ error: 'staffId is required' }, 400)

  const { data: staffRow, error: staffLookupError } = await admin
    .from('staff')
    .select('id, user_id')
    .eq('id', staffId)
    .single()

  if (staffLookupError || !staffRow) return jsonResponse({ error: 'staff record not found' }, 404)

  if (staffRow.user_id) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(staffRow.user_id)
    if (deleteError) return jsonResponse({ error: `revoke failed: ${deleteError.message}` }, 500)
  }

  const { error: updateError } = await admin
    .from('staff')
    .update({ status: 'revoked' })
    .eq('id', staffId)

  if (updateError) return jsonResponse({ error: `login revoked but status update failed: ${updateError.message}` }, 500)

  return jsonResponse({ success: true })
}
