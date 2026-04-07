# Niural Hiring Workflow Prototype

An end-to-end internal hiring workflow prototype built for an AI Product Operator take-home assignment.

The app currently covers:

- Phase 01: public careers and application intake
- Phase 02A: protected admin dashboard and candidate lifecycle review
- Phase 02B: AI resume screening against the applied role
- Phase 02C: shortlist-only candidate research and profile enrichment
- Phase 03: deterministic interview scheduling with DB-backed slot holds, Google Calendar free/busy, confirmed event creation, and an admin-approved reschedule loop
- Phase 04: simulated interview completion, AI transcript summary, and interviewer feedback
- Phase 05: AI-generated offer letters with custom in-app canvas signature capture

The product is intentionally designed to be:

- practical
- deterministic where workflow state matters
- easy to demo
- easy to explain in an interview

## Current Status

Implemented today:

- public careers page and role detail pages
- application form with resume upload to private Supabase Storage
- applications, candidates, and audit logs
- protected admin dashboard with filters and candidate detail page
- manual AI screening with persisted `screening_results`
- manual profile enrichment for shortlisted candidates with persisted `research_profiles`
- interview slot offering with DB-backed holds, Google Calendar-backed availability, and a public tokenized selection page
- simulated interview-complete flow with persisted transcript summary and interviewer feedback
- offer generation, candidate signing links, canvas signature capture, and signed-offer alert emails
- admin override support for shortlist decisions
- admin-only QA hard delete for fully resetting test candidates and their application records
- Supabase Auth login plus `admin_users` allowlist

Not implemented yet:

- transcripts / interview notes
- Slack onboarding
- heavy scraping or official third-party social integrations

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Postgres + Storage + Auth
- Google Gemini Developer API via `@google/genai`
- Zod for validation
- Resend for scheduling-link and confirmation emails

## Why This Stack

- Next.js App Router keeps UI, server actions, and API routes in one interview-friendly codebase.
- Supabase gives a simple hosted Postgres + storage + auth foundation without adding Prisma or extra infrastructure.
- Gemini is used for structured screening and enrichment output, while app logic still owns workflow state.
- Zod keeps AI output validation and user input validation explicit before any database writes happen.

## AI Usage

AI is used in two separate layers:

1. Screening
   - resume text + role JD in
   - structured fit score, rationale, strengths, gaps, and resume extraction out

2. Enrichment
   - shortlisted candidates only
   - submitted profile links + screening context in
   - source summaries, conservative discrepancy flags, confidence score, and candidate brief out

AI is not used to:

- decide who can access admin routes
- decide eligibility for enrichment
- directly mutate workflow state
- browse arbitrary external data without app-provided source content

## Real vs Mocked

Real:

- Supabase database and storage
- Supabase Auth login for admin access
- resume upload and persistence
- screening and enrichment model calls
- server-side source fetching for submitted profile URLs
- Google Calendar free/busy lookup for scheduling
- Google Calendar event creation for confirmed interviews
- Resend scheduling-link delivery plus human-readable confirmation emails
- simulated transcript generation plus Gemini interview summarization
- AI offer-letter drafting from hiring-manager inputs and candidate context
- custom in-app offer signing with drawn signature, timestamp, and IP capture

MVP / intentionally limited:

