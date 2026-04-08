alter table public.screening_results
add column if not exists input_fingerprint text,
add column if not exists prompt_version text,
add column if not exists generated_at timestamptz;

alter table public.interview_transcripts
add column if not exists input_fingerprint text,
add column if not exists prompt_version text,
add column if not exists generated_at timestamptz;

alter table public.offers
add column if not exists input_fingerprint text,
add column if not exists prompt_version text,
add column if not exists generated_at timestamptz;

create index if not exists screening_results_input_fingerprint_idx
on public.screening_results(candidate_id, input_fingerprint);

create index if not exists interview_transcripts_input_fingerprint_idx
on public.interview_transcripts(interview_id, input_fingerprint);

create index if not exists offers_input_fingerprint_idx
on public.offers(candidate_id, input_fingerprint);
