# Architecture Overview

## High-level system

The app is a single Next.js App Router codebase with public candidate pages,
protected admin pages, and server-first workflow helpers. Supabase Postgres is
the system of record, Supabase Storage holds resumes, Gemini handles bounded AI
generation tasks, Google Calendar supports interview scheduling, and Resend
handles best-effort candidate/admin email delivery. Slack supports onboarding
lookup and messaging after offer signature when configured.

Core layers:

- UI: `app/` and `components/`
- workflow logic: `lib/applications`, `lib/screening`, `lib/enrichment`, `lib/scheduling`, `lib/interview`, `lib/offers`, `lib/slack`
- integrations: `lib/supabase`, `lib/gemini`, `lib/email`, `lib/slack`
- shared types and validation: `types/`, `lib/utils`, Zod schemas

## Candidate apply to offer flow

1. Candidate browses roles on `/careers`
2. Candidate applies and uploads a resume
3. Application, candidate, storage, and audit records are created
4. Admin screens the resume with Gemini and deterministic shortlist logic
5. Admin enriches shortlisted candidates from submitted profile links
6. Admin offers interview slots from Google Calendar free/busy plus DB hold filtering
7. Candidate selects a tokenized interview slot
8. Admin completes the interview and stores transcript summary plus feedback
9. Admin sends an offer from hiring-manager inputs
10. Candidate opens `/offer/[signingToken]` and signs with the canvas pad
11. Slack onboarding starts from the signed offer and sends real Slack messages when the workspace/app permissions allow it

## Deterministic workflow ownership

Application logic controls:

- duplicate application protection
- role-open checks
- resume validation
- shortlist threshold behavior
- admin override behavior
- enrichment eligibility
- Google Calendar/DB hold conflict prevention
- interview completion state
- offer eligibility, sent state, signing token validation, and first-signature-wins behavior
- Slack onboarding state, join detection, and message idempotency
- admin route protection

Gemini generates structured or plain-text artifacts, but it does not directly
change workflow state.

## Where Gemini is used

Gemini is used only in server-side helpers under `lib/gemini/`.

Current AI tasks:

- resume screening
- shortlist-only profile enrichment
- interview transcript summarization
- offer-letter drafting from explicit hiring-manager inputs
- Slack welcome-message drafting from explicit onboarding context

Gemini output is parsed and validated before persistence. For offer letters, the
app additionally strips common JSON/placeholder artifacts before saving the
candidate-facing letter text.

## Scheduling architecture

Google Calendar is used for free/busy lookup and final event creation. The app
still uses `calendar_holds` as the source of truth for tentative reservation
because Google free/busy does not reserve options while a candidate is deciding.
The Postgres exclusion constraint prevents overlapping active holds/confirmed
slots for the same interviewer.

## Offer signing architecture

Offers are stored in `offers`. Admin sends an offer from a compact input form;
the app generates the letter, stores it, sends the candidate email, and exposes a
tokenized signing page. Signing captures a PNG data URL, timestamp, and request
IP. Resend sends a best-effort alert to the hiring team when the offer is signed.

## Slack onboarding architecture

Slack onboarding is stored in `slack_onboarding` and starts only after an offer
is signed. The app attempts real Slack lookup by email, optionally attempts a
workspace invite when admin invite credentials are configured, and sends welcome
and HR messages through Slack when the candidate is detected in the workspace.
Invite API limitations are stored as follow-up state rather than treated as
success.

## Auth / admin access

Admin access uses:

- Supabase Auth for identity
- `public.admin_users` as an allowlist for authorization
- protected admin routes via middleware / proxy

Candidate scheduling and signing pages are public but tokenized.

## What comes next

Future hardening can add richer onboarding checklists, internal account setup,
or deeper Slack workspace administration once the target workspace permissions
are known.
