/**
 * Polished internal candidate profile view. The page keeps the existing
 * deterministic workflow/actions intact, but presents the review story in a
 * recruiter-friendly order instead of exposing every system artifact equally.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { hardDeleteCandidateAction } from "@/lib/admin/actions";
import { getCandidateDetail } from "@/lib/admin/queries";
import { requireAdminUser } from "@/lib/auth/authorization";
import { runCandidateEnrichmentAction } from "@/lib/enrichment/actions";
import { isCandidateEligibleForEnrichment } from "@/lib/enrichment/run-enrichment";
import {
  simulateInterviewCompleteAction
} from "@/lib/interview/actions";
import {
  generateOfferDraftAction
} from "@/lib/offers/actions";
import {
  approveRescheduleSlotsAction,
  offerInterviewSlotsAction,
  regenerateRescheduleSuggestionsAction
} from "@/lib/scheduling/actions";
import { checkSlackJoinAction } from "@/lib/slack/actions";
import {
  getInterviewStatusClasses,
  getInterviewStatusLabel
} from "@/lib/scheduling/status";
import {
  overrideCandidateShortlistAction,
  runCandidateScreeningAction
} from "@/lib/screening/actions";
import {
  getCandidateStatusLabel,
  type CandidateWorkflowStatus
} from "@/lib/utils/candidate-status";
import type { CandidateDetailView } from "@/types/admin";
import type { CalendarHoldRecord, ResearchProfileRecord } from "@/types/database";

type CandidateDetailPageProps = {
  params: Promise<{
    candidateId: string;
  }>;
  searchParams: Promise<{
    screening?: string;
    screeningError?: string;
    enrichment?: string;
    enrichmentError?: string;
    scheduling?: string;
    schedulingError?: string;
    selectionToken?: string;
    offerEmail?: string;
    offerEmailError?: string;
    deleteError?: string;
    interview?: string;
    interviewError?: string;
    feedback?: string;
    feedbackError?: string;
    offer?: string;
    offerError?: string;
    offerDelivery?: string;
    offerDeliveryError?: string;
    offerRecipient?: string;
    slack?: string;
    slackError?: string;
    override?: string;
    overrideError?: string;
  }>;
};

type FlashTone = "success" | "warning" | "error";

type FlashMessage = {
  tone: FlashTone;
  message: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function getNextDateInputValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function formatAiScore(value: number | null) {
  return value === null ? "Not scored" : value.toFixed(1);
}

function formatScheduleWindow(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const day = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium"
  }).format(startDate);
  const time = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short"
  }).format(startDate);
  const endTime = new Intl.DateTimeFormat("en-US", {
    timeStyle: "short"
  }).format(endDate);

  return `${day} · ${time} to ${endTime}`;
}

function getConfidenceLabel(value: number) {
  if (value >= 75) {
    return "High confidence";
  }

  if (value >= 40) {
    return "Medium confidence";
  }

  return "Low confidence";
}

function getDiscrepancySeverityClasses(
  severity: ResearchProfileRecord["discrepancy_flags"][number]["severity"]
) {
  if (severity === "high") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (severity === "medium") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

function getLinkedInSourceLabel(status: ResearchProfileRecord["linkedin_source_status"]) {
  switch (status) {
    case "fetched_direct":
      return "Fetched";
    case "blocked":
      return "Manual review";
    case "unavailable":
      return "Limited evidence";
    case "missing":
      return "Not provided";
  }
}

function getLinkedInSourceBadgeClasses(
  status: ResearchProfileRecord["linkedin_source_status"]
) {
  switch (status) {
    case "fetched_direct":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "blocked":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "unavailable":
    case "missing":
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getShortlistCopy(detail: CandidateDetailView) {
  if (!detail.screeningResult) {
    return "Screening pending";
  }

  return detail.screeningResult.shortlist_recommendation
    ? "AI recommends shortlist"
    : "AI does not recommend shortlist";
}

function getOfferStatusLabel(status: string) {
  return (
    {
      drafting: "Drafting",
      ready: "Ready to send",
      sent: "Sent",
      signed: "Signed",
      cancelled: "Cancelled"
    } as Record<string, string>
  )[status] ?? status;
}

function cleanAdminErrorMessage(message: string) {
  if (/fetch failed/i.test(message)) {
    return "A temporary connection issue interrupted that update. Please retry the action.";
  }

  if (/RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)) {
    return "The AI provider is temporarily rate-limited. The app can retry shortly or use the built-in fallback path.";
  }

  return message;
}

function getSlackOnboardingStatusLabel(status: string) {
  return (
    {
      not_started: "Not started",
      invite_pending: "Invite pending",
      invite_sent: "Invite sent",
      invite_failed: "Invite needs follow-up",
      joined: "Joined Slack",
      welcome_sent: "Welcome sent",
      completed: "Onboarded",
      needs_manual_follow_up: "Manual follow-up needed"
    } as Record<string, string>
  )[status] ?? status;
}

function getSlackDeliveryLabel(status: string) {
  return (
    {
      not_attempted: "Not attempted",
      not_sent: "Not sent",
      sent: "Sent",
      invite_email_sent: "Slack invite email sent",
      failed: "Needs follow-up",
      skipped: "Not configured",
      already_joined: "Already joined"
    } as Record<string, string>
  )[status] ?? status;
}

function getSlackInviteLabel(status: string) {
  if (status === "skipped") {
    return "No invite path";
  }

  return getSlackDeliveryLabel(status);
}

function isOfferEligible(detail: CandidateDetailView) {
  return ["interview_completed", "offer_drafted", "offer_sent", "offer_signed"].includes(
    detail.candidate.current_status
  );
}

function getFlashMessages(params: Awaited<CandidateDetailPageProps["searchParams"]>) {
  const messages: FlashMessage[] = [];

  if (params.screening === "completed") {
    messages.push({ tone: "success", message: "Screening updated." });
  }

  if (params.screeningError) {
    messages.push({ tone: "error", message: params.screeningError });
  }

  if (params.enrichment === "completed") {
    messages.push({ tone: "success", message: "Profile enrichment updated." });
  }

  if (params.enrichmentError) {
    messages.push({ tone: "error", message: params.enrichmentError });
  }

  if (params.scheduling === "offered") {
    messages.push({ tone: "success", message: "Interview options reserved." });
  }

  if (params.scheduling === "reschedule_regenerated") {
    messages.push({ tone: "success", message: "Replacement options prepared." });
  }

  if (params.scheduling === "reschedule_sent") {
    messages.push({ tone: "success", message: "Replacement options sent." });
  }

  if (params.offerEmail === "sent") {
    messages.push({ tone: "success", message: "Candidate email sent." });
  }

  if (params.offerEmail === "skipped") {
    messages.push({
      tone: "warning",
      message: "Options are reserved, but email delivery is not configured."
    });
  }

  if (params.offerEmail === "failed") {
    messages.push({
      tone: "warning",
      message: `Options are reserved, but the candidate email failed.${params.offerEmailError ? ` ${params.offerEmailError}` : ""}`
    });
  }

  if (params.schedulingError) {
    messages.push({ tone: "error", message: params.schedulingError });
  }

  if (params.interview === "completed") {
    messages.push({ tone: "success", message: "Interview summary generated." });
  }

  if (params.interviewError) {
    messages.push({ tone: "error", message: cleanAdminErrorMessage(params.interviewError) });
  }

  if (params.feedbackError) {
    messages.push({ tone: "error", message: params.feedbackError });
  }

  if (params.offer === "sent") {
    messages.push({
      tone: "success",
      message: `Offer email sent${params.offerRecipient ? ` to ${params.offerRecipient}` : ""}. Delivery may take a few seconds.`
    });
  }

  if (params.offerDelivery === "skipped") {
    messages.push({
      tone: "warning",
      message: "Offer is ready, but email delivery is not configured."
    });
  }

  if (params.offerDelivery === "failed") {
    messages.push({
      tone: "warning",
      message: `Offer is ready, but email delivery failed.${params.offerDeliveryError ? ` ${params.offerDeliveryError}` : ""}`
    });
  }

  if (params.offerError) {
    messages.push({ tone: "error", message: params.offerError });
  }

  if (params.slack === "checked") {
    messages.push({ tone: "success", message: "Slack onboarding status refreshed." });
  }

  if (params.slackError) {
    messages.push({ tone: "error", message: params.slackError });
  }

  if (params.override === "saved") {
    messages.push({ tone: "success", message: "Override saved." });
  }

  if (params.overrideError) {
    messages.push({ tone: "error", message: params.overrideError });
  }

  if (params.deleteError) {
    messages.push({ tone: "error", message: params.deleteError });
  }

  return messages;
}

function FlashMessages({ messages }: { messages: FlashMessage[] }) {
  if (messages.length === 0) {
    return null;
  }

  const toneClasses: Record<FlashTone, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-red-200 bg-red-50 text-red-700"
  };

  return (
    <div className="mb-6 grid gap-3 md:grid-cols-2">
      {messages.map((message) => (
        <div
          key={`${message.tone}-${message.message}`}
          className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${toneClasses[message.tone]}`}
        >
          {message.message}
        </div>
      ))}
    </div>
  );
}

function SectionCard({
  title,
  eyebrow,
  children,
  action
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-line/70 bg-white/85 p-6 shadow-soft backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-xl font-semibold tracking-[-0.035em] text-ink">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MiniStat({
  label,
  value,
  helper
}: {
  label: string;
  value: React.ReactNode;
  helper?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-line/70 bg-hero/60 px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <div className="mt-2 text-sm font-semibold text-ink [overflow-wrap:anywhere]">
        {value}
      </div>
      {helper ? (
        <p className="mt-1 text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">None captured yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-line/70 bg-white/75 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function InsightList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No items captured.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="rounded-2xl bg-hero/70 px-4 py-3 text-sm leading-6 text-slate-700">
          {item}
        </li>
      ))}
    </ul>
  );
}

function ExternalLink({ label, href }: { label: string; href: string | null }) {
  if (!href) {
    return (
      <div className="rounded-2xl border border-line/70 bg-hero/60 px-4 py-3 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <p className="mt-2 text-sm text-slate-500">Not provided</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line/70 bg-hero/60 px-4 py-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex text-sm font-semibold text-accent hover:text-accentDark"
      >
        Open profile
      </a>
    </div>
  );
}

function CandidateHero({
  detail,
  status,
  interviewStatus
}: {
  detail: CandidateDetailView;
  status: CandidateWorkflowStatus;
  interviewStatus: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[2.5rem] border border-line/70 bg-hero shadow-soft">
      <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
      <div className="absolute -bottom-28 left-1/3 h-80 w-80 rounded-full bg-gold/20 blur-3xl" />
      <div className="relative p-8 sm:p-10 lg:p-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Link href="/admin" className="text-sm font-semibold text-slate-600 hover:text-accent">
              Back to dashboard
            </Link>
            <p className="mt-8 text-sm font-bold uppercase tracking-[0.22em] text-accent">
              {detail.role.title}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-ink md:text-5xl">
              {detail.candidate.full_name}
            </h1>
            <div className="mt-5 flex flex-wrap gap-3 text-sm font-medium text-slate-600">
              <span>{detail.candidate.email}</span>
              <span className="text-slate-300">/</span>
              <span>{detail.role.team}</span>
              <span className="text-slate-300">/</span>
              <span>Applied {formatDate(detail.application.submitted_at)}</span>
            </div>
          </div>

          <div className="grid min-w-[18rem] gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-3xl border border-line/70 bg-white/75 px-5 py-4 shadow-sm backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Workflow stage</p>
              <div className="mt-3">
                <StatusBadge status={status} />
              </div>
            </div>
            <div className="rounded-3xl border border-line/70 bg-white/75 px-5 py-4 shadow-sm backdrop-blur">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Interview</p>
              <p className="mt-3 text-sm font-semibold text-ink">{interviewStatus}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-4">
          <div className="rounded-3xl border border-line/70 bg-white/75 px-5 py-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">AI score</p>
            <p className="mt-2 text-2xl font-semibold text-ink">
              {formatAiScore(detail.candidate.ai_score)}
            </p>
          </div>
          <div className="rounded-3xl border border-line/70 bg-white/75 px-5 py-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Recommendation</p>
            <p className="mt-2 text-sm font-semibold text-ink">{getShortlistCopy(detail)}</p>
          </div>
          <div className="rounded-3xl border border-line/70 bg-white/75 px-5 py-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Profile research</p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {detail.researchProfile
                ? getConfidenceLabel(detail.researchProfile.confidence_score)
                : "Pending research"}
            </p>
          </div>
          <div className="rounded-3xl border border-line/70 bg-white/75 px-5 py-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Offer</p>
            <p className="mt-2 text-sm font-semibold text-ink">
              {detail.offer ? getOfferStatusLabel(detail.offer.offer_status) : "Not started"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionRail({
  detail,
  status,
  canRunEnrichment,
  canOfferSlots,
  canSimulateInterview,
  activeHolds,
  expiredHoldCount
}: {
  detail: CandidateDetailView;
  status: CandidateWorkflowStatus;
  canRunEnrichment: boolean;
  canOfferSlots: boolean;
  canSimulateInterview: boolean;
  activeHolds: CalendarHoldRecord[];
  expiredHoldCount: number;
}) {
  return (
    <aside className="space-y-5 xl:sticky xl:top-6">
      <section className="rounded-[2rem] border border-line/70 bg-white/85 p-5 shadow-soft backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Next actions
        </p>
        <div className="mt-4 space-y-3">
          <form action={runCandidateScreeningAction.bind(null, detail.candidate.id)}>
            <button
              type="submit"
              className="w-full rounded-full border border-line/80 bg-white/80 px-5 py-3 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-soft"
            >
              {detail.screeningResult ? "Refresh screening" : "Run screening"}
            </button>
          </form>

          {canRunEnrichment ? (
            <form action={runCandidateEnrichmentAction.bind(null, detail.candidate.id)}>
              <button
                type="submit"
                className="w-full rounded-full border border-line/80 bg-white/80 px-5 py-3 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-soft"
              >
                {detail.researchProfile ? "Refresh enrichment" : "Run enrichment"}
              </button>
            </form>
          ) : (
            <p className="rounded-2xl bg-hero/70 px-4 py-3 text-sm leading-6 text-slate-500">
              Enrichment unlocks after shortlist.
            </p>
          )}

          {canOfferSlots ? (
            <form action={offerInterviewSlotsAction.bind(null, detail.candidate.id)}>
              <button
                type="submit"
                className="w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-glow"
              >
                {activeHolds.length > 0 || expiredHoldCount > 0
                  ? "Refresh interview slots"
                  : "Offer interview slots"}
              </button>
            </form>
          ) : null}

          {canSimulateInterview ? (
            <form action={simulateInterviewCompleteAction.bind(null, detail.candidate.id)}>
              <button
              type="submit"
              className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-accentDark"
            >
                Simulate interview complete
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="rounded-[2rem] border border-line/70 bg-white/85 p-5 shadow-soft backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Compact status
        </p>
        <div className="mt-4 space-y-3">
          <MiniStat label="Stage" value={getCandidateStatusLabel(status)} />
          <MiniStat
            label="Interview"
            value={
              detail.interview
                ? getInterviewStatusLabel(detail.interview.interview_status)
                : "Not scheduled"
            }
          />
          <MiniStat
            label="Submitted"
            value={formatDate(detail.application.submitted_at)}
            helper={detail.application.submission_status}
          />
        </div>
      </section>

      <section className="rounded-[2rem] border border-line/70 bg-white/85 p-5 shadow-soft backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Profile links
        </p>
        <div className="mt-4 grid gap-3">
          <ExternalLink label="LinkedIn" href={detail.candidate.linkedin_url} />
          <ExternalLink label="GitHub" href={detail.candidate.github_url} />
          <ExternalLink label="Portfolio" href={detail.candidate.portfolio_url} />
        </div>
      </section>
    </aside>
  );
}

function HiringDecisionSummary({ detail }: { detail: CandidateDetailView }) {
  const primarySummary =
    detail.interviewTranscript?.concise_summary ??
    detail.researchProfile?.candidate_brief ??
    detail.screeningResult?.rationale ??
    "Run screening and enrichment to build a fuller hiring recommendation.";

  return (
    <SectionCard title="Hiring decision summary" eyebrow="Review focus">
      <div className="rounded-3xl bg-hero/70 p-5">
        <p className="text-base leading-8 text-slate-800">{primarySummary}</p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <MiniStat
          label="AI score"
          value={formatAiScore(detail.candidate.ai_score)}
          helper={`Threshold ${detail.candidate.shortlist_threshold}`}
        />
        <MiniStat
          label="Screening"
          value={
            detail.screeningResult
              ? detail.screeningResult.shortlist_recommendation
                ? "Recommend shortlist"
                : "Do not shortlist"
              : "Pending"
          }
        />
        <MiniStat
          label="Human override"
          value={detail.candidate.admin_override ? "Applied" : "None"}
          helper={detail.candidate.admin_override_note ?? undefined}
        />
      </div>
    </SectionCard>
  );
}

function SchedulingSummary({
  detail,
  confirmedHold,
  activeHolds,
  isRescheduleRequested
}: {
  detail: CandidateDetailView;
  confirmedHold: CalendarHoldRecord | null;
  activeHolds: CalendarHoldRecord[];
  isRescheduleRequested: boolean;
}) {
  return (
    <SectionCard title="Interview & scheduling" eyebrow="Coordination">
      {detail.interview ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <MiniStat
              label="Status"
              value={
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${getInterviewStatusClasses(detail.interview.interview_status)}`}
                >
                  {getInterviewStatusLabel(detail.interview.interview_status)}
                </span>
              }
            />
            <MiniStat
              label="Confirmed time"
              value={
                confirmedHold
                  ? formatScheduleWindow(confirmedHold.slot_start, confirmedHold.slot_end)
                  : "Not confirmed"
              }
            />
            <MiniStat
              label="Interviewer"
              value={detail.interview.interviewer_name ?? "Hiring Team"}
              helper={detail.interview.interviewer_email ?? undefined}
            />
          </div>

          {isRescheduleRequested ? (
            <div className="rounded-3xl border border-line/70 bg-hero/60 p-5 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">Reschedule requested</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {detail.interview.scheduling_note ?? "The candidate asked for another time."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <form action={regenerateRescheduleSuggestionsAction.bind(null, detail.candidate.id)}>
                    <button
                      type="submit"
                      className="rounded-full border border-line/80 bg-white/80 px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
                    >
                      Regenerate suggestions
                    </button>
                  </form>
                  {activeHolds.length > 0 ? (
                    <form action={approveRescheduleSlotsAction.bind(null, detail.candidate.id)}>
                      <button
                        type="submit"
                        className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-slate-800"
                      >
                        Approve and send
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>

              {activeHolds.length > 0 ? (
                <div className="mt-5 rounded-2xl border border-line/70 bg-white/80 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-950">Replacement options ready</p>
                  <div className="mt-3 grid gap-2">
                    {activeHolds.map((hold) => (
                      <div
                        key={hold.id}
                        className="rounded-2xl bg-hero/70 px-4 py-3 text-sm leading-6 text-slate-700"
                      >
                        <p className="font-semibold text-ink">
                          {formatScheduleWindow(hold.slot_start, hold.slot_end)}
                        </p>
                        <p className="text-slate-600">
                          {hold.interviewer_name} · Reserved until {formatDateTime(hold.expires_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {detail.interview.reschedule_preferences ? (
                <div className="mt-5 rounded-2xl border border-line/70 bg-white/80 px-4 py-3 text-sm leading-6 text-slate-700">
                  <p className="font-semibold text-slate-950">Preference summary</p>
                  <p className="mt-1">{detail.interview.reschedule_preferences.notes_summary}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm leading-6 text-slate-500">
          Scheduling starts once a shortlisted candidate is ready for interview options.
        </p>
      )}
    </SectionCard>
  );
}

function InterviewIntelligence({ detail }: { detail: CandidateDetailView }) {
  if (!detail.interview) {
    return null;
  }

  return (
    <SectionCard title="Interview intelligence" eyebrow="Interview signal">
      {detail.interviewTranscript ? (
        <div className="space-y-5">
          <div className="rounded-3xl bg-hero/70 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Summary
            </p>
            <p className="mt-3 text-base leading-8 text-slate-800">
              {detail.interviewTranscript.concise_summary}
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-950">Strengths observed</p>
              <InsightList items={detail.interviewTranscript.strengths_observed} />
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-950">Concerns observed</p>
              <InsightList items={detail.interviewTranscript.concerns_observed} />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-950">Topics discussed</p>
              <TagList items={detail.interviewTranscript.key_topics_discussed} />
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-950">Recommended follow-up</p>
              <InsightList items={detail.interviewTranscript.recommended_follow_up} />
            </div>
          </div>

          <details className="rounded-2xl border border-line/70 bg-hero/60 px-5 py-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">
              Transcript preview
            </summary>
            <p className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {detail.interviewTranscript.transcript_text}
            </p>
          </details>
        </div>
      ) : detail.interview.interview_status === "scheduled" ? (
        <p className="text-sm leading-6 text-slate-600">
          Interview is scheduled. Complete it after the meeting to add the notetaker summary for review.
        </p>
      ) : (
        <p className="text-sm leading-6 text-slate-500">
          Interview summary appears after the interview is completed.
        </p>
      )}
    </SectionCard>
  );
}

function OfferPanel({ detail }: { detail: CandidateDetailView }) {
  const eligible = isOfferEligible(detail);
  const defaultTitle = detail.offer?.confirmed_job_title ?? detail.role.title;
  const minimumStartDate = getNextDateInputValue(detail.interviewTranscript?.completed_at);

  return (
    <SectionCard title="Offer" eyebrow="Offer workflow">
      {!eligible ? (
        <p className="text-sm leading-6 text-slate-500">
          Offer generation becomes available after the interview is completed.
        </p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <MiniStat
              label="Offer status"
              value={detail.offer ? getOfferStatusLabel(detail.offer.offer_status) : "Not started"}
            />
            <MiniStat
              label="Job title"
              value={detail.offer?.confirmed_job_title ?? detail.role.title}
            />
            <MiniStat
              label="Signed"
              value={detail.offer?.signed_at ? formatDateTime(detail.offer.signed_at) : "Awaiting signature"}
            />
          </div>

          {detail.offer?.offer_status !== "signed" ? (
          <div className="rounded-3xl border border-line/70 bg-hero/60 p-5 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-slate-950">Send offer</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                The offer letter is generated, stored, and emailed in one step. Delivery may take a few seconds.
              </p>
            </div>
            <form
              action={generateOfferDraftAction.bind(null, detail.candidate.id)}
              className="mt-5 grid gap-4 md:grid-cols-2"
            >
              <label>
                <span className="text-sm font-semibold text-slate-900">Confirmed job title</span>
                <input
                  name="confirmedJobTitle"
                  defaultValue={defaultTitle}
                  className="mt-2 w-full rounded-2xl border border-line/80 bg-white/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-900">Start date</span>
                <input
                  name="startDate"
                  type="date"
                  min={minimumStartDate}
                  defaultValue={detail.offer?.start_date ?? ""}
                  className="mt-2 w-full rounded-2xl border border-line/80 bg-white/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                />
                {minimumStartDate ? (
                  <span className="mt-1 block text-xs text-slate-500">
                    Must be after the interview date.
                  </span>
                ) : null}
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-900">Base salary</span>
                <input
                  name="baseSalary"
                  defaultValue={detail.offer?.base_salary ?? ""}
                  placeholder="$120,000"
                  className="mt-2 w-full rounded-2xl border border-line/80 bg-white/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-900">
                  Equity or bonus
                </span>
                <input
                  name="equityOrBonus"
                  defaultValue={detail.offer?.equity_or_bonus ?? ""}
                  placeholder="Optional"
                  className="mt-2 w-full rounded-2xl border border-line/80 bg-white/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-900">Reporting manager</span>
                <input
                  name="reportingManager"
                  defaultValue={detail.offer?.reporting_manager ?? ""}
                  className="mt-2 w-full rounded-2xl border border-line/80 bg-white/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                />
              </label>
              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-slate-900">Custom terms / notes</span>
                <textarea
                  name="customTerms"
                  rows={3}
                  defaultValue={detail.offer?.custom_terms ?? ""}
                  placeholder="Optional offer-specific terms to include."
                  className="mt-2 w-full rounded-2xl border border-line/80 bg-white/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
                />
              </label>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Send offer
                </button>
              </div>
            </form>
          </div>
          ) : null}

          {detail.offer ? (
            <div className="rounded-3xl border border-line/70 bg-hero/60 p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-950">Offer delivery</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <MiniStat label="Recipient" value={detail.offer.offer_email_recipient ?? detail.candidate.email} />
                <MiniStat
                  label="Sent"
                  value={detail.offer.sent_at ? formatDateTime(detail.offer.sent_at) : "Not sent"}
                  helper={
                    detail.offer.offer_email_status
                      ? `Email ${detail.offer.offer_email_status}`
                      : "Delivery may take a few seconds after sending."
                  }
                />
              </div>
              {detail.offer.signature_image_data ? (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-sm font-semibold text-emerald-950">Signed offer received</p>
                  <p className="mt-1 text-sm text-emerald-900">
                    Signed {detail.offer.signed_at ? formatDateTime(detail.offer.signed_at) : "successfully"}.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}

function SlackOnboardingPanel({ detail }: { detail: CandidateDetailView }) {
  if (detail.candidate.current_status !== "offer_signed" && !detail.slackOnboarding) {
    return null;
  }

  const onboarding = detail.slackOnboarding;

  return (
    <SectionCard title="Slack onboarding" eyebrow="Onboarding">
      {!onboarding ? (
        <p className="text-sm leading-6 text-slate-500">
          Slack onboarding starts automatically after the offer is signed.
        </p>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <MiniStat
              label="Onboarding status"
              value={getSlackOnboardingStatusLabel(onboarding.onboarding_status)}
            />
            <MiniStat
              label="Invite"
              value={getSlackInviteLabel(onboarding.invite_status)}
              helper={onboarding.slack_invite_email}
            />
            <MiniStat
              label="Joined"
              value={onboarding.joined_at ? formatDateTime(onboarding.joined_at) : "Waiting for candidate to join Slack"}
              helper={onboarding.slack_user_id ?? undefined}
            />
            <MiniStat
              label="Team welcome + DM"
              value={getSlackDeliveryLabel(onboarding.welcome_status)}
              helper={onboarding.welcome_sent_at ? formatDateTime(onboarding.welcome_sent_at) : undefined}
            />
            <MiniStat
              label="HR notification"
              value={getSlackDeliveryLabel(onboarding.hr_notification_status)}
              helper={onboarding.hr_notified_at ? formatDateTime(onboarding.hr_notified_at) : undefined}
            />
          </div>

          {onboarding.invite_error || onboarding.welcome_error || onboarding.hr_notification_error ? (
            <details className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <summary className="cursor-pointer font-semibold">Onboarding follow-up</summary>
              <div className="mt-3 space-y-2 leading-6">
                {onboarding.invite_error ? <p>{onboarding.invite_error}</p> : null}
                {onboarding.welcome_error ? <p>{onboarding.welcome_error}</p> : null}
                {onboarding.hr_notification_error ? <p>{onboarding.hr_notification_error}</p> : null}
              </div>
            </details>
          ) : null}

          {onboarding.onboarding_status !== "completed" ? (
            <div className="rounded-2xl border border-line/70 bg-hero/60 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-950">
                Ready after the candidate joins Slack
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Once the candidate accepts the Slack invite and can access the
                workspace, run this check to send the team welcome, personal DM,
                and HR notification.
              </p>
              <form className="mt-4" action={checkSlackJoinAction.bind(null, detail.candidate.id)}>
                <button
                  type="submit"
                  className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Check Slack and send welcome
                </button>
              </form>
            </div>
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}

function CandidateIntelligence({ detail }: { detail: CandidateDetailView }) {
  return (
    <SectionCard title="Candidate intelligence" eyebrow="Screening & enrichment">
      <div className="space-y-6">
        {detail.researchProfile ? (
          <div className="rounded-3xl border border-line/70 bg-hero/60 p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Enriched brief
                </p>
                <p className="mt-3 text-base leading-8 text-slate-800">
                  {detail.researchProfile.candidate_brief}
                </p>
              </div>
              <div className="shrink-0 rounded-2xl border border-line/70 bg-white/80 px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Source confidence
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {detail.researchProfile.confidence_score}
                </p>
                <p className="text-xs text-slate-500">
                  {getConfidenceLabel(detail.researchProfile.confidence_score)}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {detail.screeningResult ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-950">Screening strengths</p>
              <InsightList items={detail.screeningResult.strengths} />
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-950">Screening gaps</p>
              <InsightList items={detail.screeningResult.gaps} />
            </div>
          </div>
        ) : (
          <p className="rounded-3xl bg-hero/70 p-5 text-sm leading-6 text-slate-500">
            Run screening to generate fit score, rationale, strengths, and gaps.
          </p>
        )}

        {detail.researchProfile?.discrepancy_flags.length ? (
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-950">Discrepancy review</p>
            <div className="space-y-3">
              {detail.researchProfile.discrepancy_flags.map((item) => (
                <div key={`${item.type}-${item.description}`} className="rounded-2xl bg-hero/70 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getDiscrepancySeverityClasses(item.severity)}`}
                    >
                      {item.severity}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                      {item.type.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <details className="rounded-2xl border border-line/70 bg-white/80 px-5 py-4 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">
            Source summaries and extracted details
          </summary>
          <div className="mt-5 space-y-5">
            {detail.researchProfile ? (
              <div className="grid gap-4 md:grid-cols-2">
                <MiniStat
                  label="LinkedIn"
                  value={
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getLinkedInSourceBadgeClasses(detail.researchProfile.linkedin_source_status)}`}
                    >
                      {getLinkedInSourceLabel(detail.researchProfile.linkedin_source_status)}
                    </span>
                  }
                  helper={
                    detail.researchProfile.linkedin_summary ??
                    "LinkedIn evidence was limited; use the submitted link for manual review."
                  }
                />
                <MiniStat
                  label="GitHub"
                  value={detail.researchProfile.github_summary ?? "Unavailable"}
                  helper={detail.researchProfile.github_url_used ?? undefined}
                />
                <MiniStat
                  label="Portfolio"
                  value={detail.researchProfile.portfolio_summary ?? "Unavailable"}
                  helper={detail.researchProfile.portfolio_url_used ?? undefined}
                />
                <MiniStat label="X / Twitter" value="Not connected" />
              </div>
            ) : null}

            {detail.screeningResult ? (
              <div className="space-y-4">
                <div>
                  <p className="mb-3 text-sm font-semibold text-slate-950">Extracted skills</p>
                  <TagList items={detail.screeningResult.extracted_skills} />
                </div>
                <div>
                  <p className="mb-3 text-sm font-semibold text-slate-950">Key achievements</p>
                  <InsightList items={detail.screeningResult.key_achievements} />
                </div>
                <div>
                  <p className="mb-3 text-sm font-semibold text-slate-950">Screening rationale</p>
                  <p className="rounded-2xl bg-hero/70 px-4 py-3 text-sm leading-6 text-slate-700">
                    {detail.screeningResult.rationale}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </SectionCard>
  );
}

function ActivityTimeline({ detail }: { detail: CandidateDetailView }) {
  return (
    <section className="rounded-[2rem] border border-line/70 bg-white/85 p-6 shadow-soft backdrop-blur">
      <details>
        <summary className="cursor-pointer list-none">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Audit trail
          </p>
          <div className="mt-1 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-[-0.035em] text-ink">Activity</h2>
            <span className="rounded-full border border-line/70 bg-hero/70 px-3 py-1 text-xs font-semibold text-slate-600">
              {detail.auditLogs.length} events
            </span>
          </div>
        </summary>

        <div className="mt-5">
          {detail.auditLogs.length === 0 ? (
            <p className="text-sm text-slate-500">No workflow activity recorded yet.</p>
          ) : (
            <ol className="space-y-4">
              {detail.auditLogs.map((log) => (
                <li
                  key={log.id}
                  className="grid gap-4 rounded-2xl bg-hero/70 px-4 py-3 md:grid-cols-[0.25fr_0.75fr]"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    {formatDateTime(log.created_at)}
                  </p>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {log.action_type.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {log.action_detail ?? "No detail recorded"}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </details>
    </section>
  );
}

function SecondaryAdminTools({ detail }: { detail: CandidateDetailView }) {
  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <SectionCard title="Admin override" eyebrow="Human control">
        <form
          action={overrideCandidateShortlistAction.bind(null, detail.candidate.id)}
          className="space-y-4"
        >
          <div>
            <label htmlFor="decision" className="mb-2 block text-sm font-semibold text-slate-900">
              Override decision
            </label>
            <select
              id="decision"
              name="decision"
              defaultValue="shortlist"
              className="w-full rounded-2xl border border-line/80 bg-white/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
            >
              <option value="shortlist">Shortlist candidate</option>
              <option value="do_not_shortlist">Do not shortlist</option>
            </select>
          </div>
          <div>
            <label htmlFor="note" className="mb-2 block text-sm font-semibold text-slate-900">
              Decision note
            </label>
            <textarea
              id="note"
              name="note"
              rows={4}
              defaultValue={detail.candidate.admin_override_note ?? ""}
              className="w-full rounded-2xl border border-line/80 bg-white/85 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/10"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-slate-800"
          >
            Save override
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Application details" eyebrow="Record">
        <div className="grid gap-3">
          <MiniStat label="Submitted" value={formatDateTime(detail.application.submitted_at)} />
          <details className="rounded-2xl border border-line/70 bg-hero/60 px-4 py-3 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900">
              Record identifiers
            </summary>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                  Application ID
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-700 [overflow-wrap:anywhere]">
                  {detail.application.id}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                  Candidate ID
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-700 [overflow-wrap:anywhere]">
                  {detail.candidate.id}
                </p>
              </div>
            </div>
          </details>
        </div>
      </SectionCard>
    </section>
  );
}

function DangerZone({ detail }: { detail: CandidateDetailView }) {
  return (
    <section className="rounded-[2rem] border border-rose-200 bg-rose-50/90 p-6 shadow-soft">
      <h2 className="text-lg font-semibold text-rose-950">Danger zone</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-rose-900">
        Permanently delete this QA candidate and all related application, AI,
        scheduling, interview, audit, and resume storage data.
      </p>
      <form
        action={hardDeleteCandidateAction.bind(null, detail.candidate.id)}
        className="mt-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end"
      >
        <label>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-800">
            Type DELETE to confirm
          </span>
          <input
            name="confirmation"
            className="mt-2 w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-950 outline-none transition focus:border-rose-400 focus:ring-4 focus:ring-rose-200/60"
            placeholder="DELETE"
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-rose-700"
        >
          Delete test candidate
        </button>
      </form>
    </section>
  );
}

export const revalidate = 0;

export default async function CandidateDetailPage({
  params,
  searchParams
}: CandidateDetailPageProps) {
  await requireAdminUser();
  const { candidateId } = await params;
  const resolvedSearchParams = await searchParams;
  const detail = await getCandidateDetail(candidateId);

  if (!detail) {
    notFound();
  }

  const status = detail.candidate.current_status as CandidateWorkflowStatus;
  const canRunEnrichment = isCandidateEligibleForEnrichment(detail.candidate);
  const activeHolds = detail.calendarHolds.filter((hold) => hold.hold_status === "held");
  const confirmedHold =
    detail.calendarHolds.find((hold) => hold.hold_status === "confirmed") ?? null;
  const expiredHoldCount = detail.calendarHolds.filter((hold) => hold.hold_status === "expired").length;
  const isRescheduleRequested = detail.interview?.interview_status === "reschedule_requested";
  const canOfferSlots =
    status === "shortlisted" ||
    status === "interview_pending" ||
    isRescheduleRequested;
  const canSimulateInterview =
    detail.interview?.interview_status === "scheduled" && detail.interviewTranscript === null;
  const interviewStatus = detail.interview
    ? getInterviewStatusLabel(detail.interview.interview_status)
    : "Not scheduled";

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
      <FlashMessages messages={getFlashMessages(resolvedSearchParams)} />

      <CandidateHero detail={detail} status={status} interviewStatus={interviewStatus} />

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="space-y-6">
          <HiringDecisionSummary detail={detail} />
          <SchedulingSummary
            detail={detail}
            confirmedHold={confirmedHold}
            activeHolds={activeHolds}
            isRescheduleRequested={isRescheduleRequested}
          />
          <InterviewIntelligence detail={detail} />
          <OfferPanel detail={detail} />
          <SlackOnboardingPanel detail={detail} />
          <CandidateIntelligence detail={detail} />
          <ActivityTimeline detail={detail} />
          <SecondaryAdminTools detail={detail} />
          <DangerZone detail={detail} />
        </main>

        <ActionRail
          detail={detail}
          status={status}
          canRunEnrichment={canRunEnrichment}
          canOfferSlots={canOfferSlots}
          canSimulateInterview={canSimulateInterview}
          activeHolds={activeHolds}
          expiredHoldCount={expiredHoldCount}
        />
      </div>
    </section>
  );
}
