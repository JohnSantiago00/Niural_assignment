create table if not exists public.research_profiles (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.candidates(id) on delete cascade,
  linkedin_url_used text,
  github_url_used text,
  portfolio_url_used text,
  x_url_used text,
  linkedin_summary text,
  github_summary text,
  portfolio_summary text,
  x_summary text,
  discrepancy_flags text[] not null default '{}',
  candidate_brief text not null,
  model_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists research_profiles_candidate_id_idx
on public.research_profiles(candidate_id);

drop trigger if exists research_profiles_set_updated_at on public.research_profiles;
create trigger research_profiles_set_updated_at
before update on public.research_profiles
for each row
execute function public.set_updated_at();
