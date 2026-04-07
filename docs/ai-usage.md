# AI Usage

## What AI is used for

Gemini is used for five focused tasks:

1. Resume screening
   - compare resume text against the applied role
   - extract structured hiring evidence
   - generate fit score, rationale, strengths, and gaps

2. Candidate enrichment
   - summarize candidate-submitted profile sources
   - generate a concise candidate brief
   - flag conservative discrepancies
   - estimate enrichment confidence

3. Interview summary
   - summarize transcript text into a structured post-interview artifact
   - identify observed strengths, concerns, topics, and follow-up prompts

4. Offer drafting
   - draft a plain-English offer letter from explicit hiring-manager inputs
   - use candidate/role/interview context as supporting context only

5. Slack welcome copy
   - draft a concise onboarding welcome message from candidate, role, start date, manager, and configured resources
   - app logic still controls Slack lookup, invite state, and message delivery

## What AI is not used for

AI is not used to:

- decide who can access the admin area
- determine whether enrichment is allowed
- choose final interview slots
- directly update workflow state on its own
- browse the public web freely outside the source content the app provides
- mark offers as sent or signed
- decide whether a candidate joined Slack or should be marked onboarded

## Separation of concerns

Each AI workflow has its own helper and persistence layer:

- screening writes to `screening_results`
- enrichment writes to `research_profiles`
- interview summary writes to `interview_transcripts`
- offer drafting writes plain letter text to `offers`
- Slack welcome generation only produces message copy after app-controlled join detection

This keeps the system easier to reason about and prevents a model response from
controlling the candidate lifecycle.

## Anti-hallucination controls

The prompts explicitly instruct Gemini to:

- use only provided resume, role, screening, interview, and source content
- avoid inventing missing profile details or offer terms
- treat blocked or missing sources as limitations, not evidence
- keep discrepancy flags conservative
- return offer letters as normal prose, not JSON or placeholder fields

## Structured output validation

Gemini returns JSON-shaped output for screening, enrichment, interview summaries,
and the offer-letter envelope. The app validates those outputs with Zod before
database writes. The offer-letter helper also sanitizes common JSON/code-fence
artifacts before storing candidate-facing text.

For demo continuity, the interview-summary and offer-letter flows have
deterministic fallbacks for temporary Gemini quota/high-demand errors. Those
fallbacks are built only from app data and are marked as deterministic fallback
artifacts; they do not let AI or a provider failure control workflow state.

## Why workflow state remains deterministic

Application logic still controls:

- shortlist threshold behavior
- admin override behavior
- enrichment eligibility
- scheduling hold creation and confirmation
- interview completion
- offer send/sign transitions
- Slack onboarding state transitions
- admin access and route protection

## Why Gemini was chosen for this version

This version uses the official Google Gemini Developer API SDK:

- `@google/genai`

Reasons:

- official supported SDK
- good structured output support
- easy server-side integration
- simple enough to keep the prototype interview-friendly
