# Phase C1 Screening Notes

## What Phase C1 adds

Phase C1 adds AI resume screening to the existing intake and admin workflow.

The system can now:

- download the uploaded resume
- extract text from PDF or DOCX files
- compare the resume text against the specific role the candidate applied for
- generate structured screening output with the LLM
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

AI is used for one narrow task:

- extract structured evidence from resume text
- evaluate fit against the role
- return a fit score and rationale

The model is explicitly instructed to use only the resume text and role details. It does not browse, enrich, or infer external profile information.

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
