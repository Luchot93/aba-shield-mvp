-- ACD-70 (A4): Real email delivery, starting with stage-change notifications.
-- email_notifications is the log table the send-notification-email edge
-- function (deployed separately) writes to for every send attempt, so staff
-- can see success/failure per notification -- not just fire-and-forget.
--
-- Write access is service-role only: the edge function uses the service key
-- to insert/update. No insert/update policy is added for anon/authenticated,
-- matching the profiles-table pattern elsewhere in this repo (no policy =
-- denied by default). Staff can only read their own rows.

create table public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_staff_id uuid not null references public.staff(id),
  client_id uuid references public.clients(id),
  notification_type text not null,
  subject text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.email_notifications enable row level security;

create policy "email_notifications select own" on public.email_notifications
  for select
  using (
    recipient_staff_id in (select id from public.staff where user_id = auth.uid())
  );
