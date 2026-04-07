# Phase 03 Scheduling Notes

## Why scheduling was implemented this way

The MVP focuses on deterministic slot management with a real Google Calendar
upgrade layered underneath it.

Google Calendar now provides:

- real free/busy availability
- real confirmed event creation
- attendee invite delivery after confirmation

The application still keeps its own hold model because Google Calendar alone
does not solve tentative reservation while a candidate is choosing between
offered slots.

## How hold logic prevents slot conflicts

Scheduling revolves around two tables:

- `interviews` stores the candidate's current interview state
- `calendar_holds` stores reserved slot options

Conflict prevention is database-backed:

- offered slots are inserted as `held`
- confirmed selections stay `confirmed`
- a Postgres exclusion constraint prevents overlapping active holds for the same interviewer
- expired or released holds drop out of the active conflict set

This means the app does not rely only on UI checks or Google free/busy alone to
avoid collisions.

## How Google Calendar is used

Google Calendar is used in two specific places:

1. free/busy lookup when generating interview options
2. event creation after a candidate confirms one held slot

This keeps the responsibilities clear:

- Google Calendar says when the configured interviewer calendar is busy
- the app decides which open times to offer
- the app reserves those options in `calendar_holds`
- after selection, the app creates the real calendar event

If Google event creation fails, the app preserves the confirmed hold and
scheduled interview state, then stores a normalized warning for follow-up. This
keeps the DB-backed interview lifecycle authoritative even when an external
calendar side effect fails.

For personal Gmail/shared-calendar prototypes, Google can reject attendee
invites from a service account with `Service accounts cannot invite attendees
without Domain-Wide Delegation of Authority.` The app handles that by creating
the calendar event without attendees when possible, storing a warning, and
using Resend/manual follow-up for candidate communication. A production version
would use Google Workspace domain-wide delegation or interviewer OAuth.

## Candidate communication flow

The candidate-facing communication layer now has two email moments:

1. offer email
   - sent through Resend when interview options are created
   - includes the tokenized scheduling link
   - does not affect hold validity if delivery fails

2. confirmation email
   - sent through Resend after the slot is confirmed
   - includes the selected time and meeting link when available
   - does not affect the confirmed interview if delivery fails

Google Calendar is responsible for the actual calendar invite after
confirmation. Resend is used to provide human-readable workflow communication.

## Why DB holds still exist

DB holds remain necessary even with Google Calendar because free/busy only
reflects actual calendar events. It does not reserve tentative options for one
candidate while they decide.

The hold layer solves that:

- offered slots are temporarily blocked in the app
- another candidate cannot receive the same active slot window
- confirmation and release remain deterministic in application logic

## Candidate selection flow

1. an admin offers 3 to 5 slots for a shortlisted candidate
2. the system creates hold rows with a shared selection token
3. the candidate opens a tokenized `/interview/[selectionToken]` page
4. selecting one slot atomically:
   - confirms the chosen hold
   - releases the other held options
   - updates the interview record
   - updates the candidate to `interview_scheduled`
5. after confirmation:
   - Google Calendar creates the real interview event
   - Google sends the attendee invite
   - Resend sends a separate human-readable confirmation email

## Reschedule and no-response handling

Reschedule now has a small approval loop:

- the candidate can request a different time from the tokenized page
- the interview moves to `reschedule_requested`
- prior held or confirmed slots are released
- the candidate note is stored on the interview
- Gemini can interpret the note into structured scheduling hints such as
  preferred time of day or preferred days
- the model never picks final slots; it only creates hints
- admins can regenerate replacement slot suggestions
- admins can approve and send the refreshed scheduling link when the new held
  options look good

No-response is handled through hold expiration:

- slot options expire after 48 hours
- expired holds remain visible in admin history
- admins can see when a candidate never picked a slot and can regenerate options manually

## Failure handling

Scheduling communication is intentionally best-effort:

- if the offer email fails, the holds still exist and the admin still has the tokenized link
- if the confirmation email fails, the confirmed interview and Google Calendar event still remain valid
- if Google event creation fails, the interview still remains scheduled in the app and both admin and candidate see a clean follow-up warning
- if Google event creation succeeds, the interview is considered scheduled even if follow-up email delivery fails

This keeps the workflow source of truth in the DB and calendar systems rather
than in email delivery.

## What is simplified vs production-grade

Simplified for MVP:

- interviewer availability still uses fixed workday windows, but only inside
  the open gaps returned by Google Calendar free/busy
- the integration assumes one configured calendar instead of multi-user account linking
- candidate selection uses a tokenized link instead of candidate auth
- reschedule uses AI only to summarize candidate timing preferences, not to invent or finalize slots
- confirmed reschedules do not yet cancel or update an existing Google Calendar event automatically

## Manual QA

1. Offer interview slots for a shortlisted candidate from the admin page.
2. Confirm the candidate receives the scheduling link email or the admin sees a clear best-effort delivery warning.
3. Open the tokenized scheduling link and confirm one slot.
4. Confirm the chosen hold becomes confirmed, the other holds are released, and the candidate status becomes `interview_scheduled`.
5. Verify Google Calendar event creation succeeds and invite emails are sent to the candidate and interviewer.
6. Simulate a Google Calendar configuration failure and confirm the interview still remains scheduled while the app shows a clean follow-up warning instead of a raw provider error.
7. Use the candidate scheduling page to request a different time with a note.
8. Confirm admin sees the reschedule request, original note, AI preference summary, and current scheduling state.
9. Regenerate replacement suggestions and confirm 3 to 5 new held slots are produced without overlapping existing active holds or busy calendar windows.
10. Approve and send the refreshed scheduling link, then confirm email delivery is reported separately from hold creation.
11. Repeat with two candidates and confirm overlapping held or confirmed slots for the same interviewer are never offered concurrently.

Production-grade version later:

- per-interviewer connected calendars
- richer event updates and cancellation syncing
- email reminders and nudges
- interviewer pools and panel coordination
- automatic follow-up for expired holds

## What Phase 04 would build next

After scheduling, later phases can add:

- interview support and transcripts
- post-interview notes
- offer generation
- e-signature
- onboarding handoff
