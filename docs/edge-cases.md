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

- Test candidate needs a full reset
  - admin-only hard delete removes candidate, application, downstream artifacts, audit logs, and resume storage object

## Screening

- Unreadable or malformed resume
  - screening run fails cleanly without partial result persistence

- Malformed model output
  - Zod validation blocks writes

- Overlong model arrays
  - safe list fields are normalized before final validation where appropriate

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

## Scheduling

- Google Calendar busy window exists
  - slot generation avoids it through free/busy lookup

- Another candidate already has an active hold
  - slot generation avoids active DB holds and the exclusion constraint rejects overlapping active holds/confirmed slots

- Candidate chooses one held slot
  - selected hold is confirmed and sibling holds are released atomically by the DB function

- Holds expire
  - expired holds are marked and a fresh set can be generated

- Google Calendar attendee invite fails in service-account setup
  - app can fall back to plain event creation and keeps the DB-confirmed interview state

- Resend scheduling email fails
  - holds remain valid and admin can still access the scheduling state

## Interview notes and feedback

- No live meeting transcript provider is configured
  - admin can use the simulated completion path to create a transcript-shaped record for demo

- Feedback submitted before interview completion
  - server rejects it

- Feedback submitted more than once
  - latest feedback record is updated for that interview

## Offer and signing

- Offer start date is before or on interview completion date
  - UI and server validation reject it with “Start date must be after the interview date”

- Offer email delivery is delayed or fails
  - offer state remains stored and delivery status is surfaced to admin

- Signing link is invalid
  - tokenized page returns a clean not-found state

- Candidate submits without a drawn signature or agreement checkbox
  - client disables the button and server validates again

- Candidate signs twice
  - first signature wins; later attempts do not overwrite the signed offer

- IP capture is unavailable
  - signing still succeeds with a null IP rather than losing the signed offer

## Slack onboarding

- Offer signing is submitted twice
  - Slack onboarding is not duplicated; the existing candidate-linked record is reused

- Slack invite admin API is unavailable
  - invite status is marked skipped or failed with a readable limitation instead of fake success

- Candidate already exists in Slack
  - lookup by email marks the candidate as joined and skips repeated invites

- Slack join event arrives more than once
  - welcome and HR messages are not resent after delivery timestamps exist

- Slack message delivery fails
  - onboarding state remains visible in admin and the failed message path is stored for follow-up

- Slack Events request has an invalid signature
  - the API route rejects it before touching onboarding state
