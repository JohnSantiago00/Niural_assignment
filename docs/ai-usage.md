# AI Utilization

Model selection, prompt boundaries, caching, validation, and fallback behavior for the Gemini-backed parts of the project.

## Model Map

| Task | Model | Output | Why this use is bounded |
| --- | --- | --- | --- |
| Resume screening | `GEMINI_MODEL` defaulting to `gemini-2.5-flash` | Structured score, rationale, strengths, gaps, extracted evidence | The app provides resume + role context and validates JSON with Zod before persistence. |
| Candidate enrichment | `GEMINI_MODEL` | Candidate brief, source summaries, discrepancy flags, confidence | The app provides submitted profile URLs/source content; Gemini is told not to invent missing evidence. |
| Reschedule preference extraction | `GEMINI_MODEL` | Structured scheduling hints | Hints inform deterministic slot ranking; the model does not book time. |
| Interview summary | `GEMINI_MODEL` | Structured post-interview artifact | Transcript-shaped input is provided by app logic; summary is stored only after validation/fallback. |
| Offer letter | `GEMINI_MODEL` | Plain-English offer letter draft | Hiring-manager inputs and app state drive the offer; Gemini only drafts text. |
| Slack welcome | `GEMINI_MODEL` | Short welcome copy | Slack lookup, join detection, and message send state are deterministic app logic. |

## What AI Is Not Allowed To Do

Gemini does not:

- authorize admin access
- decide enrichment eligibility
- directly mutate candidate state
- choose final interview slots
- send emails
- mark offers as sent or signed
- decide whether a candidate joined Slack
- invent legal offer terms or missing candidate evidence

## Prompting Boundaries

Every AI helper follows the same pattern:

1. Build a narrow prompt from app-owned data.
2. Ask for either a validated JSON object or plain prose.
3. Parse and validate the response.
4. Store the output as an artifact.
5. Let deterministic app logic decide workflow state.

Helpers live under:

- `lib/gemini/generate-structured.ts`
- `lib/gemini/summarize-interview.ts`
- `lib/gemini/generate-offer-letter.ts`
- `lib/gemini/generate-slack-welcome.ts`

## Anti-Hallucination Controls

The app uses several guardrails:

- source-bound prompts that say to use only provided content
- Zod validation for structured responses
- conservative discrepancy flags for enrichment
- no model-driven workflow transitions
- offer letter cleanup to remove code fences, JSON artifacts, and placeholder signature lines
- deterministic fallback content for quota/high-demand errors in later-stage demo flows

## AI Artifact Reuse

Screening, interview summaries, and offer letters store:

- `input_fingerprint`
- `prompt_version`
- `generated_at`

The fingerprint is built from normalized effective inputs, not just candidate id.

| Artifact | Fingerprint inputs |
| --- | --- |
| Screening | parsed resume text, role context, model name, prompt version |
| Interview summary | transcript text, candidate/role context, model name, prompt version |
| Offer letter | offer inputs, candidate context, role context, interview summary/fingerprint, model name, prompt version |

If the fingerprint matches an existing stored artifact, the app reuses the DB record instead of calling Gemini again. If the resume, role context, transcript, offer inputs, model, or prompt version changes, the fingerprint changes and regeneration is allowed.

This was added after repeated QA runs burned through free-tier Gemini quota. It improves reliability while preserving Supabase as the workflow source of truth.

## Fallback Behavior

| Flow | Fallback |
| --- | --- |
| Interview summary | deterministic summary generated from candidate/role/screening context |
| Offer letter | deterministic offer prose generated from hiring-manager inputs |
| Slack welcome | deterministic welcome message generated from candidate name, role, start date, manager, and resource links |

Fallback artifacts are marked with fallback model names such as `deterministic-fallback` rather than pretending Gemini generated them.

## Why Gemini

This project uses the official Google Gemini SDK:

```text
@google/genai
```

Reasons:

- official supported SDK
- simple server-side integration
- structured output support
- fast enough for an interview prototype
- easy to swap via `GEMINI_MODEL`

## Tradeoff

Gemini makes screening, summaries, offer drafting, and welcome copy feel realistic, but the product is still designed to degrade gracefully. The most important state transitions remain normal code paths, not model decisions.
