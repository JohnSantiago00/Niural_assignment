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
  saveInterviewFeedbackAction,
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
    messages.push({ tone: "error", message: params.interviewError });
  }

  if (params.feedback === "saved") {
    messages.push({ tone: "success", message: "Interview feedback saved." });
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
          className={`rounded-2xl border px-4 py-3 text-sm ${toneClasses[message.tone]}`}
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
    <section className="rounded-[1.75rem] border border-line bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
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
    <div className="min-w-0 rounded-2xl border border-line bg-panel px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <div className="mt-2 text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">
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
          className="rounded-full border border-line bg-panel px-3 py-1 text-xs font-medium text-slate-700"
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
        <li key={item} className="rounded-2xl bg-panel px-4 py-3 text-sm leading-6 text-slate-700">
          {item}
        </li>
      ))}
    </ul>
  );
}

function ExternalLink({ label, href }: { label: string; href: string | null }) {
  if (!href) {
    return (
      <div className="rounded-2xl border border-line bg-panel px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <p className="mt-2 text-sm text-slate-500">Not provided</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-panel px-4 py-3">
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
    <div className="overflow-hidden rounded-[2rem] border border-line bg-slate-950 text-white shadow-card">
      <div className="bg-[radial-gradient(circle_at_top_left,rgba(116,170,255,0.28),transparent_35%),linear-gradient(135deg,#0f172a,#1e293b_62%,#334155)] p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Link href="/admin" className="text-sm font-medium text-slate-300 hover:text-white">
              Back to dashboard
            </Link>
            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.22em] text-sky-200">
              {detail.role.title}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl">
              {detail.candidate.full_name}
            </h1>
            <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-300">
              <span>{detail.candidate.email}</span>
              <span className="text-slate-500">/</span>
              <span>{detail.role.team}</span>
              <span className="text-slate-500">/</span>
              <span>Applied {formatDate(detail.application.submitted_at)}</span>
            </div>
          </div>

          <div className="grid min-w-[18rem] gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-3xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Workflow stage</p>
              <div className="mt-3">
                <StatusBadge status={status} />
              </div>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Interview</p>
              <p className="mt-3 text-sm font-semibold text-white">{interviewStatus}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-4">
          <div className="rounded-3xl border border-white/15 bg-white/10 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-300">AI score</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {formatAiScore(detail.candidate.ai_score)}
            </p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Recommendation</p>
            <p className="mt-2 text-sm font-semibold text-white">{getShortlistCopy(detail)}</p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Profile research</p>
            <p className="mt-2 text-sm font-semibold text-white">
              {detail.researchProfile
                ? getConfidenceLabel(detail.researchProfile.confidence_score)
                : "Pending research"}
            </p>
          </div>
          <div className="rounded-3xl border border-white/15 bg-white/10 px-5 py-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-300">Offer</p>
            <p className="mt-2 text-sm font-semibold text-white">
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
      <section className="rounded-[1.75rem] border border-line bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Next actions
        </p>
        <div className="mt-4 space-y-3">
          <form action={runCandidateScreeningAction.bind(null, detail.candidate.id)}>
            <button
              type="submit"
              className="w-full rounded-full border border-line px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-950"
            >
              {detail.screeningResult ? "Refresh screening" : "Run screening"}
            </button>
          </form>

          {canRunEnrichment ? (
            <form action={runCandidateEnrichmentAction.bind(null, detail.candidate.id)}>
              <button
                type="submit"
                className="w-full rounded-full border border-line px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-950"
              >
                {detail.researchProfile ? "Refresh enrichment" : "Run enrichment"}
              </button>
            </form>
          ) : (
            <p className="rounded-2xl bg-panel px-4 py-3 text-sm leading-6 text-slate-500">
              Enrichment unlocks after shortlist.
            </p>
          )}

          {canOfferSlots ? (
            <form action={offerInterviewSlotsAction.bind(null, detail.candidate.id)}>
              <button
                type="submit"
                className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accentDark"
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
                className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Simulate interview complete
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-line bg-white p-5 shadow-sm">
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

      <section className="rounded-[1.75rem] border border-line bg-white p-5 shadow-sm">
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
      <div className="rounded-3xl bg-panel p-5">
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
  isRescheduleRequested
}: {
  detail: CandidateDetailView;
  confirmedHold: CalendarHoldRecord | null;
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
            <div className="rounded-3xl border border-line bg-panel p-5">
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
                      className="rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400"
                    >
                      Regenerate suggestions
                    </button>
                  </form>
                  <form action={approveRescheduleSlotsAction.bind(null, detail.candidate.id)}>
                    <button
                      type="submit"
                      className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accentDark"
                    >
                      Approve and send
                    </button>
                  </form>
                </div>
              </div>

              {detail.interview.reschedule_preferences ? (
                <div className="mt-5 rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-slate-700">
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
    <SectionCard title="Interview intelligence" eyebrow="Phase 04">
      {detail.interviewTranscript ? (
        <div className="space-y-5">
          <div className="rounded-3xl bg-panel p-5">
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

          <details className="rounded-2xl border border-line bg-panel px-5 py-4">
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

function InterviewFeedbackPanel({ detail }: { detail: CandidateDetailView }) {
  if (detail.interview?.interview_status !== "completed") {
    return null;
  }

  return (
    <SectionCard title="Interview feedback" eyebrow="Reviewer input">
      <form
        action={saveInterviewFeedbackAction.bind(null, detail.candidate.id)}
        className="grid gap-5 lg:grid-cols-[0.35fr_0.65fr]"
      >
        <div>
          <label htmlFor="interview-rating" className="text-sm font-semibold text-slate-900">
            Rating
          </label>
          <select
            id="interview-rating"
            name="rating"
            defaultValue={detail.interviewFeedback?.rating ?? 4}
            className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700"
          >
            <option value="1">1 - Strong no</option>
            <option value="2">2 - Concerns</option>
            <option value="3">3 - Mixed</option>
            <option value="4">4 - Positive</option>
            <option value="5">5 - Strong yes</option>
          </select>
          {detail.interviewFeedback ? (
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Last saved {formatDateTime(detail.interviewFeedback.submitted_at)}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="interview-comments" className="text-sm font-semibold text-slate-900">
            Comments
          </label>
          <textarea
            id="interview-comments"
            name="comments"
            rows={4}
            defaultValue={detail.interviewFeedback?.comments ?? ""}
            className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700"
            placeholder="Summarize feedback and recommended next step."
          />
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accentDark"
            >
              Save feedback
            </button>
          </div>
        </div>
      </form>
    </SectionCard>
  );
}

function OfferPanel({ detail }: { detail: CandidateDetailView }) {
  const eligible = isOfferEligible(detail);
  const defaultTitle = detail.offer?.confirmed_job_title ?? detail.role.title;
  const minimumStartDate = getNextDateInputValue(detail.interviewTranscript?.completed_at);

  return (
    <SectionCard title="Offer" eyebrow="Phase 05">
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
          <div className="rounded-3xl border border-line bg-panel p-5">
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
                  className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-900">Start date</span>
                <input
                  name="startDate"
                  type="date"
                  min={minimumStartDate}
                  defaultValue={detail.offer?.start_date ?? ""}
                  className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700"
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
                  className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700"
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
                  className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label>
                <span className="text-sm font-semibold text-slate-900">Reporting manager</span>
                <input
                  name="reportingManager"
                  defaultValue={detail.offer?.reporting_manager ?? ""}
                  className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <label className="md:col-span-2">
                <span className="text-sm font-semibold text-slate-900">Custom terms / notes</span>
                <textarea
                  name="customTerms"
                  rows={3}
                  defaultValue={detail.offer?.custom_terms ?? ""}
                  placeholder="Optional offer-specific terms to include."
                  className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700"
                />
              </label>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accentDark"
                >
                  Send offer
                </button>
              </div>
            </form>
          </div>
          ) : null}

          {detail.offer ? (
            <div className="rounded-3xl border border-line bg-panel p-5">
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

function CandidateIntelligence({ detail }: { detail: CandidateDetailView }) {
  return (
    <SectionCard title="Candidate intelligence" eyebrow="Screening & enrichment">
      <div className="space-y-6">
        {detail.researchProfile ? (
          <div className="rounded-3xl border border-line bg-panel p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Enriched brief
                </p>
                <p className="mt-3 text-base leading-8 text-slate-800">
                  {detail.researchProfile.candidate_brief}
                </p>
              </div>
              <div className="shrink-0 rounded-2xl bg-white px-4 py-3">
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
          <p className="rounded-3xl bg-panel p-5 text-sm leading-6 text-slate-500">
            Run screening to generate fit score, rationale, strengths, and gaps.
          </p>
        )}

        {detail.researchProfile?.discrepancy_flags.length ? (
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-950">Discrepancy review</p>
            <div className="space-y-3">
              {detail.researchProfile.discrepancy_flags.map((item) => (
                <div key={`${item.type}-${item.description}`} className="rounded-2xl bg-panel px-4 py-3">
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

        <details className="rounded-2xl border border-line bg-white px-5 py-4">
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
                  <p className="rounded-2xl bg-panel px-4 py-3 text-sm leading-6 text-slate-700">
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
    <section className="rounded-[1.75rem] border border-line bg-white p-6 shadow-sm">
      <details>
        <summary className="cursor-pointer list-none">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Audit trail
          </p>
          <div className="mt-1 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">Activity</h2>
            <span className="rounded-full bg-panel px-3 py-1 text-xs font-semibold text-slate-600">
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
                  className="grid gap-4 rounded-2xl bg-panel px-4 py-3 md:grid-cols-[0.25fr_0.75fr]"
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
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700"
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
              className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-slate-700"
            />
          </div>
          <button
            type="submit"
            className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accentDark"
          >
            Save override
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Application details" eyebrow="Record">
        <div className="grid gap-3">
          <MiniStat label="Submitted" value={formatDateTime(detail.application.submitted_at)} />
          <details className="rounded-2xl border border-line bg-panel px-4 py-3">
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
    <section className="rounded-[1.75rem] border border-rose-200 bg-rose-50 p-6">
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
            className="mt-2 w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-950 outline-none focus:border-rose-400"
            placeholder="DELETE"
            autoComplete="off"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-700"
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
    <section className="mx-auto max-w-7xl px-6 py-12">
      <FlashMessages messages={getFlashMessages(resolvedSearchParams)} />

      <CandidateHero detail={detail} status={status} interviewStatus={interviewStatus} />

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <main className="space-y-6">
          <HiringDecisionSummary detail={detail} />
          <SchedulingSummary
            detail={detail}
            confirmedHold={confirmedHold}
            isRescheduleRequested={isRescheduleRequested}
          />
          <InterviewIntelligence detail={detail} />
          <InterviewFeedbackPanel detail={detail} />
          <OfferPanel detail={detail} />
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
