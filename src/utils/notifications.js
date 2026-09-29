import { supabase } from '../lib/supabase.js';
import { getStaffByUserIds, getAdminStaff } from '../lib/db.js';

export function mkNotif(subject, clientName = '', urgency = 'normal') {
  return { id: `n_${Date.now()}_${Math.random()}`, subject, clientName, timestamp: new Date().toISOString(), read: false, urgency };
}

// Real email delivery is a separate, opt-in step on top of the in-app
// notification list above -- mkNotif()/addNotif() are left untouched so the
// existing in-app behavior keeps working exactly as it does today. This is
// fire-and-forget by design: the caller never awaits it and swallows
// failures, because a failed email must never block the UI action that
// triggered it. Failures are still logged server-side in email_notifications
// by the edge function itself.
export function notifyByEmail({ recipientStaffId, notificationType, clientId = null, subject, body }) {
  if (!recipientStaffId) return;
  supabase.functions
    .invoke('send-notification-email', {
      body: { recipientStaffId, notificationType, clientId, subject, body },
    })
    .catch(() => {});
}

// Stage-change recipients: the assigned BCBA (always), the assigned RBT
// (only if one is on the client), and every admin.
export async function sendStageChangeEmail(client, subject, body) {
  const [assigned, admins] = await Promise.all([
    getStaffByUserIds([client.bcba_id, client.rbt_id]),
    getAdminStaff(),
  ]);
  const recipients = new Map();
  [...assigned, ...admins].forEach(s => recipients.set(s.id, s));
  recipients.forEach(s => {
    notifyByEmail({ recipientStaffId: s.id, notificationType: 'stage_change', clientId: client.id, subject, body });
  });
}

export function relTime(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}
