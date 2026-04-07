alter table public.interviews
add column if not exists calendar_warning text;

alter table public.interviews
add column if not exists reschedule_preferences jsonb;
