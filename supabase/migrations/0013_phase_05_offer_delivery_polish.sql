alter table public.offers
add column if not exists offer_email_status text
  check (offer_email_status in ('sent', 'failed', 'skipped'));

alter table public.offers
add column if not exists offer_email_error text;

alter table public.offers
add column if not exists offer_email_recipient text;
