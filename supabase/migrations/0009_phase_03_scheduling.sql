create extension if not exists btree_gist;

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.candidates(id) on delete cascade,
  interviewer_name text,
  interviewer_email text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  meeting_link text,
  calendar_event_id text,
  interview_status text not null default 'pending'
    check (interview_status in ('pending', 'options_sent', 'scheduled', 'reschedule_requested', 'completed', 'cancelled')),
  scheduling_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.calendar_holds (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  interview_id uuid not null references public.interviews(id) on delete cascade,
  interviewer_name text not null,
  interviewer_email text not null,
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  hold_status text not null default 'held'
    check (hold_status in ('held', 'confirmed', 'released', 'expired')),
  expires_at timestamptz not null,
  selection_token text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint calendar_holds_slot_order check (slot_end > slot_start)
);

create index if not exists interviews_candidate_id_idx on public.interviews(candidate_id);
create index if not exists calendar_holds_interview_id_idx on public.calendar_holds(interview_id);
create index if not exists calendar_holds_candidate_id_idx on public.calendar_holds(candidate_id);
create index if not exists calendar_holds_selection_token_idx on public.calendar_holds(selection_token);
create index if not exists calendar_holds_expires_at_idx on public.calendar_holds(expires_at);

alter table public.calendar_holds
drop constraint if exists calendar_holds_no_active_overlap;

alter table public.calendar_holds
add constraint calendar_holds_no_active_overlap
exclude using gist (
  interviewer_email with =,
  tstzrange(slot_start, slot_end, '[)') with &&
)
where (hold_status in ('held', 'confirmed'));

drop trigger if exists interviews_set_updated_at on public.interviews;
create trigger interviews_set_updated_at
before update on public.interviews
for each row
execute function public.set_updated_at();

create or replace function public.expire_calendar_holds()
returns integer
language plpgsql
as $$
declare
  expired_count integer;
begin
  update public.calendar_holds
  set hold_status = 'expired'
  where hold_status = 'held'
    and expires_at <= timezone('utc', now());

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

create or replace function public.confirm_calendar_hold(
  p_selection_token text,
  p_hold_id uuid
)
returns uuid
language plpgsql
as $$
declare
  selected_hold public.calendar_holds%rowtype;
begin
  perform public.expire_calendar_holds();

  select *
  into selected_hold
  from public.calendar_holds
  where id = p_hold_id
    and selection_token = p_selection_token
    and hold_status = 'held'
    and expires_at > timezone('utc', now())
  for update;

  if not found then
    raise exception 'Selected interview slot is no longer available.';
  end if;

  update public.calendar_holds
  set hold_status = 'confirmed'
  where id = selected_hold.id;

  update public.calendar_holds
  set hold_status = 'released'
  where interview_id = selected_hold.interview_id
    and id <> selected_hold.id
    and hold_status = 'held';

  update public.interviews
  set
    interviewer_name = selected_hold.interviewer_name,
    interviewer_email = selected_hold.interviewer_email,
    scheduled_start = selected_hold.slot_start,
    scheduled_end = selected_hold.slot_end,
    interview_status = 'scheduled',
    scheduling_note = null
  where id = selected_hold.interview_id;

  update public.candidates
  set current_status = 'interview_scheduled'
  where id = selected_hold.candidate_id;

  return selected_hold.interview_id;
end;
$$;
