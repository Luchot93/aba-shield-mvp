// ACD-70 (A4): Sends a real email for a notification-worthy event (stage
// change today; auth-expiry warnings are a separate follow-up) and logs
// every attempt to email_notifications so staff can see success/failure.
// Called by the frontend via supabase.functions.invoke, fire-and-forget --
// see notifyByEmail() in src/utils/notifications.js. The caller never awaits
// the result, so failures here must not throw -- they get logged and
// returned as { success: false } instead.

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

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  let payload: { recipientStaffId?: string; notificationType?: string; subject?: string; body?: string; clientId?: string | null }
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ success: false, error: 'invalid JSON body' }, 400)
  }

  const { recipientStaffId, notificationType, subject, body, clientId = null } = payload
  if (!recipientStaffId || !notificationType || !subject || !body) {
    return jsonResponse({ success: false, error: 'missing required fields' }, 400)
  }

  const { data: logRow, error: insertError } = await supabase
    .from('email_notifications')
    .insert({
      recipient_staff_id: recipientStaffId,
      client_id: clientId,
      notification_type: notificationType,
      subject,
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
      body: JSON.stringify({ from: FROM_ADDRESS, to: [staff.email], subject, text: body }),
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
