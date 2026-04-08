# Internal Access and RBAC Notes

Current admin access model, why it was chosen, and how it would evolve into production RBAC.

## Current Security Model

| Area | Current protection |
| --- | --- |
| Public careers/apply pages | Public. |
| Candidate scheduling page | Public but tokenized with `selection_token`. |
| Candidate offer signing page | Public but tokenized with `signing_token`. |
| Admin dashboard | Supabase Auth session + `admin_users` allowlist. |
| Server-side privileged DB operations | Supabase service-role key, server only. |
| Slack Events endpoint | Slack signature verification with `SLACK_SIGNING_SECRET`. |

## Why Supabase Auth + Allowlist

The first admin protection model used a shared access code. That was simple but too artificial:

- no individual identity
- no separation between authentication and authorization
- no clean way to show logged-in admin state
- no obvious migration path to real roles

The current model uses:

- Supabase Auth for identity
- `public.admin_users` for authorization
- `/login` for sign-in
- `/not-authorized` for signed-in users who are not admins

This is still small, but it is much closer to a real internal product.

## Current Admin Flow

```text
User opens /admin
  |
  v
No Supabase session?
  -> redirect to /login

Has Supabase session?
  |
  v
Email exists in public.admin_users?
  -> yes: render admin
  -> no: redirect to /not-authorized
```

## Tokenized Candidate Pages

Candidate scheduling and signing are intentionally public but tokenized.

| Route | Token | Why |
| --- | --- | --- |
| `/interview/[selectionToken]` | high-entropy scheduling token shared across active holds | Candidate can pick from offered slots without creating an account. |
| `/offer/[signingToken]` | high-entropy offer signing token | Candidate can review and sign a specific offer without admin access. |

The server validates token existence and current state before mutations.

## Production RBAC Design

A production version would introduce at least three internal roles:

| Role | Can do | Cannot do |
| --- | --- | --- |
| Recruiter / Hiring manager | View all candidates, run screening/enrichment, schedule, send offers, onboard | Manage system configuration unless explicitly granted. |
| Interviewer | View assigned candidates and submit interview feedback | See salary/offers, Slack onboarding state, or unrelated candidates. |
| Admin | Manage users, roles, workflow settings, and all candidate data | N/A, subject to audit logging. |

Candidate users would remain separate from internal users.

## Migration Path

The upgrade path is additive:

1. Add role metadata to Supabase Auth users or a new `internal_users` table.
2. Add relationship tables for interviewer/candidate assignments.
3. Enable RLS policies for candidate, application, offer, and feedback tables.
4. Split admin pages by role-specific capabilities.
5. Keep service-role operations constrained to server-only workflow helpers.
6. Expand audit logs to include authorization changes and sensitive record access.

## Why Not Build Full RBAC Now

Full RBAC is valuable, but it would add complexity across every route and table before the workflow needs that level of separation. For this codebase, the allowlist model is the right balance:

- real identity
- explicit admin access
- small setup burden
- clear production migration path
- clear production migration path
