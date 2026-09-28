-- ACD-68 (A2): Persist per-client checklist ticks, uploaded documents, and the
-- activity/audit log in Postgres. Today these are pure client-side stubs --
-- `PHASE2_DEFAULTS` / `enrichClient()` in src/lib/db.js inject empty
-- documents: [], activity_log: [], reassessment_sessions: [],
-- caregiver_training_session_logs: [] onto every client -- so ticking a
-- checklist item, uploading a document, or any logged action disappears on
-- refresh. This migration gives checklist/documents/activity_log their own
-- tables with a client_id foreign key (see project decision in
-- handoff/memory: dedicated tables + per-row RLS, not JSON blobs on
-- `clients`), one trench at a time ahead of flipping FLAGS.PIPELINE.
--
-- Visibility model matches the corrected `clients` policy from
-- 20260928120000_client_staff_assignment_rls.sql: admin sees/writes
-- everything; a BCBA/BCaBA/RBT can only see or add to these records for a
-- client they are actually assigned to (bcba_id or rbt_id) -- NOT open to
-- all staff. This is intentionally narrower than the `staff`/`profiles`
-- directory-wide read policies from that same migration.
--
-- No DELETE policy on any of the three tables. `checklist_items` also gets an
-- UPDATE policy (ticking/un-ticking is an update on an existing row, keyed by
-- the (client_id, stage, item_key) unique constraint). `documents` and
-- `activity_log` are permanent once created -- insert-only, no UPDATE policy
-- either -- an uploaded file or a logged action can never be edited after the
-- fact via client RLS, only appended to. Removal or correction, if ever
-- needed, goes through the service role, not client RLS.

-- ---------------------------------------------------------------------------
-- Helper: can_access_client(client_id) -- shared visibility check for all
-- three tables below. Wraps the same admin-or-assigned rule as the `clients`
-- select/update policies, via the existing public.is_admin() helper, so the
-- rule is defined once instead of repeated inline in nine separate policies.
-- security definer + pinned search_path, matching the is_admin() /
-- enforce_client_assignment_admin_only() pattern already in this repo.
-- ---------------------------------------------------------------------------
create or replace function public.can_access_client(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clients c
    where c.id = target_client_id
      and (public.is_admin() or c.bcba_id = auth.uid() or c.rbt_id = auth.uid())
  );
$$;

revoke all on function public.can_access_client(uuid) from public;
grant execute on function public.can_access_client(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- checklist_items
-- ---------------------------------------------------------------------------
create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  stage text not null,
  item_key text not null,
  label text,
  is_complete boolean not null default false,
  completed_by uuid references auth.users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (client_id, stage, item_key)
);

alter table public.checklist_items enable row level security;

create policy "checklist_items select admin or assigned" on public.checklist_items
  for select
  using (public.can_access_client(client_id));

create policy "checklist_items insert admin or assigned" on public.checklist_items
  for insert
  with check (public.can_access_client(client_id));

create policy "checklist_items update admin or assigned" on public.checklist_items
  for update
  using (public.can_access_client(client_id))
  with check (public.can_access_client(client_id));

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  stage text,
  storage_path text not null,
  file_name text,
  mime_type text,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "documents select admin or assigned" on public.documents
  for select
  using (public.can_access_client(client_id));

create policy "documents insert admin or assigned" on public.documents
  for insert
  with check (public.can_access_client(client_id));

-- ---------------------------------------------------------------------------
-- activity_log
-- ---------------------------------------------------------------------------
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;

create policy "activity_log select admin or assigned" on public.activity_log
  for select
  using (public.can_access_client(client_id));

create policy "activity_log insert admin or assigned" on public.activity_log
  for insert
  with check (public.can_access_client(client_id));

-- ---------------------------------------------------------------------------
-- Storage: client-documents bucket. Separate from `assessment-documents`
-- (which is keyed by auth.uid() in the object path). This bucket is keyed by
-- client_id instead -- {client_id}/{filename} -- because access here is
-- shared between whichever staff are assigned to that client, not scoped to
-- the uploader. 25MB limit + PDF/DOCX/PNG/JPEG, matching the ticket's
-- acceptance criteria and mirroring the size cap already applied to
-- assessment-documents in 20260720175559_bucket_constraints.sql.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-documents',
  'client-documents',
  false,
  26214400, -- 25 MB (25 * 1024 * 1024)
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do nothing;

-- storage.foldername(name)[1] is the first path segment -- the client_id --
-- for an object stored at '{client_id}/{filename}'. Cast to uuid and run it
-- through the same can_access_client() check as the table rows above, so
-- storage access and row access follow one rule.
create policy "read client documents by assigned staff" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-documents'
    and public.can_access_client(((storage.foldername(name))[1])::uuid)
  );

create policy "upload client documents by assigned staff" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-documents'
    and public.can_access_client(((storage.foldername(name))[1])::uuid)
  );
