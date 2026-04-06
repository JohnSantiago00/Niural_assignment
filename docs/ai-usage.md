# AI Usage

## What AI is used for

Gemini is used for two focused tasks:

1. Resume screening
   - compare resume text against the applied role
   - extract structured hiring evidence
   - generate fit score, rationale, strengths, and gaps

2. Candidate enrichment
   - summarize candidate-submitted profile sources
   - generate a concise candidate brief
   - flag conservative discrepancies
   - estimate enrichment confidence

## What AI is not used for

AI is not used to:

- decide who can access the admin area
- determine whether enrichment is allowed
- directly update workflow state on its own
- browse the public web freely outside the source content the app provides

## Screening vs enrichment separation

Screening and enrichment are intentionally separate.

- screening uses resume + role JD
- enrichment uses shortlisted candidates + submitted profile sources

This keeps the reasoning chain cleaner and makes the system easier to explain.

## Anti-hallucination controls

The prompts explicitly instruct Gemini to:

- use only provided resume, role, screening, and source content
- avoid inventing missing profile details
- treat blocked or missing sources as limitations, not evidence
- keep discrepancy flags conservative

## Structured output validation

Gemini returns JSON-shaped output, but the app still validates everything with Zod before any database write.

That means:

- malformed output is rejected
- workflow state is protected from invalid model responses
- the stored AI artifacts have predictable structure

## Why workflow state remains deterministic

Application logic still controls:

- shortlist threshold behavior
- admin override behavior
- enrichment eligibility
- admin access and route protection

This keeps human control and business rules outside the model.

## Why Gemini was chosen for this version

This version uses the official Google Gemini Developer API SDK:

- `@google/genai`

Reasons:

- official supported SDK
- good structured output support
- easy server-side integration
- simple enough to keep the prototype interview-friendly
