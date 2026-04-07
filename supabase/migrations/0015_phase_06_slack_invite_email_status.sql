alter table public.slack_onboarding
drop constraint if exists slack_onboarding_invite_status_check;

alter table public.slack_onboarding
add constraint slack_onboarding_invite_status_check
check (invite_status in ('not_attempted', 'sent', 'invite_email_sent', 'failed', 'skipped', 'already_joined'));
