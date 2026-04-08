# Phase A QA Notes

## Key behaviors

- Public careers page shows open roles from Supabase.
- Public role detail page loads a single role by UUID and returns `notFound()` for invalid or missing roles.
- Apply page supports two entry paths:
  - direct `/apply` with manual role selection
  - `/apply?roleId=...` with a preselected, locked role
- Submission flow validates input, uploads the resume, creates the application, creates the candidate, writes an audit log, and attempts a confirmation email.
- Confirmation email is best-effort and does not roll back saved application data.

## Edge cases checked

- Invalid `roleId` on `/careers/[roleId]` returns not found instead of causing a Supabase UUID parsing error.
- Invalid `roleId` on `/apply?roleId=...` falls back to normal role selection with a clean warning.
- Closed roles are rejected at submit time even if the form was loaded while the role was still open.
- Duplicate applications for the same `(role_id, email)` are rejected with a friendly error.
- Resume validation rejects unsupported file types and files larger than 5 MB.
- Empty optional URL fields are treated as omitted rather than invalid.
- Resume uploads are cleaned up if a later submission step fails.
- File input is visually reset after successful submission so the form does not look stale.

## Important tradeoffs

- Submission orchestration stays in application code instead of moving into a database function. This keeps the behavior visible and interview-friendly.
- Rollback is best-effort rather than full transactional storage + DB coordination, because Supabase Storage uploads sit outside Postgres transactions.
- Email sending is intentionally non-blocking for persistence. Candidate data matters more than delivery of the confirmation email.
- Public role reads use the publishable key, while writes/uploads use the server-side service role key.

## Known limitations

- Email content is plain text and intentionally minimal for Phase A.
- Audit log insertion is best-effort; failures are logged rather than surfaced to the candidate.
- Duplicate protection is scoped to role + email, not to broader identity matching.

## How later phases now build on this

- Admin review UI reads the application/candidate records.
- AI screening and enrichment attach evidence to the same candidate.
- Scheduling, interviews, offer signing, and Slack onboarding advance the candidate from the original application record.
- The hard-delete QA utility removes the application row too, so a reviewer can reapply with the same email and role.

## How to explain this in an interview

Describe Phase A as a narrow, deterministic intake pipeline:

1. The candidate browses roles from a public careers page.
2. The candidate opens a role detail page and can start an application from there.
3. The application form performs fast client-side validation, but the server remains the source of truth.
4. One API route owns the intake workflow: validate, re-check role state, prevent duplicates, upload the resume, create records, write an audit log, and attempt email.
5. The architecture is intentionally simple so the behavior is easy to reason about and easy to extend in later phases.
