-- OJT Hunter schema
-- Run in Supabase Dashboard > SQL Editor > New query. Safe to re-run:
-- existing setups get the funnel timestamp columns added on re-run.

create extension if not exists pgcrypto;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company text not null,
  position text not null default 'OJT Intern',
  hr_email text,
  source_url text,
  status text not null default 'to_apply'
    check (status in ('to_apply','applied','interview','offer','rejected')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  deadline date,
  follow_up_at timestamptz,
  applied_at timestamptz,
  ojt_hours int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null default 'other'
    check (type in ('resume','tor','good_moral','nda','medical','other')),
  link text not null,
  version text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_applications_user on public.applications (user_id);
create index if not exists idx_applications_status on public.applications (status);
create index if not exists idx_applications_deadline on public.applications (deadline);
create index if not exists idx_documents_user on public.documents (user_id);
create index if not exists idx_notes_application on public.notes (application_id);

alter table public.applications enable row level security;
alter table public.documents enable row level security;
alter table public.notes enable row level security;

drop policy if exists "own applications all" on public.applications;
drop policy if exists "own documents all" on public.documents;
drop policy if exists "own notes all" on public.notes;
drop policy if exists "own applications select" on public.applications;
drop policy if exists "own applications insert" on public.applications;
drop policy if exists "own applications update" on public.applications;
drop policy if exists "own applications delete" on public.applications;
drop policy if exists "own documents select" on public.documents;
drop policy if exists "own documents insert" on public.documents;
drop policy if exists "own documents update" on public.documents;
drop policy if exists "own documents delete" on public.documents;
drop policy if exists "own notes select" on public.notes;
drop policy if exists "own notes insert" on public.notes;
drop policy if exists "own notes update" on public.notes;
drop policy if exists "own notes delete" on public.notes;

create policy "own applications select"
  on public.applications for select
  using ((select auth.uid()) = user_id);
create policy "own applications insert"
  on public.applications for insert
  with check ((select auth.uid()) = user_id);
create policy "own applications update"
  on public.applications for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "own applications delete"
  on public.applications for delete
  using ((select auth.uid()) = user_id);

create policy "own documents select"
  on public.documents for select
  using ((select auth.uid()) = user_id);
create policy "own documents insert"
  on public.documents for insert
  with check ((select auth.uid()) = user_id);
create policy "own documents update"
  on public.documents for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "own documents delete"
  on public.documents for delete
  using ((select auth.uid()) = user_id);

create policy "own notes select"
  on public.notes for select
  using ((select auth.uid()) = user_id);
create policy "own notes insert"
  on public.notes for insert
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.applications where id = application_id and user_id = (select auth.uid()))
  );
create policy "own notes update"
  on public.notes for update
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.applications where id = application_id and user_id = (select auth.uid()))
  );
create policy "own notes delete"
  on public.notes for delete
  using ((select auth.uid()) = user_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_applications_touch on public.applications;
create trigger trg_applications_touch
  before update on public.applications
  for each row execute function public.touch_updated_at();

-- Input size limits (safe to re-run; skips constraints that already exist)
do $$ begin
  alter table public.applications
    add constraint app_company_len check (char_length(company) between 1 and 120);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.applications
    add constraint app_position_len check (char_length(position) between 1 and 120);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.applications
    add constraint app_email_len check (hr_email is null or char_length(hr_email) <= 254);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.applications
    add constraint app_url_len check (source_url is null or char_length(source_url) <= 2048);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.applications
    add constraint app_hours_range check (ojt_hours is null or ojt_hours between 0 and 10000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.documents
    add constraint doc_name_len check (char_length(name) between 1 and 120);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.documents
    add constraint doc_version_len check (version is null or char_length(version) <= 60);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.documents
    add constraint doc_link_len check (char_length(link) between 1 and 2048);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.documents
    add constraint doc_notes_len check (notes is null or char_length(notes) <= 2000);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.notes
    add constraint note_content_len check (char_length(content) between 1 and 10000);
exception when duplicate_object then null; end $$;

-- Funnel timestamps: set by the app the first time an application reaches
-- the interview / offer stage. Backfill approximates from current state.
alter table public.applications add column if not exists interviewed_at timestamptz;
alter table public.applications add column if not exists offered_at timestamptz;

update public.applications set interviewed_at = updated_at
  where status in ('interview','offer') and interviewed_at is null;
update public.applications set offered_at = updated_at
  where status = 'offer' and offered_at is null;

-- URL scheme + email format checks (defense in depth; the client already
-- enforces these before insert)
do $$ begin
  alter table public.applications
    add constraint app_source_url_http check (source_url is null or source_url ~* '^https?://');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.applications
    add constraint app_hr_email_fmt check (hr_email is null or hr_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.documents
    add constraint doc_link_http check (link ~* '^https?://');
exception when duplicate_object then null; end $$;

-- Cloud file storage: documents can either carry an external link or an
-- uploaded file in the private 'vault-files' bucket.
alter table public.documents add column if not exists storage_path text;

alter table public.documents alter column link drop not null;
alter table public.documents drop constraint if exists doc_link_len;
do $$ begin
  alter table public.documents
    add constraint doc_link_rule check (
      storage_path is not null
      or (link is not null and char_length(link) between 1 and 2048)
    );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.documents
    add constraint doc_storage_path_len check (char_length(storage_path) <= 1024);
exception when duplicate_object then null; end $$;

-- Private bucket: one folder per user ({user_id}/...), 10 MB limit
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vault-files', 'vault-files', false, 10485760,
  array['application/pdf','image/png','image/jpeg','image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Bucket policies: every operation confined to the caller's own folder
drop policy if exists "own vault-files select" on storage.objects;
drop policy if exists "own vault-files insert" on storage.objects;
drop policy if exists "own vault-files update" on storage.objects;
drop policy if exists "own vault-files delete" on storage.objects;

create policy "own vault-files select"
  on storage.objects for select
  using (bucket_id = 'vault-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own vault-files insert"
  on storage.objects for insert
  with check (bucket_id = 'vault-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own vault-files update"
  on storage.objects for update
  using (bucket_id = 'vault-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own vault-files delete"
  on storage.objects for delete
  using (bucket_id = 'vault-files' and (storage.foldername(name))[1] = auth.uid()::text);
