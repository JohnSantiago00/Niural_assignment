# Architecture Overview

## High-level system

The app is a single Next.js App Router codebase with:

- public candidate-facing pages
- internal admin pages
- server-first workflows for screening and enrichment
- Supabase as the main backend system of record

Core layers:

- UI: `app/` and `components/`
- workflow logic: `lib/applications`, `lib/screening`, `lib/enrichment`
- integrations: `lib/supabase`, `lib/gemini`, `lib/email`
- shared types and validation: `types/`, `lib/utils`, Zod schemas

## Candidate flow

1. Candidate browses roles on `/careers`
2. Candidate opens role detail and applies
3. Resume is uploaded to private Supabase Storage
4. Application, candidate, and audit log records are created
5. Confirmation email is attempted

## Screening flow

1. Admin opens candidate detail page
2. Admin manually triggers AI screening
3. Server downloads the resume
4. Resume text is extracted from PDF or DOCX
5. Gemini receives:
   - resume text
   - role details / JD
6. Gemini returns structured screening output
7. Zod validates the output
8. App stores `screening_results`
9. App updates `candidates.ai_score`
10. App updates `current_status` deterministically to `screened` or `shortlisted` unless admin override is active

## Enrichment flow

1. Candidate must already be shortlisted
2. Admin manually triggers profile enrichment
3. Server fetches candidate-submitted links where available
4. Gemini receives:
   - screening context
   - role context
   - fetched source content
5. Gemini returns structured enrichment output
6. Zod validates the output
7. App stores `research_profiles`
8. Candidate detail page renders:
   - candidate brief
   - confidence score
   - source summaries
   - conservative discrepancy flags

## Where deterministic logic controls workflow

Deterministic application logic controls:

- duplicate application protection
- role-open checks
- resume validation
- shortlist threshold behavior
- admin override behavior
- enrichment eligibility
- admin route protection

Gemini generates structured analysis, but it does not directly control workflow state.

## Where Gemini is used

Gemini is used only in server-side helpers under `lib/gemini/`.

Current AI tasks:

- resume screening
- shortlist-only profile enrichment

Gemini output is always parsed and validated before the app writes to the database.

## Auth / admin access

Admin access uses:

- Supabase Auth for identity
- `public.admin_users` as an allowlist for authorization
- protected admin routes via middleware / proxy

This keeps the prototype realistic without introducing a full RBAC framework.

## What comes next

Later phases can add:

- scheduling
- interview artifacts
- offers / signing
- onboarding handoff

Those phases can sit on top of the existing candidate lifecycle, screening results, and research profile layers.
