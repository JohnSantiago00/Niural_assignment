create table if not exists public.slack_onboarding (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null unique references public.candidates(id) on delete cascade,
  offer_id uuid not null references public.offers(id) on delete cascade,
  onboarding_status text not null default 'not_started'
    check (
      onboarding_status in (
        'not_started',
        'invite_pending',
        'invite_sent',
        'invite_failed',
        'joined',
        'welcome_sent',
        'completed',
        'needs_manual_follow_up'
      )
    ),
  slack_invite_email text not null,
  slack_user_id text,
  invite_attempted_at timestamptz,
  invite_status text not null default 'not_attempted'
    check (invite_status in ('not_attempted', 'sent', 'invite_email_sent', 'failed', 'skipped', 'already_joined')),
  invite_error text,
  joined_at timestamptz,
  welcome_sent_at timestamptz,
  welcome_status text not null default 'not_sent'
    check (welcome_status in ('not_sent', 'sent', 'failed')),
  welcome_error text,
  hr_notified_at timestamptz,
  hr_notification_status text not null default 'not_sent'
    check (hr_notification_status in ('not_sent', 'sent', 'failed')),
  hr_notification_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists slack_onboarding_candidate_id_idx on public.slack_onboarding(candidate_id);
create index if not exists slack_onboarding_offer_id_idx on public.slack_onboarding(offer_id);
create index if not exists slack_onboarding_email_idx on public.slack_onboarding(slack_invite_email);
create index if not exists slack_onboarding_slack_user_id_idx on public.slack_onboarding(slack_user_id);

drop trigger if exists slack_onboarding_set_updated_at on public.slack_onboarding;
create trigger slack_onboarding_set_updated_at
before update on public.slack_onboarding
for each row
execute function public.set_updated_at();
