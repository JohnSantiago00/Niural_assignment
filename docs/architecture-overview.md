# Architecture Overview

System model, workflow breakdown, integration boundaries, and implementation notes for the Niural hiring workflow.

## System Diagram

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
  Server Components
  Server Actions
  API Routes
  Middleware/proxy auth protection

Workflow modules
  lib/applications
  lib/screening
  lib/enrichment
  lib/scheduling
  lib/interview
  lib/offers
  lib/slack

Integration modules
  lib/supabase
  lib/gemini
  lib/email
  lib/scheduling/google-calendar.ts
  lib/slack

Data and artifacts
  Supabase Postgres
  Supabase Storage
```

## Application State Machine

```text
applied
  |
  | admin runs screening or override
  v
screened / shortlisted
  |
  | enrichment allowed only after shortlist
  v
enriched
  |
  | admin offers interview slots
  v
interview_pending / options_sent
  |
  | candidate selects tokenized slot
  v
interview_scheduled
  |
  | admin simulates interview completion
  v
interview_completed
  |
  | admin sends offer
  v
offer_sent
  |
  | candidate signs tokenized offer
  v
offer_signed
  |
  | Slack onboarding starts
  v
onboarding_started / completed
```

The database stores more detailed side-table state than the top-level candidate status. For example, `interviews.interview_status`, `offers.offer_status`, and `slack_onboarding.onboarding_status` provide the detailed workflow truth for each phase.

## Phase-by-Phase Breakdown

### Phase 01: Public Application Intake

Files:

- `app/(public)/careers/page.tsx`
- `app/(public)/careers/[roleId]/page.tsx`
- `app/(public)/apply/page.tsx`
- `components/application-form.tsx`
- `app/api/applications/route.ts`

What happens:

1. Public roles are loaded from Supabase.
2. Candidate submits application + resume.
3. Server validates role status, file type, and file size.
4. Resume uploads to private Supabase Storage.
5. `applications`, `candidates`, and `audit_logs` rows are created.
6. Resend confirmation email is attempted if configured.

Key decision: the browser never writes directly to Supabase Storage for resumes. The API route owns validation and upload so private storage remains simple.

### Phase 02: Screening and Enrichment

Files:

- `lib/screening/run-screening.ts`
- `lib/enrichment/run-enrichment.ts`
- `lib/gemini/generate-structured.ts`
- `app/admin/candidates/[candidateId]/page.tsx`

What happens:

1. Admin runs screening.
2. Gemini receives resume text + role context.
3. Zod validates structured output.
4. `screening_results` stores score, rationale, strengths, gaps, extracted skills, and model metadata.
5. Candidate status is updated deterministically.
6. Admin can override the shortlist decision.
7. Enrichment is allowed only for shortlisted candidates.
8. Enrichment uses submitted LinkedIn/GitHub/portfolio URLs conservatively and stores `research_profiles`.

Key decision: AI writes artifacts, not workflow truth. Admin override and server logic decide candidate state.

### Phase 03: Scheduling

Files:

- `lib/scheduling/workflow.ts`
- `lib/scheduling/availability.ts`
- `lib/scheduling/google-calendar.ts`
- `app/interview/[selectionToken]/page.tsx`
- `lib/scheduling/actions.ts`

What happens:

1. Admin offers interview slots.
2. App checks Google Calendar free/busy if configured.
3. App also checks active `calendar_holds`.
4. Candidate receives tokenized scheduling link through Resend if configured.
5. Candidate selects a slot.
6. A DB function confirms the selected hold and releases sibling holds.
7. App attempts Google Calendar event creation.
8. If attendee delivery is blocked by service-account limitations, app can create a plain fallback event and keeps DB scheduling state valid.

Key decision: `calendar_holds` is necessary because Google free/busy does not reserve tentative options while a candidate is deciding.

### Phase 04: Interview Summary and Feedback

Files:

- `lib/interview/actions.ts`
- `lib/interview/simulate-interview.ts`
- `lib/gemini/summarize-interview.ts`

What happens:

1. Admin clicks simulated interview completion.
2. App creates transcript-shaped content from candidate, role, screening, and enrichment context.
3. Gemini summarizes it into a structured interview artifact.
4. If Gemini is quota-limited, deterministic fallback summary is stored.
5. `interview_transcripts` stores transcript, summary, strengths, concerns, topics, and follow-up.
6. Interview and candidate status move to completed.

Key decision: transcript ingestion is simulated, but the storage shape can support a real meeting provider later.

### Phase 05: Offer Letter and E-Signature

Files:

- `lib/offers/workflow.ts`
- `lib/offers/actions.ts`
- `lib/gemini/generate-offer-letter.ts`
- `app/offer/[signingToken]/page.tsx`
- `components/signature-pad.tsx`

What happens:

1. Admin enters offer inputs and clicks `Send offer`.
2. Server validates required fields and start-date eligibility.
3. Gemini drafts a professional offer letter, or deterministic fallback prose is used if Gemini is unavailable.
4. Offer is stored in `offers`.
5. Candidate receives tokenized signing link through Resend if configured.
6. Candidate reviews the offer and signs with a canvas signature pad.
7. Server validates token, agreement, and non-empty signature.
8. First signature wins; signed timestamp, IP, and signature image are stored.
9. Signed-offer alert email is sent if configured.

Key decision: the custom signing UI stores a PNG data URL directly on the offer row. A production version would store immutable signing artifacts in private storage.

### Phase 06: Slack Onboarding

Files:

- `lib/slack/workflow.ts`
- `lib/slack/client.ts`
- `lib/email/send-slack-invite-email.ts`
- `app/api/slack/events/route.ts`

What happens:

1. Offer signature creates or reuses a `slack_onboarding` row.
2. App checks Slack by email using `users.lookupByEmail`.
3. If the candidate already exists, join state is marked immediately.
4. If admin invite API credentials exist, app can attempt Slack admin invite.
5. If admin invite is unavailable but `SLACK_WORKSPACE_INVITE_URL` exists, app sends a Resend invite-link email.
6. After candidate joins, admin can click `Check Slack and send welcome` when Slack events are not configured.
7. App sends public team welcome in `SLACK_ONBOARDING_CHANNEL_ID`.
8. App opens a DM with the candidate and sends a personal welcome.
9. App sends HR notification if `SLACK_HR_CHANNEL_ID` is configured.

Key decision: Slack admin invite APIs are workspace/scopes dependent. The app records limitations honestly rather than faking success.

## Database Tables

| Table | Purpose |
| --- | --- |
| `roles` | Public job listings and role requirements. |
| `applications` | Candidate application submissions. |
| `candidates` | Current candidate workflow state. |
| `audit_logs` | Admin/candidate/system event history. |
| `admin_users` | Admin authorization allowlist. |
| `screening_results` | Gemini screening artifact and extracted resume details. |
| `research_profiles` | Enrichment summaries and source confidence. |
| `interviews` | Scheduling/interview state per candidate. |
| `calendar_holds` | Tentative/confirmed slot reservations. |
| `interview_transcripts` | Transcript-shaped record and structured interview summary. |
| `interview_feedback` | Latest interview feedback record. |
| `offers` | Offer inputs, generated letter, signing token, signature artifact. |
| `slack_onboarding` | Slack invite/join/welcome/HR notification state. |
| `local_schema_migrations` | Local setup script migration tracking. |

## Auth and Access

Admin access uses:

- Supabase Auth for sign-in
- `admin_users` allowlist for authorization
- middleware/proxy protection for `/admin`
- service-role client only on the server

Candidate scheduling and offer signing pages are public but tokenized. Tokens are high-entropy random strings stored on the corresponding hold/offer records.

## Integration Failure Philosophy

External services are useful but not authoritative:

- Resend failure does not delete an application, hold, or offer.
- Google Calendar failure does not erase a confirmed DB interview.
- Slack invite limitations are stored as onboarding follow-up state.
- Gemini quota failure uses deterministic fallback where implemented.

This keeps the workflow resilient under real-world provider constraints.
