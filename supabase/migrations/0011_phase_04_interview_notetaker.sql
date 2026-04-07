create table if not exists public.interview_transcripts (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  interview_id uuid not null unique references public.interviews(id) on delete cascade,
  transcript_text text not null,
  transcript_source text not null default 'simulated'
    check (transcript_source in ('simulated', 'fireflies_mock', 'fireflies_real_ready')),
  overall_assessment text not null,
  strengths_observed text[] not null default '{}',
  concerns_observed text[] not null default '{}',
  key_topics_discussed text[] not null default '{}',
  recommended_follow_up text[] not null default '{}',
  concise_summary text not null,
  model_name text not null,
  completed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.interview_feedback (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  interview_id uuid not null unique references public.interviews(id) on delete cascade,
  rating integer not null check (rating >= 1 and rating <= 5),
  comments text not null,
  actor text not null default 'admin',
  submitted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists interview_transcripts_candidate_id_idx
on public.interview_transcripts(candidate_id);

create index if not exists interview_feedback_candidate_id_idx
on public.interview_feedback(candidate_id);

drop trigger if exists interview_transcripts_set_updated_at on public.interview_transcripts;
create trigger interview_transcripts_set_updated_at
before update on public.interview_transcripts
for each row
execute function public.set_updated_at();

drop trigger if exists interview_feedback_set_updated_at on public.interview_feedback;
create trigger interview_feedback_set_updated_at
before update on public.interview_feedback
for each row
execute function public.set_updated_at();
