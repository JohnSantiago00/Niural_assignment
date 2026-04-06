# Phase 02C Enrichment Notes

## Why enrichment comes after screening

Screening and enrichment solve different problems.

- screening answers: "Is this resume a plausible fit for the role?"
- enrichment answers: "What extra context can we gather for already shortlisted candidates?"

Keeping them separate makes the system easier to explain and prevents online
research from affecting the initial fit decision.

## Why enrichment is limited to shortlisted candidates

Phase 02C is intentionally gated in deterministic app logic.

Only candidates with `current_status = shortlisted` can be enriched. That means:

- the UI only offers enrichment for shortlisted candidates
- the server workflow rejects enrichment for non-shortlisted candidates
- AI never decides who is eligible for enrichment

This keeps resource usage focused and makes the workflow easier to defend in an
interview.

## What sources were used

This MVP uses the candidate-submitted links first:

- LinkedIn URL
- GitHub URL
- portfolio URL

X/Twitter is included in the schema as an optional future field, but it is not
actively used in this MVP unless that URL is added later.

## How source retrieval works

The app performs lightweight server-side fetches of the candidate-submitted URLs
and extracts lightweight readable text plus page title/description from the
returned HTML.

LinkedIn is handled with a layered strategy because direct automated access is
not consistently reliable:

1. try direct fetch of the submitted LinkedIn URL
2. if LinkedIn blocks access or public content is limited, keep the enrichment run successful but record that LinkedIn automation was blocked and the submitted URL remains available for manual review

This is intentionally simple:

- no official third-party integrations
- no login-dependent scraping
- no giant crawling workflow

If a page is missing, blocked, or unavailable, the enrichment result reflects
that limitation instead of inventing findings.

## LinkedIn limitation and MVP tradeoff

LinkedIn commonly blocks bot-like requests and can return HTTP 999 or similar
anti-automation responses. For this take-home MVP, the app does not attempt
browser automation, fallback search APIs, or unofficial scraping hacks.

Instead, it uses:

- direct fetch when public access works
- clear UI messaging when automated enrichment is blocked

A more production-ready version would likely use a licensed data provider,
an approved partner integration, or a user-assisted workflow rather than
pretending public scraping is reliable.

## How discrepancies are handled conservatively

The enrichment prompt explicitly tells Gemini to flag discrepancies only when
the available evidence suggests a clear mismatch.

The stored discrepancy flags are structured objects with:

- `type`
- `severity`
- `description`
- `source`

It should not create discrepancy flags just because:

- a source is missing
- a page is blocked
- an online profile contains less detail than the resume

## Confidence score

Enrichment also stores a `confidence_score` from 0 to 100.

This score reflects enrichment quality, not candidate quality. It should
capture:

- how many usable sources were available
- how internally consistent those sources were
- how much readable evidence the system could actually gather

## Gemini migration

This version uses the official Google Gemini Developer API SDK instead of the
earlier model integration.

That keeps the AI layer current while preserving the same app-level guarantees:

- structured output
- Zod validation before writes
- deterministic workflow rules in application code

## MVP limitations

- some sites, especially LinkedIn, may block or limit readable public fetches
- fetched HTML is reduced to simple readable text rather than full structured parsing
- X/Twitter is not fully supported in this MVP
- enrichment is manual rather than queued/background processed

## What Phase 03 will build next

After enrichment, the next phase can add later-stage hiring workflow features
such as:

- scheduling
- interview support
- transcripts / notes
- offers / signing
- onboarding handoff
