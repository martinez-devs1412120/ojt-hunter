-- OJT Hunter schema
-- Run this once in Supabase Dashboard > SQL Editor > New query

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

create policy "own applications all"
  on public.applications for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own documents all"
  on public.documents for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own notes all"
  on public.notes for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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
