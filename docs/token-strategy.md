# AI Token Strategy

How the project avoids unnecessary Gemini calls, keeps generated artifacts reliable, and leaves room to scale AI usage later.

## Guiding Principle

AI is used only where it creates leverage:

- interpret messy resume/profile/transcript text
- summarize evidence
- draft professional writing

Workflow decisions stay in deterministic code. That means scoring, scheduling, validation, and state transitions can still run even when AI is unavailable.

## Current AI Calls

| Flow | Trigger | Stored artifact | Reuse strategy |
| --- | --- | --- | --- |
| Screening | Admin clicks screening | `screening_results` | Reuse when input fingerprint matches. |
| Enrichment | Admin clicks enrichment for shortlisted candidate | `research_profiles` | One latest profile per candidate; conservative source handling. |
| Reschedule preference extraction | Admin regenerates scheduling options after candidate note | `interviews.reschedule_preferences` | Hints inform deterministic slot ranking. |
| Interview summary | Admin simulates interview completion | `interview_transcripts` | Reuse when transcript fingerprint matches. |
| Offer letter | Admin sends offer | `offers.generated_letter` | Reuse unsigned offer when offer-input fingerprint matches. |
| Slack welcome | Admin checks Slack and sends welcome | Slack message text only | Fallback deterministic copy if Gemini is unavailable. |

## Fingerprint-Based Reuse

Candidate id alone is not enough for caching. The same candidate can have:

- changed resume text
- changed role context
- different transcript content
- changed offer inputs
- a new prompt version
- a new model

So the app computes a deterministic fingerprint from normalized effective inputs.

```text
screening fingerprint
  resume text
  role title/team/location/requirements
  model
  prompt version

interview fingerprint
  transcript text
  candidate name
  role title
  model
  prompt version

offer fingerprint
  offer inputs
  candidate context
  role context
  interview summary/fingerprint
  model
  prompt version
```

If the stored fingerprint matches, the app reuses the generated artifact and skips Gemini.

## Demo Reliability

During repeated testing, the Gemini free tier can return:

```text
429 RESOURCE_EXHAUSTED
```

The app handles that in later-stage flows:

- interview summary falls back to deterministic summary
- offer letter falls back to deterministic offer prose
- Slack welcome falls back to deterministic message copy

The fallback artifacts are labeled as deterministic fallback outputs. The app does not pretend a provider generated them.

## What Still Uses Live Gemini

Screening and enrichment are intended to use live AI behavior. If Gemini is missing or exhausted, seeded screening/enrichment records from `npm run db:setup` still show the expected artifact shape.

## Scaling Plan

If this became production software, the next steps would be:

1. Move expensive AI jobs into a background queue.
2. Add per-candidate artifact versioning.
3. Cache enrichment by normalized profile URL and candidate email.
4. Add manual “regenerate” controls with reason logging.
5. Track token and latency metrics per AI helper.
6. Add stronger eval fixtures for prompts and schema stability.

## Why This Is Enough Here

The current caching pass removes the biggest demo pain: repeated admin clicks no longer re-call Gemini when nothing changed. It does that without adding Redis, a queue, or a new cache service.
