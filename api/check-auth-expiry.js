// ACD-70 (A4): Daily Vercel Cron job that emails staff when a client's
// authorization is 30 or 14 days from expiring. Fires exactly on those two
// days (not "<= 30") so each client gets exactly one email per threshold,
// no "already notified" bookkeeping needed.
//
// Recipients: assigned BCBA + all admins (no RBT -- by the time reauth looms
// an RBT is often not assigned yet). Reuses the send-notification-email edge
// function for the actual send + email_notifications logging, same as
// sendStageChangeEmail() on the frontend.
//
// auth_expiry_date is only ever set once a client reaches the "authorized"
// pipeline stage (ClientDetailPage.jsx), which is gated behind FLAGS.PIPELINE
// (off in production today) -- so this will find zero matches until Pipeline
// activates. It's built now so it's ready and testable ahead of that flip.
//
// Requires service-role DB access (reads across all clients/staff, not scoped
// to one user), so it uses SUPABASE_SERVICE_ROLE_KEY directly -- never expose
// that key to the browser. Protected by CRON_SECRET, which Vercel sends
// automatically as `Authorization: Bearer $CRON_SECRET` for configured cron
// invocations.

import { createClient } from '@supabase/supabase-js';

const THRESHOLDS = [
  { days: 30, urgency: 'warning' },
  { days: 14, urgency: 'urgent' },
];

function dateOnlyUTC(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  const authHeader = req.headers?.authorization ?? '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: admins, error: adminsError } = await supabase.from('profiles').select('id').eq('role', 'admin');
  if (adminsError) console.error('[check-auth-expiry] admins query failed:', adminsError.message);
  const adminIds = (admins ?? []).map(a => a.id);
  const { data: adminStaff, error: adminStaffError } = adminIds.length
    ? await supabase.from('staff').select('*').in('user_id', adminIds)
    : { data: [] };
  if (adminStaffError) console.error('[check-auth-expiry] admin staff query failed:', adminStaffError.message);

  let sent = 0;
  let failed = 0;

  for (const { days, urgency } of THRESHOLDS) {
    const targetDate = dateOnlyUTC(days);

    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, bcba_id')
      .eq('auth_expiry_date', targetDate);

    if (clientsError) {
      console.error(`[check-auth-expiry] ${days}d clients query failed:`, clientsError.message);
      continue;
    }
    if (!clients?.length) continue;

    const bcbaIds = [...new Set(clients.map(c => c.bcba_id).filter(Boolean))];
    const { data: bcbaStaff, error: bcbaError } = bcbaIds.length
      ? await supabase.from('staff').select('*').in('user_id', bcbaIds)
      : { data: [] };
    if (bcbaError) console.error(`[check-auth-expiry] ${days}d bcba staff query failed:`, bcbaError.message);

    for (const client of clients) {
      const recipients = new Map();
      (bcbaStaff ?? []).filter(s => s.user_id === client.bcba_id).forEach(s => recipients.set(s.id, s));
      (adminStaff ?? []).forEach(s => recipients.set(s.id, s));

      const subject = urgency === 'urgent'
        ? `URGENT — ${client.name} reauthorization due in ${days} days`
        : `${client.name} — Reauthorization due in ${days} days`;

      for (const staff of recipients.values()) {
        try {
          const { data, error } = await supabase.functions.invoke('send-notification-email', {
            body: {
              recipientStaffId: staff.id,
              notificationType: `auth_expiry_${days}`,
              clientId: client.id,
              subject,
              body: subject,
            },
          });
          if (error || data?.success !== true) {
            failed++;
            console.error(`[check-auth-expiry] send failed — staff ${staff.id}, client ${client.id}:`, error?.message ?? data?.error);
          } else {
            sent++;
          }
        } catch (err) {
          failed++;
          console.error(`[check-auth-expiry] send threw — staff ${staff.id}, client ${client.id}:`, err);
        }
      }
    }
  }

  return res.status(200).json({ sent, failed });
}
