# Edge Cases

## Application intake

- Duplicate application for the same role and email
  - blocked in app logic and reinforced by a DB uniqueness constraint

- Role closed after the page loaded but before submit
  - checked again at submission time on the server

- Invalid file type or oversized resume
  - rejected before upload and before record creation

- Resume upload succeeds but later DB write fails
  - workflow attempts cleanup instead of leaving orphaned files

- Confirmation email fails
  - application remains saved; email is best-effort only

## Admin / auth

- Unauthenticated access to admin routes
  - redirected to login

- Authenticated but unauthorized user
  - denied admin access cleanly

## Screening

- Unreadable or malformed resume
  - screening run fails cleanly without partial result persistence

- Malformed Gemini output
  - Zod validation blocks writes

- Admin override exists before screening rerun
  - human-chosen status is preserved even when the score is updated

## Enrichment

- Candidate is not shortlisted
  - enrichment action is gated in UI and blocked again on the server

- Missing LinkedIn / GitHub / portfolio URL
  - enrichment continues and records the missing-source limitation

- Blocked or unreadable profile source
  - enrichment continues; the source is treated as unavailable rather than evidence

- Missing online information
  - does not automatically become a discrepancy flag
