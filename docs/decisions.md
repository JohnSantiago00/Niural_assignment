# Engineering Decisions

Key implementation decisions, alternatives considered, and why the current version fits the assignment.

## Decision Table

| Decision | What I chose | Production alternative | Why this fits the prototype |
| --- | --- | --- | --- |
| Workflow state | Supabase tables + server-side workflow helpers | Dedicated workflow engine or queue | Easier to review and sufficient for an end-to-end hiring pipeline. |
| Admin auth | Supabase Auth + `admin_users` allowlist | Full RBAC with org roles and RLS policies | Real identity without overbuilding authorization before the workflow is proven. |
| AI provider | Gemini via `@google/genai` | Multi-model routing | Keeps integration simple while still showing structured generation and fallbacks. |
| AI safety | Zod validation + source-bound prompts | Human review queues for every AI artifact | Good prototype guardrails without slowing every action. |
| AI caching | Input fingerprints on generated artifacts | Background cache service | Prevents quota burn with minimal schema and no new infrastructure. |
| Resume storage | Private Supabase Storage bucket | External document service | Fits the Supabase stack and keeps resumes out of public URLs. |
| Enrichment | Submitted profile URLs + conservative summaries | Official LinkedIn/GitHub partner APIs | Avoids brittle scraping claims while showing enrichment behavior. |
| Scheduling holds | `calendar_holds` + DB conflict constraints | Rely only on Google Calendar free/busy | Free/busy does not reserve offered slots; DB holds prevent double-booking. |
| Calendar integration | One configured Google Calendar | Per-interviewer OAuth | Keeps setup manageable for a take-home while exercising real Calendar APIs. |
| Interview transcript | Simulated transcript-shaped artifact | Fireflies/Zoom/Meet transcript ingestion | Demonstrates the downstream notetaker workflow without needing meeting vendor setup. |
| Offer signing | Custom canvas signature pad | DocuSign/PandaDoc/HelloSign | Matches assignment requirement for custom in-app signing and keeps demo self-contained. |
| Signature storage | PNG data URL on `offers` | Private storage artifact + immutable signing log | Smallest explainable MVP; production would move to immutable artifacts. |
| Slack invite | Admin invite when available, invite-link email fallback otherwise | Full Slack OAuth/admin app install flow | Honest about Slack admin API limits while keeping real Slack lookup/messaging. |
| Setup | `npm run db:setup` | Supabase CLI project or manual SQL editor | Reduces reviewer friction and makes clone-to-demo faster. |

## Why DB State Wins Over Provider State

Every provider has failure modes:

- Resend can delay or fail email delivery.
- Google Calendar can reject attendee invites from service accounts.
- Slack admin invite APIs can be blocked by workspace plan/scopes.
- Gemini can hit free-tier quota or high-demand errors.

So the app treats external providers as side effects. The database records what the hiring workflow believes happened and stores provider errors as follow-up metadata.

## Why Not a Background Queue Yet

Several actions are synchronous today:

- screening
- enrichment
- slot generation
- interview summary
- offer generation
- Slack onboarding check

A production system would move many of these into jobs. For this assignment, server actions keep the causal chain visible and easy to demo. Deterministic fallbacks and artifact caching reduce the main pain points without adding queue infrastructure.

## Why Not Full RBAC Yet

The current admin model is intentionally simple:

- Supabase Auth identifies the user.
- `admin_users` authorizes access.
- Admin pages are protected server-side.

Full RBAC would add interviewer, recruiter, hiring-manager, and candidate policy boundaries. That belongs after the product workflow is validated because it touches every table and route.

See [internal-access-notes.md](internal-access-notes.md) for the migration path.

## Why Custom Signing

The assignment explicitly allowed a lightweight custom signing UI if it captured:

- signature
- timestamp
- IP address

The canvas signature pad satisfies that directly and keeps the user experience inside the app. It also avoids pretending a vendor integration exists when the assignment asks for custom implementation.

## Why Slack Fallback Is Email-Based

Slack user invitations are not universally available through a bot token. The admin invite method can require admin-capable tokens, workspace support, and channel IDs.

The fallback is:

1. Email the candidate a configured Slack workspace invite link through Resend.
2. Detect the candidate after they join with Slack `users.lookupByEmail`.
3. Send real Slack team welcome + DM + HR notification.

This is honest, testable, and still uses real Slack APIs where the workspace allows it.
