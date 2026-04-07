# Phase B Notes

## What Phase B adds

Phase B adds the internal admin read layer on top of the public intake flow built in Phase A.

The system now supports:

- an internal `/admin` dashboard
- a filterable candidate table
- a candidate profile page at `/admin/candidates/[candidateId]`
- clear workflow status rendering
- combined visibility into candidate, application, role, and audit data

## Why the admin dashboard matters

Phase A only gets candidates into the system. Phase B makes that intake operationally useful.

Once applications exist, internal teammates need a single place to:

- scan incoming candidates quickly
- filter the queue by role or status
- open one candidate and review the full application context
- understand where that person is in the hiring lifecycle

This is the minimum internal tool that turns intake data into a working hiring workflow.

## Data flow from DB to dashboard

The dashboard reads from existing Phase A tables only:

- `candidates`
- `applications`
- `roles`
- `audit_logs`

### Dashboard

The `/admin` page:

1. reads URL-based filters
2. fetches matching `candidates`
3. loads related `roles` and `applications`
4. assembles a small row view model for the table

This keeps the page component simple and keeps query logic centralized in `lib/admin/queries.ts`.

### Candidate detail

The `/admin/candidates/[candidateId]` page:

1. loads one candidate
2. fetches the related application
3. fetches the related role
4. fetches that candidate's audit logs
5. renders everything as one review page

## Why explicit statuses matter now

Phase B introduced explicit lifecycle rendering around `current_status` before the later workflow phases were added.

This matters because:

- the admin UI already needs a consistent workflow vocabulary
- filters become meaningful immediately
- later automation can plug into known states instead of inventing them later
- interviews are easier because the workflow model is visible now

Current statuses include:

- applied
- screened
- shortlisted
- interview_pending
- interview_scheduled
- interview_completed
- offer_drafted
- offer_sent
- offer_signed
- onboarded
- rejected

## How this sets up Phase C

Phase C can add AI screening without changing the admin structure.

For example:

- AI scoring can appear on the candidate detail page where the placeholder fields already exist
- AI outputs can influence `current_status`
- review filters can expand around score thresholds or review queues
- audit logs can capture automated transitions or scoring events

The important point is that Phase B creates the operational review surface first, so later intelligence has somewhere useful to land.

## Phase B alignment work completed

This follow-up pass closes the small remaining gaps between the dashboard and the assignment expectations.

### AI score now appears in the dashboard table

The admin table now includes an `AI Score` column even before screening exists.

Why:

- the assignment expects the review table to include AI score
- adding the column now makes the future screening rollout feel additive instead of disruptive
- operators can already see whether a candidate has been scored or not

For now, candidates with no score render as `Not scored`.

### Date filtering is now supported

The dashboard filter bar now includes:

- role
- status
- from date
- to date
- sort

The date filters are URL-driven just like the rest of the dashboard state. That keeps the page deterministic, shareable, and easy to explain.

### Admin navigation feels internal

On admin pages, the global nav no longer shows `Apply`.

That matters because:

- `Apply` is part of the candidate-facing flow
- the admin area should feel like an operator tool
- the internal and public experiences should feel distinct

### Candidate detail page is structured for Phase C

The candidate detail page now has a clearer `Screening readiness` block that groups:

- AI score
- screening summary placeholder
- strengths placeholder
- gaps placeholder
- shortlist threshold
- shortlist decision
- admin override state
- override note

This makes it obvious where Phase C screening outputs will land without implementing the screening logic yet.
