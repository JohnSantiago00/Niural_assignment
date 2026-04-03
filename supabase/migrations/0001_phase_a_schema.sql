create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  team text not null,
  location text not null,
  remote_status text not null,
  experience_level text not null,
  responsibilities text[] not null default '{}',
  requirements text[] not null default '{}',
  status text not null default 'open',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete restrict,
  full_name text not null,
  email text not null,
  linkedin_url text not null,
  portfolio_url text,
  github_url text,
  resume_file_path text not null,
  submission_status text not null default 'submitted',
  submitted_at timestamptz not null default timezone('utc', now()),
  constraint applications_role_email_unique unique (role_id, email)
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  full_name text not null,
  email text not null,
  linkedin_url text not null,
  portfolio_url text,
  github_url text,
  current_status text not null default 'applied',
  ai_score numeric,
  shortlist_threshold integer not null default 75,
  admin_override boolean not null default false,
  admin_override_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  action_type text not null,
  action_detail text,
  actor text not null default 'system',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists roles_status_idx on public.roles(status);
create index if not exists applications_email_idx on public.applications(email);
create index if not exists candidates_role_status_idx on public.candidates(role_id, current_status);
create index if not exists audit_logs_candidate_id_idx on public.audit_logs(candidate_id);

drop trigger if exists candidates_set_updated_at on public.candidates;
create trigger candidates_set_updated_at
before update on public.candidates
for each row
execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-resumes',
  'candidate-resumes',
  false,
  5242880,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

