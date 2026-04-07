create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.candidates(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  offer_status text not null default 'drafting'
    check (offer_status in ('drafting', 'ready', 'sent', 'signed', 'cancelled')),
  confirmed_job_title text not null,
  start_date date not null,
  base_salary text not null,
  compensation_structure text not null,
  equity_or_bonus text,
  reporting_manager text not null,
  custom_terms text,
  generated_letter text not null,
  generated_model_name text not null,
  signing_token text not null unique,
  signing_token_expires_at timestamptz,
  sent_at timestamptz,
  signed_at timestamptz,
  signer_ip text,
  signer_name text,
  signature_image_data text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists offers_candidate_id_idx on public.offers(candidate_id);
create index if not exists offers_application_id_idx on public.offers(application_id);
create index if not exists offers_signing_token_idx on public.offers(signing_token);

drop trigger if exists offers_set_updated_at on public.offers;
create trigger offers_set_updated_at
before update on public.offers
for each row
execute function public.set_updated_at();
