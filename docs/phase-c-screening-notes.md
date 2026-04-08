# Phase 02 Screening Notes

AI resume screening sits between public application intake and later-stage candidate review.

## What Screening Does

- downloads the uploaded resume from Supabase Storage
- extracts text from PDF or DOCX files
- compares resume text against the applied role
- calls Gemini for structured screening output
- validates output with Zod
- stores the result in `screening_results`
- updates candidate score and recommendation deterministically
- preserves admin override decisions

## Inputs

Screening is grounded in:

- uploaded resume text
- role title
- team
- location / remote status
- experience level
- responsibilities
- requirements
- model name
- prompt version

The model is explicitly instructed not to browse or invent external profile information.

## Output

`screening_results` stores:

- parsed resume text
- extracted skills
- structured education/employer evidence
- key achievements
- strengths
- gaps
- fit score
- rationale
- shortlist recommendation
- model name
- input fingerprint
- prompt version
- generated timestamp

## Deterministic Status Rules

Gemini does not directly set workflow status.

The app decides:

- below threshold -> `screened`
- meets shortlist threshold -> `shortlisted`
- admin override exists -> preserve the human-chosen status

## Caching

The app computes a screening fingerprint from:

- parsed resume text
- role context
- model name
- prompt version

If the fingerprint matches the stored result, the app reuses the existing artifact instead of calling Gemini again. This reduces quota burn during repeated QA runs.

## Known Limits

- PDF extraction can be imperfect for layout-heavy resumes.
- DOCX extraction is generally cleaner.
- Screening is manually triggered from the admin page.
- No background queue is used in this prototype.

## Why It Is Useful

Screening produces the first structured hiring signal: score, rationale, strengths, gaps, and extracted resume evidence. Enrichment, scheduling, interview summary, and offers can then build on a grounded candidate record rather than a raw application alone.
