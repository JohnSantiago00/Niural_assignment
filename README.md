# Niural Hiring Workflow Prototype

An end-to-end internal hiring workflow prototype built for an AI Product Operator take-home assignment.

The app currently covers:

- Phase 01: public careers and application intake
- Phase 02A: protected admin dashboard and candidate lifecycle review
- Phase 02B: AI resume screening against the applied role
- Phase 02C: shortlist-only candidate research and profile enrichment

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
- admin override support for shortlist decisions
- Supabase Auth login plus `admin_users` allowlist

Not implemented yet:

- scheduling
- transcripts / interview notes
- offers / e-signature
- Slack onboarding
- heavy scraping or official third-party social integrations

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase Postgres + Storage + Auth
- Google Gemini Developer API via `@google/genai`
- Zod for validation
- Resend for confirmation email

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

MVP / intentionally limited:

- LinkedIn / GitHub / portfolio retrieval is lightweight HTML fetching, not official integrations
- LinkedIn may block direct automated access; when that happens, the app records the limitation clearly and preserves the submitted URL for manual review
- X/Twitter is modeled as optional future work
- enrichment is manual, not queued
- PDF parsing uses a pragmatic Node-friendly parser and may be imperfect on layout-heavy files

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_RESUME_BUCKET=candidate-resumes
RESEND_API_KEY=
RESEND_FROM_EMAIL=Hiring Team <hiring@example.com>
```

Notes:

- `GEMINI_API_KEY` is used only on the server for screening and enrichment.
- `GEMINI_MODEL` keeps the MVP on one model unless you deliberately change it.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and powers protected writes plus private storage access.
- Resend is optional for the candidate confirmation email path.

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

3. Create at least one Supabase Auth user and add that email to `public.admin_users`

4. Start the app

```bash
npm run dev
```

5. Open [http://localhost:3000/careers](http://localhost:3000/careers)

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
7. review brief, discrepancy flags, and source summaries

## Key Tradeoffs / Assumptions

- Manual triggers are used for screening and enrichment so the workflow is easy to demo and reason about.
- Workflow state stays deterministic in app logic even when Gemini is generating structured output.
- Enrichment is intentionally lightweight and conservative. Missing or blocked sources are treated as limitations, not evidence.
- The system stores screening and enrichment separately so those layers can evolve independently.
- The admin tool is protected, but this is still a prototype and not a production-grade enterprise auth system.

## Useful Docs

- [Architecture Overview](/Users/nick/Desktop/Niural_assignment/docs/architecture-overview.md)
- [AI Usage](/Users/nick/Desktop/Niural_assignment/docs/ai-usage.md)
- [Edge Cases](/Users/nick/Desktop/Niural_assignment/docs/edge-cases.md)
- [Phase B Notes](/Users/nick/Desktop/Niural_assignment/docs/phase-b-notes.md)
- [Phase C Screening Notes](/Users/nick/Desktop/Niural_assignment/docs/phase-c-screening-notes.md)
- [Phase C Enrichment Notes](/Users/nick/Desktop/Niural_assignment/docs/phase-c-enrichment-notes.md)

## Next Steps

The next major phase would add later-stage hiring workflow features such as:

- scheduling
- interview support
- transcripts / notes
- offers / signing
- onboarding handoff
