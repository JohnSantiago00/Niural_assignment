create table if not exists public.screening_results (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.candidates(id) on delete cascade,
  parsed_resume_text text not null,
  extracted_skills text[] not null default '{}',
  years_experience numeric,
  education text[] not null default '{}',
  past_employers text[] not null default '{}',
  key_achievements text[] not null default '{}',
  strengths text[] not null default '{}',
  gaps text[] not null default '{}',
  fit_score integer not null check (fit_score >= 0 and fit_score <= 100),
  rationale text not null,
  shortlist_recommendation boolean not null,
  model_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists screening_results_candidate_id_idx
on public.screening_results(candidate_id);

drop trigger if exists screening_results_set_updated_at on public.screening_results;
create trigger screening_results_set_updated_at
before update on public.screening_results
for each row
execute function public.set_updated_at();