- LinkedIn / GitHub / portfolio retrieval is lightweight HTML fetching, not official integrations
- LinkedIn may block direct automated access; when that happens, the app records the limitation clearly and preserves the submitted URL for manual review
- X/Twitter is modeled as optional future work
- enrichment is manual, not queued
- scheduling uses one configured Google Calendar instead of a full multi-user calendar linking flow
- hard delete is present only as an admin QA reset utility, not as a normal end-user product feature
- Phase 04 uses a simulated transcript path for demo; the storage shape is ready for a real notetaker provider later
- Phase 05 stores signature PNG data directly on the offer row for MVP simplicity instead of using a document-signing vendor or separate storage artifact
- PDF parsing uses a pragmatic Node-friendly parser and may be imperfect on layout-heavy files

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_CALENDAR_ID=
GOOGLE_CALENDAR_INTERVIEWER_NAME=Hiring Team
GOOGLE_CALENDAR_INTERVIEWER_EMAIL=
GOOGLE_IMPERSONATED_USER_EMAIL=
GOOGLE_TIMEZONE=America/New_York
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_RESUME_BUCKET=candidate-resumes
RESEND_API_KEY=
RESEND_FROM_EMAIL=Hiring Team <hiring@example.com>
OFFER_ALERT_EMAIL=
```

Notes:

- `GEMINI_API_KEY` is used only on the server for screening, enrichment, interview summaries, and offer-letter drafting.
- `GEMINI_MODEL` keeps the MVP on one model unless you deliberately change it.
- `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` authenticate the server to Google Calendar.
- `GOOGLE_CALENDAR_ID` points at the calendar used for free/busy checks and confirmed interview event creation.
- `GOOGLE_IMPERSONATED_USER_EMAIL` is optional for domain-wide delegation setups.
- `GOOGLE_CALENDAR_INTERVIEWER_NAME`, `GOOGLE_CALENDAR_INTERVIEWER_EMAIL`, and `GOOGLE_TIMEZONE` shape the interviewer/event metadata shown in the app.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and powers protected writes plus private storage access.
- Resend is optional for candidate communication paths and the Phase 05 signed-offer alert.
- `OFFER_ALERT_EMAIL` optionally routes signed-offer alerts to a hiring team inbox; otherwise the app falls back to interviewer/from email settings.

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Apply the Supabase migrations in order

- [0001_phase_a_schema.sql](/Users/nick/Desktop/Niural_assignment/supabase/migrations/0001_phase_a_schema.sql)
- [0002_seed_roles.sql](/Users/nick/Desktop/Niural_assignment/supabase/migrations/0002_seed_roles.sql)
- [0003_admin_users.sql](/Users/nick/Desktop/Niural_assignment/supabase/migrations/0003_admin_users.sql)
- [0004_screening_results.sql](/Users/nick/Desktop/Niural_assignment/supabase/migrations/0004_screening_results.sql)
- [0005_screening_results_structured_fields.sql](/Users/nick/Desktop/Niural_assignment/supabase/migrations/0005_screening_results_structured_fields.sql)
- [0006_research_profiles.sql](/Users/nick/Desktop/Niural_assignment/supabase/migrations/0006_research_profiles.sql)
- [0007_research_profiles_quality.sql](/Users/nick/Desktop/Niural_assignment/supabase/migrations/0007_research_profiles_quality.sql)
- [0008_research_profiles_linkedin_source_metadata.sql](/Users/nick/Desktop/Niural_assignment/supabase/migrations/0008_research_profiles_linkedin_source_metadata.sql)
- [0009_phase_03_scheduling.sql](/Users/nick/Desktop/Niural_assignment/supabase/migrations/0009_phase_03_scheduling.sql)
- [0010_phase_03_reschedule_hardening.sql](/Users/nick/Desktop/Niural_assignment/supabase/migrations/0010_phase_03_reschedule_hardening.sql)
- [0011_phase_04_interview_notetaker.sql](/Users/nick/Desktop/Niural_assignment/supabase/migrations/0011_phase_04_interview_notetaker.sql)
- [0012_phase_05_offers.sql](/Users/nick/Desktop/Niural_assignment/supabase/migrations/0012_phase_05_offers.sql)

3. Create at least one Supabase Auth user and add that email to `public.admin_users`

4. Share the configured Google Calendar with the service account or configure domain-wide delegation if you use impersonation

5. Start the app

```bash
npm run dev
```

6. Open [http://localhost:3000/careers](http://localhost:3000/careers)

## Current Flow

Candidate side:

1. browse careers
2. open a role
3. apply with resume upload
4. application, candidate, and audit records are created
5. optional confirmation email is attempted

Admin side:

1. sign in through Supabase Auth
2. review candidates in `/admin`
3. open candidate detail page
4. run AI screening
5. shortlist or override if needed
6. run profile enrichment only for shortlisted candidates
7. offer interview slots from real Google Calendar availability and review hold / scheduling state
8. handle candidate reschedule requests through an admin approval loop with AI-extracted preference hints
9. simulate interview completion after a scheduled interview and review the AI interview summary
10. save interviewer feedback after the interview is completed
11. generate an offer letter from short hiring-manager inputs
12. send the candidate a tokenized signing link
13. review signed-offer state after the candidate draws a signature in the portal
14. review brief, discrepancy flags, and source summaries
15. if testing needs a clean reset, use the candidate detail page danger zone to hard delete the test candidate and application

## Key Tradeoffs / Assumptions

- Manual triggers are used for screening and enrichment so the workflow is easy to demo and reason about.
- Workflow state stays deterministic in app logic even when Gemini is generating structured output.
- Enrichment is intentionally lightweight and conservative. Missing or blocked sources are treated as limitations, not evidence.
- The system stores screening and enrichment separately so those layers can evolve independently.
- Scheduling still relies on DB-backed holds even with Google Calendar because free/busy alone does not reserve tentative options during candidate selection.
- Google Calendar and Resend are best-effort external side effects layered on top of DB truth; failed invite/email delivery does not roll back a valid in-app scheduling state.
- Phase 04 uses a simulated interview transcript so the notetaker flow can be demoed without a live meeting bot.
- Phase 05 uses a custom canvas signature pad instead of DocuSign/PandaDoc so the prototype visibly captures signature, timestamp, and IP without external signing setup.
- The admin-only hard delete removes the application row as well as candidate-linked artifacts because duplicate protection is enforced on `applications(role_id, email)`.
- The admin tool is protected, but this is still a prototype and not a production-grade enterprise auth system.

## Useful Docs

- [Architecture Overview](/Users/nick/Desktop/Niural_assignment/docs/architecture-overview.md)
- [AI Usage](/Users/nick/Desktop/Niural_assignment/docs/ai-usage.md)
- [Edge Cases](/Users/nick/Desktop/Niural_assignment/docs/edge-cases.md)
- [Phase B Notes](/Users/nick/Desktop/Niural_assignment/docs/phase-b-notes.md)
- [Phase C Screening Notes](/Users/nick/Desktop/Niural_assignment/docs/phase-c-screening-notes.md)
- [Phase C Enrichment Notes](/Users/nick/Desktop/Niural_assignment/docs/phase-c-enrichment-notes.md)
- [Phase 03 Scheduling Notes](/Users/nick/Desktop/Niural_assignment/docs/phase-03-scheduling-notes.md)
- [Phase 04 Interview Notetaker Notes](/Users/nick/Desktop/Niural_assignment/docs/phase-04-interview-notetaker-notes.md)
- [Phase 05 Offer Signing Notes](/Users/nick/Desktop/Niural_assignment/docs/phase-05-offer-signing-notes.md)

## Next Steps

The next major phase would add onboarding handoff features such as Slack onboarding.
