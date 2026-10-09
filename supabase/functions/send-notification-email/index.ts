// ACD-70 (A4): Sends a real email for a notification-worthy event (stage
// change today; auth-expiry warnings are a separate follow-up) and logs
// every attempt to email_notifications so staff can see success/failure.
// Called by the frontend via supabase.functions.invoke, fire-and-forget --
// see notifyByEmail() in src/utils/notifications.js. The caller never awaits
// the result, so failures here must not throw -- they get logged and
// returned as { success: false } instead.
//
// ACD-92 (E3): this function runs with the service role key, which bypasses
// the RLS "select own" policy on email_notifications -- so unlike most
// tables here, there was no server-side gate at all on who could trigger a
// send. Added below: require a valid Supabase JWT (same check manage-staff
// uses) and confirm the caller is the recipient themselves, an admin, or the
// assigned BCBA/RBT for the referenced client -- mirroring the same
// visibility rule RLS already enforces for reading these rows.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
// TODO: swap for the real verified sending domain once one exists in Resend.
const FROM_ADDRESS = 'ABA Shield <notifications@ourclinic-domain.com>'

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

// Defense against email header injection: a value carrying a newline could
// smuggle extra headers (e.g. a forged Bcc) into providers that build raw
// headers from this field. The body stays free text per the ticket -- it's
// sent as the message content, never placed into a header.
function stripHeaderInjection(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // --- Auth: caller must be a logged-in user, checked again below for
  // whether they're actually allowed to notify this particular recipient --
  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) return jsonResponse({ success: false, error: 'Missing Authorization header' }, 401)

  const { data: callerData, error: callerError } = await supabase.auth.getUser(jwt)
  if (callerError || !callerData?.user) {
    return jsonResponse({ success: false, error: 'Invalid or expired session' }, 401)
  }
  const callerId = callerData.user.id

  let payload: { recipientStaffId?: string; notificationType?: string; subject?: string; body?: string; clientId?: string | null }
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ success: false, error: 'invalid JSON body' }, 400)
  }

  const { recipientStaffId, notificationType, subject, body, clientId = null } = payload
  if (!recipientStaffId || !notificationType || !subject?.trim() || !body?.trim()) {
    return jsonResponse({ success: false, error: 'missing required fields' }, 400)
  }
  const safeSubject = stripHeaderInjection(subject)

  // --- Authorization: recipient themselves, an admin, or the client's
  // assigned BCBA/RBT (same rule RLS enforces for reading email_notifications,
  // re-checked here because the service-role client above bypasses RLS). ---
  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', callerId).single()
  const isAdmin = callerProfile?.role === 'admin'

  const { data: callerStaff } = await supabase.from('staff').select('id').eq('user_id', callerId).maybeSingle()
  const isRecipientSelf = callerStaff?.id === recipientStaffId

  let isAssignedForClient = false
  if (clientId) {
    const { data: clientRow } = await supabase.from('clients').select('bcba_id, rbt_id').eq('id', clientId).maybeSingle()
    isAssignedForClient = !!clientRow && (clientRow.bcba_id === callerId || clientRow.rbt_id === callerId)
  }

  if (!isAdmin && !isRecipientSelf && !isAssignedForClient) {
    return jsonResponse({ success: false, error: 'Not authorized to send this notification' }, 403)
  }

  const { data: logRow, error: insertError } = await supabase
    .from('email_notifications')
    .insert({
      recipient_staff_id: recipientStaffId,
      client_id: clientId,
      notification_type: notificationType,
      subject: safeSubject,
      body,
      status: 'pending',
    })
    .select()
    .single()

  if (insertError) return jsonResponse({ success: false, error: insertError.message }, 500)

  const markFailed = () =>
    supabase.from('email_notifications').update({ status: 'failed' }).eq('id', logRow.id)

  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('email')
    .eq('id', recipientStaffId)
    .single()

  if (staffError || !staff?.email) {
    await markFailed()
    return jsonResponse({ success: false, error: 'recipient has no email on file' })
  }

  if (!RESEND_API_KEY) {
    await markFailed()
    return jsonResponse({ success: false, error: 'RESEND_API_KEY not configured' })
  }

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to: [staff.email], subject: safeSubject, text: body }),
    })

    if (!resendRes.ok) {
      await markFailed()
      return jsonResponse({ success: false, error: await resendRes.text() })
    }

    await supabase
      .from('email_notifications')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', logRow.id)

    return jsonResponse({ success: true })
  } catch (err) {
    await markFailed()
    return jsonResponse({ success: false, error: String(err) })
  }
})
