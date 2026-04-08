# Phase 02 Enrichment Notes

Enrichment adds candidate context after screening and shortlisting.

## Why Enrichment Comes After Screening

Screening answers:

```text
Is this resume a plausible fit for the applied role?
```

Enrichment answers:

```text
What extra context can we gather for an already-shortlisted candidate?
```

Keeping them separate prevents online profile availability from controlling the initial fit decision.

## Eligibility

Enrichment is gated in deterministic app logic:

- UI only exposes enrichment for shortlisted candidates.
- Server workflow rejects enrichment for non-shortlisted candidates.
- Gemini never decides enrichment eligibility.

## Sources

The app uses candidate-submitted profile links:

- LinkedIn URL
- GitHub URL
- portfolio URL

The app does not claim official LinkedIn/GitHub partner API access. It performs lightweight source fetching where public access works and records limitations where it does not.

## LinkedIn and Source Limitations

LinkedIn often blocks automated public fetches. The app handles that honestly:

- try direct fetch
- if blocked/unavailable, record a source limitation
- preserve the submitted URL for manual review
- do not treat blocked access as a discrepancy

## Discrepancy Rules

Discrepancy flags are conservative. They should only appear when available evidence clearly suggests a mismatch.

They should not appear simply because:

- a source is missing
- a site blocks access
- a profile has less detail than the resume

## Stored Output

`research_profiles` stores:

- submitted source URLs used
- source summaries
- candidate brief
- discrepancy flags
- LinkedIn source status/note
- confidence score
- model name

The confidence score reflects enrichment quality, not candidate quality.

## Why This Is Enough

This design gives admins useful context without pretending the app has high-confidence identity graph data. It is conservative, explainable, and safe for a take-home prototype.
