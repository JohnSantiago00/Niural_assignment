# Phase A Architecture Notes

## What this phase solves

Phase A is intentionally narrow. It creates a reliable public application intake flow that is easy to demo, easy to maintain, and easy to explain in an interview.

The system currently does four things well:

1. It exposes live roles from Supabase on a public careers page.
2. It lets a candidate submit an application with a resume.
3. It creates both an application record and a candidate record.
4. It sends a confirmation email without making email delivery a hard dependency for data persistence.

## Why the architecture is simple

This implementation avoids extra frameworks and keeps most logic in a single server-side workflow. That was a deliberate choice.

- Next.js App Router handles the UI and the API route in one deployable app.
- Supabase provides Postgres plus Storage without adding ORM or infrastructure overhead.
- Resend is used only for transactional email.
- Validation is handled with Zod on both client and server so the rules stay consistent.

This keeps the system deterministic. A submission goes through one endpoint, one validation layer, one storage integration, and one database write sequence.

## Separation of concerns

- `app/(public)` contains user-facing pages.
- `components/` contains reusable UI pieces.
- `lib/utils/validation.ts` owns input validation.
- `lib/supabase/` owns database and storage access.
- `lib/email/` owns email delivery.
- `lib/applications/submit-application.ts` orchestrates the submission workflow.
- `types/` holds shared TypeScript types.

This split is intentionally small. There are enough boundaries to keep responsibilities clear, but not so many that the code becomes abstract or hard to trace.

## Key design choices

### 1. Server-side orchestration instead of multiple client calls

The client submits one multipart form request to `POST /api/applications`.

That endpoint is responsible for:

- checking the role status again at submit time
- checking duplicate applications
- uploading the resume
- inserting application and candidate records
- writing an audit log
- sending the confirmation email

This prevents the client from coordinating multiple fragile steps and makes the flow much easier to reason about.

### 2. Service role key only on the server

The service role key is used for private resume uploads and backend inserts. It never needs to be exposed to the browser.

This keeps private resume storage simple in Phase A and is easy to justify: the browser only talks to our API, and the API talks to Supabase.

### 3. Duplicate protection in two places

Duplicate applications are prevented by:

- a pre-insert lookup in the API flow for a friendly error message
- a database unique constraint on `(role_id, email)` for final protection

This combination handles both user experience and race-condition safety.

### 4. Email failures do not roll back saved applications

The application data matters more than the confirmation email. Because of that, email is sent after the main records are written.

If Resend fails, the API still returns success for the saved application and includes the email delivery status. That matches the product requirement and makes the system more resilient.

### 5. Audit logging starts early

`audit_logs` is included now even though Phase A is simple. That gives a lightweight history trail and sets up future admin workflows without adding much complexity.

## Tradeoffs

- The application and candidate inserts are coordinated in server code rather than a Postgres transaction function. That keeps the logic visible and interview-friendly, but it does mean we perform best-effort cleanup if a later step fails.
- Resume storage is private and server-managed, which is secure and simple, but it requires backend upload orchestration instead of direct browser uploads.
- Email delivery is best-effort; application persistence is more important than a confirmation email side effect.

## How later phases extend it

The current application-intake records now feed:

- admin review
- AI screening
- enrichment
- interview scheduling
- interview summaries
- offer generation and signing
- Slack onboarding

That is the reason the first phase creates `applications`, `candidates`, and
`audit_logs` rather than only sending an email or storing a flat form payload.
