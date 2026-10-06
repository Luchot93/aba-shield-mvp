-- ACD-86 (D9a): Database foundation for the standalone Service Sessions
-- feature. Backend-only -- no app code reads or writes any of this today;
-- logging still happens in local React state (client.service_session_logs /
-- client.caregiver_training_session_logs), which is what the next story
-- (D9b) will replace.
--
-- 1. Drops the orphaned `service_session_logs` table (bcba_id, session_type
--    mixing behavior+skill, `own logs` RLS policy scoped only to bcba_id).
--    Confirmed via grep across src/ -- no `.from('service_session_logs')`
--    call anywhere; it was created in the baseline schema and never wired
--    up. Nothing references it via foreign key either, so a plain DROP is
--    safe (Postgres cascades the drop to its own policy automatically).
--
-- 2. Creates three replacement tables, one per live UI panel/modal --
--    behavior_session_logs, skill_session_logs, caregiver_training_session_logs
--    -- same shape, `entries jsonb` holding the same per-entry array shape
--    BehaviorSessionModal/SkillSessionModal/CaregiverTrainingLogModal already
--    build in memory. Not normalized into child tables/columns: the live
--    trend-graph components consume this as a plain JS array, and
--    normalizing would mean rewriting working graph logic for no benefit.
--
-- 3. RLS: reuses the existing public.can_access_client(client_id) helper
--    (defined in 20260928130000_client_checklist_documents_activity.sql,
--    already reused as-is by case_notes) instead of redefining the
--    admin-or-assigned rule a fourth time. SELECT + INSERT only, no
--    UPDATE/DELETE -- matches the append-only convention already set for
--    `documents` / `activity_log` in that same migration, since no live
--    modal edits a session log after it's saved (append-only audit trail).

-- ---------------------------------------------------------------------------
-- Drop the orphaned table. Dropping cascades its own "own logs" policy.
-- ---------------------------------------------------------------------------
drop table if exists public.service_session_logs;

-- ---------------------------------------------------------------------------
-- behavior_session_logs
-- ---------------------------------------------------------------------------
create table public.behavior_session_logs (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  logged_by_staff_id  uuid references auth.users(id),
  reauth_cycle        integer not null default 0,
  session_number      integer,
  session_date        date,
  entries             jsonb not null default '[]'::jsonb,
  notes               text,
  created_at          timestamptz not null default now()
);

alter table public.behavior_session_logs enable row level security;

create policy "behavior_session_logs select admin or assigned"
  on public.behavior_session_logs for select
  using (public.can_access_client(client_id));

create policy "behavior_session_logs insert admin or assigned"
  on public.behavior_session_logs for insert
  with check (public.can_access_client(client_id));

-- ---------------------------------------------------------------------------
-- skill_session_logs
-- ---------------------------------------------------------------------------
create table public.skill_session_logs (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  logged_by_staff_id  uuid references auth.users(id),
  reauth_cycle        integer not null default 0,
  session_number      integer,
  session_date        date,
  entries             jsonb not null default '[]'::jsonb,
  notes               text,
  created_at          timestamptz not null default now()
);

alter table public.skill_session_logs enable row level security;

create policy "skill_session_logs select admin or assigned"
  on public.skill_session_logs for select
  using (public.can_access_client(client_id));

create policy "skill_session_logs insert admin or assigned"
  on public.skill_session_logs for insert
  with check (public.can_access_client(client_id));

-- ---------------------------------------------------------------------------
-- caregiver_training_session_logs
-- ---------------------------------------------------------------------------
create table public.caregiver_training_session_logs (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  logged_by_staff_id  uuid references auth.users(id),
  reauth_cycle        integer not null default 0,
  session_number      integer,
  session_date        date,
  entries             jsonb not null default '[]'::jsonb,
  notes               text,
  created_at          timestamptz not null default now()
);

alter table public.caregiver_training_session_logs enable row level security;

create policy "caregiver_training_session_logs select admin or assigned"
  on public.caregiver_training_session_logs for select
  using (public.can_access_client(client_id));

create policy "caregiver_training_session_logs insert admin or assigned"
  on public.caregiver_training_session_logs for insert
  with check (public.can_access_client(client_id));
