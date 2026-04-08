# Niural Hiring Workflow

An end-to-end hiring workflow for application intake, AI screening and enrichment, interview scheduling, interview evaluation, offer generation/signing, and Slack onboarding.

## Quick Start

```bash
git clone <repo-url>
cd <repo-name>
npm install
cp .env.example .env.local
# fill the required Supabase values in .env.local
npm run db:setup
npm run dev
```

## Visit

- [http://localhost:3000/careers](http://localhost:3000/careers) — public careers flow
- [http://localhost:3000/admin](http://localhost:3000/admin) — admin hiring portal

## Demo Guide

After running `npm run db:setup`, open `/admin` and inspect these seeded candidates first:

| Candidate    | Best for reviewing                       |
| ------------ | ---------------------------------------- |
| Robin Santos | Signed offer + Slack onboarding complete |
| Ted Mosby    | Interview summary + offer sent           |
| Priya Shah   | Scheduled interview                      |
| Jordan Lee   | Shortlisted + enrichment                 |
| Maya Chen    | Newly applied candidate                  |

Quick path:

1. Open `/careers` to review the public candidate experience.
2. Open `/admin` to review the internal hiring portal.
3. Click `Ted Mosby` or `Robin Santos` for late-stage workflow data.
4. Click `Maya Chen` to run early-stage actions from a fresh applied state.

## Commands

```bash
npm run dev          # start the local app
npm run db:setup     # apply migrations, then seed demo data
npm run db:seed      # reseed demo data only
npm run lint         # eslint
npm run typecheck    # TypeScript check
npm run build        # production build
```

## Project Overview

The product models a realistic hiring pipeline:

- Public role discovery and application intake
- Resume upload and duplicate application protection
- AI-assisted screening and candidate enrichment
- Admin shortlist decisions and workflow audit history
- Interview slot offering, candidate selection, and reschedule handling
- Interview transcript simulation, summary, and evaluation state
- Offer generation, email delivery, and custom canvas e-signature
- Slack onboarding after signed offer

Workflow truth stays in Supabase. Gemini, Resend, Google Calendar, and Slack are integration layers around deterministic app state rather than the source of truth.

## Tech Stack

| Technology                 | Why it is used                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| Next.js App Router         | Public pages, admin pages, server actions, and API routes in one cohesive codebase.                       |
| TypeScript                 | Explicit workflow records, AI artifacts, and Supabase row types.                                          |
| Tailwind CSS               | Shared visual system across public, admin, interview, and offer pages.                                    |
| Supabase Postgres          | Durable workflow state, migrations, admin allowlist, and candidate lifecycle records.                     |
| Supabase Storage           | Private resume upload storage without a separate file service.                                            |
| Supabase Auth              | Real admin identity instead of a shared admin password.                                                   |
| Gemini via `@google/genai` | Bounded generation for screening, enrichment, interview summaries, offer letters, and Slack welcome copy. |
| Resend                     | Candidate/admin transactional emails with best-effort delivery handling.                                  |
| Google Calendar API        | Free/busy lookup and interview event creation when configured.                                            |
| Slack Web API              | User lookup, onboarding channel/DM messages, and HR notifications when configured.                        |
| Zod                        | Structured AI output validation before database writes.                                                   |
| `postgres`                 | Lightweight SQL runner for `npm run db:setup` without requiring Supabase CLI.                             |
| Canvas signature pad       | Custom drawn-signature experience for offer signing.                                                      |

## Why This Stack

- **Deterministic workflow state:** Supabase records own candidate status, offer status, scheduling status, and onboarding status.
- **AI as artifact generation:** Gemini writes summaries/drafts; app logic decides transitions.
- **One-command setup:** `npm run db:setup` applies migrations and seeds data with one command.
- **Real integrations where practical:** Resend, Google Calendar, and Slack are wired as real provider integrations, while the app remains testable when optional credentials are absent.
- **Small architecture surface:** Next.js server actions and API routes keep the system easy to inspect without adding queues, workers, or extra services.

## AI Usage

Gemini is used for:

- Screening fit analysis
- Candidate enrichment summaries
- Reschedule preference extraction
- Interview transcript summaries
- Offer letter drafting
- Slack welcome copy

AI outputs are constrained with:

- Zod validation for structured responses
- Prompt versions and input fingerprints for cache reuse
- Deterministic fallbacks for quota-limited or temporarily unavailable calls
- Server-side workflow guards so model output never directly changes status

More detail: [docs/ai-usage.md](docs/ai-usage.md) and [docs/token-strategy.md](docs/token-strategy.md)

## Real vs Mocked

| Area          | What is real                                                  | What is simplified                                                                                         |
| ------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Applications  | Real public form, Supabase records, resume storage            | Resume parsing remains lightweight for demo use.                                                           |
| Screening     | Real Gemini calls when configured                             | Deterministic fallback keeps the workflow moving when Gemini is quota-limited.                             |
| Enrichment    | Real structured enrichment artifact flow                      | Conservative lightweight enrichment; no LinkedIn/GitHub partner APIs.                                      |
| Scheduling    | Real DB holds and Google Calendar integration when configured | One configured calendar instead of per-interviewer OAuth.                                                  |
| Interview     | Transcript and summary records are persisted                  | Transcript source is simulated, not a live meeting bot.                                                    |
| Offer signing | Real tokenized signing page and canvas signature capture      | No generated PDF artifact yet.                                                                             |
| Email         | Real Resend delivery when configured                          | Workflow state remains testable without real email delivery.                                               |
| Slack         | Real lookup and messaging when configured                     | Admin invite API is optional; invite-link email fallback is used when admin invite scopes are unavailable. |

## Environment Variables

### Required For Local Demo

These are enough to boot the app, run `npm run db:setup`, seed demo data, and inspect the main flows.

| Variable                                       | Purpose                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| `APP_BASE_URL`                                 | Local/public base URL for generated links, usually `http://localhost:3000`. |
| `NEXT_PUBLIC_SUPABASE_URL`                     | Supabase project URL.                                                       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Browser/server publishable Supabase key.                                    |
| `SUPABASE_SERVICE_ROLE_KEY`                    | Server-only key for privileged workflows and seeding.                       |
| `SUPABASE_DB_URL`                              | Direct Postgres connection used by `npm run db:setup` to apply migrations.  |
| `SUPABASE_RESUME_BUCKET`                       | Resume storage bucket, usually `candidate-resumes`.                         |

Optional for admin convenience:

| Variable           | Purpose                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `DEMO_ADMIN_EMAIL` | Adds an admin email to `public.admin_users` during seed. The Supabase Auth user still needs to exist. |

### Optional For Full Integrations

| Integration                | Variables                                                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gemini                     | `GEMINI_API_KEY`, `GEMINI_MODEL`                                                                                                                                                                |
| Resend                     | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `OFFER_ALERT_EMAIL`                                                                                                                                      |
| Google Calendar            | `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`, `GOOGLE_CALENDAR_INTERVIEWER_NAME`, `GOOGLE_CALENDAR_INTERVIEWER_EMAIL`, `GOOGLE_IMPERSONATED_USER_EMAIL`, `GOOGLE_TIMEZONE` |
| Slack                      | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_WORKSPACE_INVITE_URL`, `SLACK_HR_CHANNEL_ID`, `SLACK_ONBOARDING_CHANNEL_ID`, `SLACK_ONBOARDING_RESOURCE_LINKS`                                |
| Slack admin invite support | `SLACK_ADMIN_TOKEN`, `SLACK_TEAM_ID`, `SLACK_INVITE_CHANNEL_IDS`                                                                                                                                |

## Local Setup Notes

`npm run db:setup` does two things:

1. Applies every SQL migration in `supabase/migrations` in filename order.
2. Runs the demo seed script.

Admin access:

1. Create a Supabase Auth user for the admin email.
2. Set `DEMO_ADMIN_EMAIL=you@example.com` before running `npm run db:setup`, or add the email to `public.admin_users`.
3. Sign in at `/login`, then open `/admin`.

If you only need to refresh demo data after migrations are already applied, run:

```bash
npm run db:seed
```

## Current Flow

```text
applied
  -> screening / shortlisted
  -> enrichment
  -> interview slots offered
  -> interview scheduled
  -> interview completed
  -> offer sent
  -> offer signed
  -> Slack onboarding
```

Architecture details: [docs/architecture-overview.md](docs/architecture-overview.md)

## Features By Phase

| Phase                            | What works                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 01: Public intake          | Careers page, role detail pages, application form, resume upload, duplicate protection, audit logs.                                    |
| Phase 02: Screening + enrichment | Admin dashboard, candidate detail workspace, Gemini screening, shortlist override, profile enrichment, persisted AI artifacts.         |
| Phase 03: Scheduling             | Admin slot offering, DB-backed holds, tokenized candidate scheduling page, Google Calendar integration/fallback, reschedule loop.      |
| Phase 04: Interview              | Simulated transcript, structured interview summary, feedback persistence, Gemini fallback for quota issues.                            |
| Phase 05: Offer + signing        | Hiring-manager offer input, generated offer letter, tokenized signing page, canvas signature, timestamp/IP capture, signed alert.      |
| Phase 06: Slack onboarding       | Offer-signed trigger, Slack onboarding records, invite-link email fallback, Slack lookup, team welcome, candidate DM, HR notification. |

## Demo Data

The seed includes:

- 3 open roles: AI Product Operator, Founding Full-Stack Engineer, Technical Recruiter
- 1 closed role: People Operations Analyst
- 5 demo candidates across applied, shortlisted, scheduled, offer sent, and offer signed states
- Screening results
- Research profiles
- Interviews and calendar holds
- Interview transcripts
- Interview feedback for one candidate
- Sent and signed offer records
- Slack onboarding state
- Audit logs for realistic admin timelines

The seed script is idempotent for its fixed demo records. It clears and recreates those demo candidates/applications before inserting fresh demo data.

## Key Tradeoffs / Assumptions

| Decision                                  | Tradeoff                                                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Supabase owns workflow truth              | External provider failures do not corrupt state, but some integrations require follow-up/retry handling.                             |
| Gemini is bounded to artifact generation  | AI is safer and easier to audit, but the app needs deterministic orchestration around it.                                            |
| Input fingerprint caching                 | Reduces Gemini quota burn during repeated actions, but requires tracking prompt versions and effective inputs.                       |
| DB-backed scheduling holds                | Prevents double booking while candidates decide, but adds state that must be cleaned/released.                                       |
| Canvas signature instead of e-sign vendor | Great for a self-contained demo, but production would likely add PDF artifacting and stronger legal controls.                        |
| Slack invite-link fallback                | Honest when admin invite APIs are unavailable, but candidate join detection needs either admin check or Events API in deployed mode. |
| Simulated interview transcript            | Keeps interview evaluation runnable without a meeting bot, but a real transcript provider would be next for production.              |

More decision notes: [docs/decisions.md](docs/decisions.md)

## Useful Docs

| Document                                                                                 | What it covers                                                              |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [docs/architecture-overview.md](docs/architecture-overview.md)                           | System diagram, state machine, phase-by-phase architecture.                 |
| [docs/ai-usage.md](docs/ai-usage.md)                                                     | Gemini tasks, prompt boundaries, caching, fallback behavior.                |
| [docs/decisions.md](docs/decisions.md)                                                   | Key engineering decisions and tradeoffs.                                    |
| [docs/edge-cases.md](docs/edge-cases.md)                                                 | Edge cases handled across intake, screening, scheduling, offers, and Slack. |
| [docs/token-strategy.md](docs/token-strategy.md)                                         | AI quota/caching strategy and where token burn is avoided.                  |
| [docs/internal-access-notes.md](docs/internal-access-notes.md)                           | Current admin access model and production RBAC migration path.              |
| [docs/phase-03-scheduling-notes.md](docs/phase-03-scheduling-notes.md)                   | Scheduling and Google Calendar details.                                     |
| [docs/phase-04-interview-notetaker-notes.md](docs/phase-04-interview-notetaker-notes.md) | Interview transcript summary design.                                        |
| [docs/phase-05-offer-signing-notes.md](docs/phase-05-offer-signing-notes.md)             | Offer generation and canvas signature flow.                                 |
| [docs/phase-06-slack-onboarding-notes.md](docs/phase-06-slack-onboarding-notes.md)       | Slack onboarding and invite limitations.                                    |

## Known Limitations

- Admin access is intentionally lightweight, not enterprise-grade RBAC.
- Enrichment is lightweight and conservative; it does not use official LinkedIn/GitHub partner APIs.
- Google Calendar uses one configured calendar rather than full per-interviewer OAuth.
- Personal Gmail service-account attendee invites are limited without Google Workspace delegation.
- Slack admin invite APIs depend on workspace plan/scopes; the app records limitations instead of faking success.

## Next Steps

1. Production RBAC with hiring-manager/interviewer roles and row-level security.
2. Offer PDF artifact generation and private signature storage.
3. Per-interviewer calendar OAuth instead of one configured calendar.
4. More robust onboarding checklist after Slack welcome.
