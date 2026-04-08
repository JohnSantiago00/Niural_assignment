# Edge Cases Handled

The project handles edge cases across the hiring pipeline with deterministic validation, database constraints, and provider-failure fallbacks.

## Top Edge Cases

| Edge case | Solution | Why it matters |
| --- | --- | --- |
| Duplicate application | Role/email duplicate protection in app logic and DB constraint. | Prevents repeated applications from creating duplicate candidate records. |
| Closed role submit | Server rechecks role status on submission. | Avoids accepting applications for stale public pages. |
| Resume upload succeeds but DB write fails | Best-effort storage cleanup. | Reduces orphaned private files. |
| Gemini quota exhausted | Deterministic fallback for interview summary, offer letter, and Slack welcome copy. | Keeps QA and demo flow unblocked. |
| Repeated AI action | Input fingerprints reuse existing artifacts. | Prevents unnecessary quota burn. |
| Non-shortlisted enrichment | UI and server both block enrichment. | Keeps expensive enrichment focused on plausible candidates. |
| Overlapping interview holds | DB-backed holds and exclusion constraint. | Prevents double booking even under concurrent actions. |
| Candidate selects one slot | DB function confirms selected hold and releases sibling holds. | Keeps scheduling state atomic. |
| Google attendee invite blocked | Plain event fallback + normalized admin warning. | Preserves scheduled interview truth without exposing raw provider errors to candidates. |
| Offer start date too early | UI min date + server validation. | Prevents invalid offer timing. |
| Offer signed twice | First signature wins; later attempts do not overwrite. | Prevents accidental or malicious duplicate signing. |
| Empty signature submit | Client disables submit and server validates again. | Ensures signature capture is real. |
| Slack invite API unavailable | Invite-link email fallback or readable follow-up state. | Avoids faking Slack admin capability. |
| Slack user already exists | Lookup by email marks joined and skips invite. | Prevents duplicate invites. |
| Slack message repeated | Welcome/HR timestamps make sends idempotent. | Avoids spamming channels/DMs. |

## Application Intake

- Invalid file type or oversized resume is rejected before upload.
- Duplicate application for the same role/email is blocked.
- Closed roles are checked server-side at submit time.
- Confirmation email failure does not roll back a saved application.
- Audit log records application creation.

## Admin and Auth

- Unauthenticated `/admin` access redirects to login.
- Authenticated but unauthorized users are redirected to `/not-authorized`.
- Admin allowlist uses `public.admin_users`.
- QA hard delete removes candidate, application, downstream workflow records, audit logs, and resume storage object.

## Screening and Enrichment

- Malformed AI output is blocked by Zod validation.
- Screening reruns reuse cached artifact when fingerprint matches.
- Admin override is preserved across screening changes.
- Enrichment is only allowed for shortlisted candidates.
- Missing or blocked source URLs are recorded as limitations, not treated as negative evidence.
- Confidence score reflects enrichment quality, not candidate quality.

## Scheduling

- Google Calendar free/busy windows are avoided when configured.
- Active DB holds are treated as busy even before a calendar event exists.
- Expired holds are marked and fresh suggestions can be generated.
- Candidate reschedule notes can be interpreted into structured preferences.
- Replacement suggestions show the current active options before admin approval.
- Email delivery failure does not invalidate holds or confirmed interviews.

## Interview

- Simulated interview completion creates transcript-shaped data for demo.
- Transient Supabase write errors during completion are retried.
- Re-running completion can safely finish partially completed state.
- Interview summary uses deterministic fallback on Gemini quota/high-demand errors.

## Offer and Signing

- Offer generation requires post-interview eligibility.
- Start date must be after the interview date.
- Generated letter is stored but not dumped into the admin UI.
- Candidate signing page is tokenized.
- Server validates agreement checkbox and non-empty signature image.
- Signed timestamp and IP are recorded.
- Signed-offer alert email is best-effort and does not control signing truth.

## Slack Onboarding

- Offer-signed trigger is idempotent.
- Existing onboarding record is reused on retries.
- Slack lookup by email handles already-joined candidates.
- Admin invite path is attempted only when configured.
- Invite-link email fallback is used when `SLACK_WORKSPACE_INVITE_URL` exists.
- Slack Events API verifies request signatures.
- Local development can use the admin `Check Slack and send welcome` action because Slack cannot post events to `localhost`.
