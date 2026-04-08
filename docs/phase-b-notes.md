# Phase 02 Admin Review Notes

Phase 02 adds the internal admin review layer on top of public application intake.

## What This Layer Provides

- `/admin` dashboard
- filterable candidate table
- `/admin/candidates/[candidateId]` candidate workspace
- status badges and workflow filters
- candidate/application/role/audit visibility
- screening, enrichment, scheduling, interview, offer, and Slack sections as later phases become available

## Why It Matters

Application intake alone is not operationally useful. Hiring teams need one place to:

- scan candidates quickly
- filter by role or workflow stage
- inspect evidence and audit history
- run actions in the right phase
- understand what happened next

The admin UI is the control plane for the rest of the pipeline.

## Current Dashboard

The `/admin` page:

1. reads URL-driven filters
2. fetches candidates
3. joins role/application/screening context
4. renders a scannable table
5. links each row to the candidate workspace

Candidate rows show:

- name and email
- role
- status
- score/recommendation when available
- applied date
- clear `View profile` action

## Current Candidate Detail Page

The candidate detail page is organized around workflow sections:

1. Hiring decision summary
2. Scheduling / interview
3. Interview intelligence
4. Offer
5. Slack onboarding
6. Candidate intelligence
7. Activity / audit
8. Admin controls and danger zone

This keeps late-stage candidates readable without turning the page into a raw debug dump.

## Status Vocabulary

The top-level candidate status is intentionally compact:

- `applied`
- `screened`
- `shortlisted`
- `interview_pending`
- `interview_scheduled`
- `interview_completed`
- `offer_sent`
- `offer_signed`
- `onboarded`
- `rejected`

Side tables hold richer phase-specific state:

- `screening_results`
- `research_profiles`
- `interviews`
- `calendar_holds`
- `interview_transcripts`
- `offers`
- `slack_onboarding`

## Design Pass

The admin redesign now uses the same visual system as the public careers flow:

- shared card surfaces
- calmer spacing
- status pills
- stronger table hierarchy
- less explanatory product copy
- cleaner candidate detail sections

The goal is a normal internal product feel: useful, scannable, and demo-ready.
