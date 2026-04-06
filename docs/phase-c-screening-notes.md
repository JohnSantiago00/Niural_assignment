# Phase C1 Screening Notes

## What Phase C1 adds

Phase C1 adds AI resume screening to the existing intake and admin workflow.

The system can now:

- download the uploaded resume
- extract text from PDF or DOCX files
- compare the resume text against the specific role the candidate applied for
- generate structured screening output with Gemini
- store that result in `screening_results`
- update candidate score and status deterministically
- let an admin manually override the shortlist outcome

## Why screening comes before enrichment

Screening uses only two grounded inputs:

- the uploaded resume
- the selected job description

That makes it the cleanest next step after Phase B because it improves hiring decisions without expanding the system into external data collection yet.

Profile enrichment can come later for shortlisted candidates, when the system already has:

- a real score
- a rationale
- strengths and gaps
- a shortlist recommendation

## How AI is used here

Gemini is used for one narrow task:

- extract structured evidence from resume text
- evaluate fit against the role
- return a fit score and rationale

The model is explicitly instructed to use only the resume text and role details. It does not browse, enrich, or infer external profile information.

This version uses the official Google Gemini Developer API SDK while preserving
structured output validation in application code.

## Where deterministic logic still controls state

The model does **not** directly control workflow status.

Application logic decides:

- where screening results are stored
- when candidate `ai_score` is updated
- how candidate status changes
- how shortlist threshold is applied
- how admin overrides interact with AI output

Current deterministic rules:

- if no admin override is active and score is below threshold: `screened`
- if no admin override is active and score meets threshold: `shortlisted`
- if admin override is active: preserve the human-chosen status even when screening reruns

## MVP limitations

- PDF extraction can be imperfect for layout-heavy resumes
- DOCX extraction is generally cleaner than PDF extraction
- screening is triggered manually from the candidate detail page
- no background jobs, queues, or retry system yet
- no external profile enrichment yet

## What the next enrichment phase will add

The next phase can build only on shortlisted candidates and add:

- LinkedIn / GitHub / portfolio enrichment
- candidate brief expansion
- discrepancy checks across resume and public profiles
- deeper recruiter review support

That later phase will be cleaner because Phase C1 already establishes:

- screening persistence
- score/status transitions
- admin override behavior
- a dedicated place in the admin UI to render AI outputs

## Phase C1 quality pass

### Why education and employer data is now more structured

The first screening version stored `education` and `past_employers` as flat
arrays of strings. That was enough to prove the extraction loop worked, but it
was too lossy for an internal review UI.

The schema now stores:

- `education` as objects with `institution`, `degree`, `field`, and `year`
- `past_employers` as objects with `company`, `title`, and `duration`

This keeps the output grounded while making it much easier to render readable
resume evidence in the admin detail page and extend later phases without
reparsing unstructured strings.

### How score quality was improved

The screening prompt now gives clearer scoring guidance so the model behaves
more like a practical recruiter screen:

- core requirements carry more weight than nice-to-have responsibilities
- missing evidence lowers confidence moderately instead of collapsing the score
- weak evidence does not justify inflated scores
- score bands are described in plain English so the model has a more defensible
  sense of what 85 vs 70 vs 50 should mean

This is still an MVP prompt, not a rubric engine, but it makes the scores and
rationales easier to explain and trust.

### Strengths and gaps requirement

Strengths and gaps remain required with at least one item each.

That was a deliberate choice. For internal hiring review, a result without both
positive evidence and risk areas is usually less useful than a score alone. The
requirement nudges the model to produce a balanced screening artifact instead of
an overly positive or overly vague summary.

### Detail page improvement before enrichment

The candidate detail page was widened and reorganized so the AI screening output
no longer lives in a cramped side column.

The page now separates:

- candidate summary
- AI screening overview
- rationale
- strengths and gaps
- structured resume extraction
- application metadata
- override controls
- workflow activity

That makes Phase C1 easier to scan now and gives the next enrichment phase a
clear place to add more AI-assisted review sections without redesigning the
page.
