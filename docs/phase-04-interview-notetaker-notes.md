# Phase 04 Interview Notetaker Notes

## What Phase 04 Adds

Phase 04 adds an interview-complete workflow on top of the existing Phase 03
scheduling system:

- admin-only simulated interview completion
- persisted transcript text linked to the candidate and interview
- Gemini-generated interview summary
- observed strengths, concerns, topics, and follow-up recommendations
- one latest interviewer feedback record with rating and comments

## Why Simulated Completion Exists

The take-home assignment asks for an AI notetaker/transcript layer, but requiring
a real meeting bot would make the prototype harder to demo and configure. The
simulated path lets an admin mark a scheduled interview as complete and create a
real transcript-like artifact without Fireflies or a live call.

The simulated transcript is clearly labeled as simulated and is grounded in:

- candidate name
- role title and requirements
- existing screening result when available
- existing enrichment brief when available

## How This Maps To A Real Notetaker Later

The app stores transcript records in `interview_transcripts` with a
`transcript_source` field. Today the source can be `simulated`; a production
integration could later write `fireflies_real_ready` or another provider-backed
source into the same table.

That means the rest of the admin review surface does not need to change when a
real transcript provider is added. The ingestion source changes, but the summary
and feedback UI can stay mostly the same.

## Deterministic Workflow Boundaries

Gemini summarizes the transcript only after the app has created or received one.
The model does not decide whether an interview is completed and does not mutate
candidate state directly.

Application code controls:

- whether simulation is allowed
- interview status transition to `completed`
- candidate status transition to `interview_completed`
- transcript persistence
- feedback persistence

## Feedback Handling

Feedback is intentionally one latest record per interview. Re-submitting the
form updates the existing record instead of introducing multi-reviewer committee
workflows. That keeps the MVP compact while still demonstrating post-interview
evaluation.
