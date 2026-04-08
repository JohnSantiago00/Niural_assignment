# Niural Hiring Workflow Prototype

An end-to-end hiring workflow prototype for the Niural AI Product Operator assignment. It covers the full journey from public job discovery and application intake through admin screening, enrichment, scheduling, interview summary, offer signing, and Slack onboarding.

Workflow truth stays in Supabase. Gemini, Resend, Google Calendar, and Slack are integration layers around deterministic app state rather than the source of truth.

> Built as a take-home assignment for the AI Product Operator role at Niural.

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

Visit:

- [http://localhost:3000/careers](http://localhost:3000/careers) — public careers experience
- [http://localhost:3000/admin](http://localhost:3000/admin) — admin hiring portal

Demo candidates to inspect:

- `Robin Santos` — signed offer + Slack onboarding complete
- `Ted Mosby` — interview summary + offer sent
- `Priya Shah` — scheduled interview
- `Jordan Lee` — shortlisted + enrichment
- `Maya Chen` — newly applied candidate

Commands:

```bash
npm run dev          # start the local app
npm run db:setup     # apply migrations, then seed demo data
npm run db:seed      # reseed demo data only
npm run lint         # eslint
npm run typecheck    # TypeScript check
npm run build        # production build
```

## Tech Stack

| Technology | Why this, not the alternative |
| --- | --- |
| Next.js App Router | Keeps public pages, admin pages, server actions, and API routes in one interview-friendly codebase. |
| TypeScript | Keeps workflow objects, AI outputs, and Supabase records explicit as the pipeline grows. |
| Tailwind CSS | Fast visual iteration with shared design primitives for public, admin, interview, and offer pages. |
| Supabase Postgres | Durable workflow state, migrations, admin allowlist, and candidate lifecycle records. |
| Supabase Storage | Private resume upload storage without adding a separate file service. |
| Supabase Auth | Real admin identity instead of a shared admin password. |
| Gemini via `@google/genai` | Bounded AI generation for screening, enrichment, interview summaries, offer letters, and Slack welcome copy. |
| Resend | Candidate/admin transactional emails with best-effort delivery handling. |
| Google Calendar API | Free/busy lookup and interview event creation when configured. |
| Slack Web API | Real user lookup, onboarding channel/DM messages, and HR notifications when configured. |
| Zod | Validates structured AI output before database writes. |
| `postgres` | Lightweight direct SQL runner for `npm run db:setup` without Supabase CLI. |
| Canvas signature pad | Real drawn-signature experience for the custom offer signing requirement. |

## Architecture

```text
Candidate/Public
  /careers
  /careers/[roleId]
  /apply
  /interview/[selectionToken]
  /offer/[signingToken]

Admin
  /admin
  /admin/candidates/[candidateId]

Next.js App Router
  Server Actions
  API Routes
  Server Components
  Shared UI primitives

Workflow helpers
  lib/applications
  lib/screening
  lib/enrichment
  lib/scheduling
  lib/interview
  lib/offers
  lib/slack

Integrations
  Supabase Postgres + Storage + Auth
  Gemini
  Resend
  Google Calendar
  Slack
```

Pipeline:

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

Full architecture details: [docs/architecture-overview.md](docs/architecture-overview.md)

## Key Decisions

| Decision | What I chose | Why |
| --- | --- | --- |
| Workflow ownership | Supabase records + deterministic server logic | External providers can fail or delay; workflow state should remain explainable and recoverable. |
| AI boundaries | Gemini generates artifacts, app logic owns transitions | Prevents model output from directly changing candidate status, offers, or onboarding state. |
| Screening reuse | `input_fingerprint` + `prompt_version` | Repeated QA clicks reuse existing AI artifacts instead of burning quota. |
| Scheduling | DB-backed holds + Google Calendar free/busy | Google free/busy is not a reservation system; DB holds prevent double booking while candidates decide. |
| Offer signing | In-app canvas signature pad | Satisfies custom e-signature requirement without DocuSign/PandaDoc/HelloSign setup. |
| Slack invite fallback | Resend email with configured Slack invite URL | Slack admin invite APIs are workspace/scopes dependent, so the app does not fake success. |
| Admin access | Supabase Auth + `admin_users` allowlist | More realistic than a shared password while still simple enough for the prototype. |
| Setup | `npm run db:setup` | Reviewer can apply migrations and seed demo data without the Supabase CLI or manual SQL editor steps. |

More decision notes: [docs/decisions.md](docs/decisions.md)

## Local Setup

Minimum required `.env.local` values:

```bash
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=
SUPABASE_RESUME_BUCKET=candidate-resumes
```

`SUPABASE_DB_URL` is the direct Postgres connection string from Supabase Project Settings -> Database. It is used only by `npm run db:setup` to apply SQL migrations automatically. Runtime app code still uses the Supabase URL and keys.

Admin access:

1. Create a Supabase Auth user for your reviewer/admin email.
2. Either add the email manually to `public.admin_users`, or set `DEMO_ADMIN_EMAIL=you@example.com` before running `npm run db:setup`.
3. Sign in at `/login`, then open `/admin`.

## Demo Seed Data

`npm run db:setup` applies all migrations and then runs the demo seed. `npm run db:seed` only reseeds demo records.

The seed includes:

- 3 open roles: AI Product Operator, Founding Full-Stack Engineer, Technical Recruiter
- 1 closed role: People Operations Analyst
- 5 demo candidates across workflow states
- screening results
- research profiles
- interviews and calendar holds
- interview transcripts
- interviewer feedback for one candidate
- sent and signed offer records
- completed Slack onboarding state
- audit logs for realistic admin timelines

The seed script is idempotent for its fixed demo records. It clears and recreates those demo candidates/applications before inserting fresh demo data.

## Environment Variables

| Variable | Required for demo | Purpose |
| --- | --- | --- |
| `APP_BASE_URL` | Yes | Local/public base URL for generated links. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Yes | Browser/server publishable Supabase key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only service role key for privileged workflows and seeding. |
| `SUPABASE_DB_URL` | Yes | Direct Postgres connection for `npm run db:setup`. |
| `SUPABASE_RESUME_BUCKET` | Yes | Private resume storage bucket. |
| `DEMO_ADMIN_EMAIL` | No | Adds a reviewer email to `public.admin_users` during seed. |
| `GEMINI_API_KEY` | No | Live Gemini calls. Fallbacks keep some flows testable if missing/quota-limited. |
| `GEMINI_MODEL` | No | Defaults to `gemini-2.5-flash`. |
| `RESEND_API_KEY` | No | Real email delivery. |
| `RESEND_FROM_EMAIL` | No | Sender address for Resend emails. |
| `OFFER_ALERT_EMAIL` | No | Signed-offer alert recipient override. |
| `GOOGLE_CLIENT_EMAIL` | No | Google service account email. |
| `GOOGLE_PRIVATE_KEY` | No | Google service account private key. |
| `GOOGLE_CALENDAR_ID` | No | Calendar used for free/busy and event creation. |
| `GOOGLE_CALENDAR_INTERVIEWER_NAME` | No | Display name for interview scheduling. |
| `GOOGLE_CALENDAR_INTERVIEWER_EMAIL` | No | Interviewer email fallback. |
| `GOOGLE_IMPERSONATED_USER_EMAIL` | No | Optional Workspace delegated user. |
| `GOOGLE_TIMEZONE` | No | Scheduling timezone. |
| `SLACK_BOT_TOKEN` | No | Slack lookup and messaging. |
| `SLACK_SIGNING_SECRET` | No | Slack Events API signature verification. |
| `SLACK_WORKSPACE_INVITE_URL` | No | Invite-link fallback email when admin invites are unavailable. |
| `SLACK_HR_CHANNEL_ID` | No | HR/internal notification channel. |
| `SLACK_ONBOARDING_CHANNEL_ID` | No | Public team welcome channel. |
| `SLACK_ONBOARDING_RESOURCE_LINKS` | No | Optional links included in welcome copy. |
| `SLACK_ADMIN_TOKEN` | No | Optional admin invite API support. |
| `SLACK_TEAM_ID` | No | Required only with Slack admin invite support. |
| `SLACK_INVITE_CHANNEL_IDS` | No | Required only with Slack admin invite support. |

## Demo Mode Behavior

You can review the product without configuring every external integration.

- Gemini missing/quota-limited: interview summaries, offer letters, and Slack welcome copy use deterministic fallbacks where implemented.
- Resend missing: workflow state remains testable, but real emails are skipped or marked for follow-up.
- Google Calendar missing: seeded demo states still work; live slot generation/event creation needs Google Calendar env.
- Personal Gmail + service-account Google Calendar: attendee invites may be limited without Google Workspace delegation; the app can still store DB scheduling state and create plain fallback events when configured.
- Slack admin invite unavailable: the app does not fake success. Configure `SLACK_WORKSPACE_INVITE_URL` to send an invite-link email, then use Slack lookup/messaging after the candidate joins.
- Interview notetaker provider: Phase 04 uses a simulated transcript path for demo. The storage shape is ready for a real provider later.

## Features By Phase

| Phase | What works |
| --- | --- |
| Phase 01: Public intake | Careers page, role detail pages, application form, resume upload, duplicate protection, audit logs. |
| Phase 02: Screening + enrichment | Admin dashboard, candidate detail workspace, Gemini screening, shortlist override, profile enrichment, persisted AI artifacts. |
| Phase 03: Scheduling | Admin slot offering, DB-backed holds, tokenized candidate scheduling page, Google Calendar integration/fallback, reschedule loop. |
| Phase 04: Interview | Simulated transcript, structured interview summary, feedback persistence, Gemini fallback for quota issues. |
| Phase 05: Offer + signing | Hiring-manager offer input, generated offer letter, tokenized signing page, canvas signature, timestamp/IP capture, signed alert. |
| Phase 06: Slack onboarding | Offer-signed trigger, Slack onboarding records, invite-link email fallback, Slack lookup, team welcome, candidate DM, HR notification. |

## Demo Flows To Test

Quick review:

1. Open `/careers`.
2. Open a role and submit a new application.
3. Sign in and open `/admin`.
4. Click `Ted Mosby` or `Robin Santos` to inspect late-stage demo data.
5. Click `Maya Chen` to run early workflow actions from a fresh applied state.

End-to-end flow:

1. Apply as a fresh candidate.
2. Run screening.
3. Shortlist or override.
4. Offer interview slots.
5. Open the tokenized interview link and confirm a slot.
6. Simulate interview completion.
7. Send offer.
8. Open the tokenized offer link and sign with the canvas signature pad.
9. If Slack is configured, invite the candidate and click `Check Slack and send welcome` after they join.

QA reset:

- Use the candidate detail danger zone to hard-delete a test candidate and related downstream records.
- This deletes the application row too, so the same email can apply again for the same role.

## Documentation

| Document | What it covers |
| --- | --- |
| [docs/architecture-overview.md](docs/architecture-overview.md) | System diagram, state machine, phase-by-phase architecture. |
| [docs/ai-usage.md](docs/ai-usage.md) | Gemini tasks, prompt boundaries, caching, fallback behavior. |
| [docs/decisions.md](docs/decisions.md) | Key engineering decisions and tradeoffs. |
| [docs/edge-cases.md](docs/edge-cases.md) | Edge cases handled across intake, screening, scheduling, offers, and Slack. |
| [docs/token-strategy.md](docs/token-strategy.md) | AI quota/caching strategy and where token burn is avoided. |
| [docs/internal-access-notes.md](docs/internal-access-notes.md) | Current admin access model and production RBAC migration path. |
| [docs/phase-03-scheduling-notes.md](docs/phase-03-scheduling-notes.md) | Scheduling and Google Calendar details. |
| [docs/phase-04-interview-notetaker-notes.md](docs/phase-04-interview-notetaker-notes.md) | Interview transcript summary design. |
| [docs/phase-05-offer-signing-notes.md](docs/phase-05-offer-signing-notes.md) | Offer generation and canvas signature flow. |
| [docs/phase-06-slack-onboarding-notes.md](docs/phase-06-slack-onboarding-notes.md) | Slack onboarding and invite limitations. |

## Known Limitations

- This is a prototype, not enterprise-grade RBAC.
- Enrichment is lightweight and conservative; it does not use official LinkedIn/GitHub partner APIs.
- Google Calendar uses one configured calendar rather than full per-interviewer OAuth.
- Personal Gmail service-account attendee invites are limited without Google Workspace delegation.
- Offer signatures are stored as PNG data URLs on the offer row for MVP simplicity.
- Slack admin invite APIs depend on workspace plan/scopes; the app records limitations instead of faking success.


## What I Would Build Next

1. Production RBAC with hiring-manager/interviewer roles and row-level security.
2. Offer PDF artifact generation and private signature storage.
4. Per-interviewer calendar OAuth instead of one configured calendar.
5. More robust onboarding checklist after Slack welcome.
