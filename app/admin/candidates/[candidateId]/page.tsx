/**
 * Internal candidate profile page. This is the Phase B "single place to review
 * a candidate" view that assembles the candidate, role, application, and audit
 * history together, with a dedicated section that Phase C AI screening can plug
 * into cleanly later.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { hardDeleteCandidateAction } from "@/lib/admin/actions";
import { getCandidateDetail } from "@/lib/admin/queries";
import { requireAdminUser } from "@/lib/auth/authorization";
import {
  overrideCandidateShortlistAction,
  runCandidateScreeningAction
} from "@/lib/screening/actions";
import { runCandidateEnrichmentAction } from "@/lib/enrichment/actions";
import { isCandidateEligibleForEnrichment } from "@/lib/enrichment/run-enrichment";
import {
  approveRescheduleSlotsAction,
  offerInterviewSlotsAction,
  regenerateRescheduleSuggestionsAction
} from "@/lib/scheduling/actions";
import {
  getHoldStatusClasses,
  getHoldStatusLabel,
  getInterviewStatusClasses,
  getInterviewStatusLabel
} from "@/lib/scheduling/status";
import {
  getCandidateStatusLabel,
  type CandidateWorkflowStatus
} from "@/lib/utils/candidate-status";
import type {
  CalendarHoldRecord,
  EducationEntry,
  PastEmployerEntry,
  ResearchProfileRecord
} from "@/types/database";

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
    rescheduleSlots?: string;
    deleteError?: string;
    override?: string;
    overrideError?: string;
  }>;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatAiScore(value: number | null) {
  return value === null ? "Not scored yet" : value.toFixed(1);
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
    return "High";
  }

  if (value >= 40) {
    return "Medium";
  }

  return "Low";
}

function getConfidenceDescription(value: number) {
  if (value >= 75) {
    return "Strong source coverage and generally consistent supporting evidence.";
  }

  if (value >= 40) {
    return "Partial source coverage or moderate evidence quality.";
  }

  return "Sparse, limited, or inconsistent source evidence. Treat enrichment as low-confidence context.";
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
      return "Fetched directly";
    case "blocked":
      return "Blocked";
    case "unavailable":
      return "Unavailable";
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
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "missing":
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function formatShortlistDecision(score: number | null, threshold: number) {
  if (score === null) {
    return "Pending screening";
  }

  return score >= threshold ? "Meets threshold" : "Below threshold";
}

function renderEducationItem(item: EducationEntry) {
  const details = [item.degree, item.field].filter(Boolean).join(" · ");

  return (
    <li
      key={`${item.institution}-${item.degree ?? "unknown"}-${item.year ?? "na"}`}
      className="rounded-2xl border border-line bg-panel px-4 py-3"
    >
      <p className="text-sm font-medium text-slate-900">{item.institution}</p>
      <p className="mt-1 text-sm text-slate-600">{details || "Degree details not specified"}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-500">
        {item.year ?? "Year not listed"}
      </p>
    </li>
  );
}

function renderEmployerItem(item: PastEmployerEntry) {
  return (
    <li
      key={`${item.company}-${item.title ?? "unknown"}-${item.duration ?? "na"}`}
      className="rounded-2xl border border-line bg-panel px-4 py-3"
    >
      <p className="text-sm font-medium text-slate-900">{item.company}</p>
      <p className="mt-1 text-sm text-slate-600">{item.title ?? "Title not specified"}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-500">
        {item.duration ?? "Duration not listed"}
      </p>
    </li>
  );
}

function OptionalLink({
  label,
  href
}: {
  label: string;
  href: string | null;
}) {
  if (!href) {
    return (
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-2 text-sm text-slate-500">Not provided</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-sm font-medium text-accent hover:text-accentDark"
      >
        Open link
      </a>
    </div>
  );
}

function getPrimarySelectionToken(holds: CalendarHoldRecord[]) {
  const candidateHold =
    holds.find((hold) => hold.hold_status === "held") ??
    holds.find((hold) => hold.hold_status === "confirmed");

  return candidateHold?.selection_token ?? null;
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
  const selectionToken = getPrimarySelectionToken(detail.calendarHolds);
  const selectionLink = selectionToken ? `/interview/${selectionToken}` : null;
  const isRescheduleRequested = detail.interview?.interview_status === "reschedule_requested";
  const canOfferSlots =
    status === "shortlisted" ||
    status === "interview_pending" ||
    isRescheduleRequested;

  return (
    <section className="mx-auto max-w-7xl px-6 py-14">
      <Link href="/admin" className="text-sm font-medium text-accent hover:text-accentDark">
        Back to dashboard
      </Link>

      <div className="mt-6 rounded-[2rem] border border-line bg-panel p-8 shadow-card">
        {resolvedSearchParams.screening === "completed" ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            AI screening completed successfully.
          </div>
        ) : null}

        {resolvedSearchParams.screeningError ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {resolvedSearchParams.screeningError}
          </div>
        ) : null}

        {resolvedSearchParams.enrichment === "completed" ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Profile enrichment completed successfully.
          </div>
        ) : null}

        {resolvedSearchParams.enrichmentError ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {resolvedSearchParams.enrichmentError}
          </div>
        ) : null}

        {resolvedSearchParams.scheduling === "offered" ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Interview options were generated and reserved successfully.
          </div>
        ) : null}

        {resolvedSearchParams.scheduling === "reschedule_regenerated" ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Replacement interview suggestions were regenerated for admin review.
          </div>
        ) : null}

        {resolvedSearchParams.scheduling === "reschedule_sent" ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Replacement interview options were approved and sent to the candidate.
          </div>
        ) : null}

        {resolvedSearchParams.offerEmail === "sent" ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Scheduling link email was sent to the candidate successfully.
          </div>
        ) : null}

        {resolvedSearchParams.offerEmail === "skipped" ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Scheduling holds were created, but the offer email was skipped because Resend is not configured.
          </div>
        ) : null}

        {resolvedSearchParams.offerEmail === "failed" ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Scheduling holds were created, but the offer email failed. {resolvedSearchParams.offerEmailError ?? ""}
          </div>
        ) : null}

        {resolvedSearchParams.schedulingError ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {resolvedSearchParams.schedulingError}
          </div>
        ) : null}

        {resolvedSearchParams.deleteError ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {resolvedSearchParams.deleteError}
          </div>
        ) : null}

        {resolvedSearchParams.override === "saved" ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Admin override saved successfully.
          </div>
        ) : null}

        {resolvedSearchParams.overrideError ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {resolvedSearchParams.overrideError}
          </div>
        ) : null}

        <div className="flex flex-col gap-6 border-b border-line pb-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-accent">
              {detail.role.title}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
              {detail.candidate.full_name}
            </h1>
            <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
              <span>{detail.candidate.email}</span>
              <span>•</span>
              <span>Submitted {formatDateTime(detail.application.submitted_at)}</span>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 md:items-end">
            <StatusBadge status={status} />
            <p className="text-sm text-slate-500">{getCandidateStatusLabel(status)}</p>
            <form action={runCandidateScreeningAction.bind(null, detail.candidate.id)}>
              <button
                type="submit"
                className="inline-flex rounded-full border border-line px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900"
              >
                {detail.screeningResult ? "Run AI screening again" : "Run AI screening"}
              </button>
            </form>
            {canRunEnrichment ? (
              <form action={runCandidateEnrichmentAction.bind(null, detail.candidate.id)}>
                <button
                  type="submit"
                  className="inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accentDark"
                >
                  {detail.researchProfile ? "Run profile enrichment again" : "Run profile enrichment"}
                </button>
              </form>
            ) : (
              <p className="max-w-xs text-right text-sm text-slate-500">
                Profile enrichment is available only after the candidate reaches the shortlisted stage.
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Candidate summary</h2>
            <div className="mt-4 grid gap-4 rounded-3xl border border-line bg-white p-5 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  Role applied for
                </p>
                <p className="mt-2 text-sm text-slate-800">{detail.role.title}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Team</p>
                <p className="mt-2 text-sm text-slate-800">{detail.role.team}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  Current status
                </p>
                <p className="mt-2 text-sm text-slate-800">{getCandidateStatusLabel(status)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                  Submission status
                </p>
                <p className="mt-2 text-sm text-slate-800">
                  {detail.application.submission_status}
                </p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Interview scheduling</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Scheduling uses database-backed holds so offered slots stay reserved until they are selected, released, or expired.
                </p>
              </div>
              {canOfferSlots ? (
                <form action={offerInterviewSlotsAction.bind(null, detail.candidate.id)}>
                  <button
                    type="submit"
                    className="inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accentDark"
                  >
                    {activeHolds.length > 0 || expiredHoldCount > 0
                      ? "Regenerate interview slots"
                      : "Offer interview slots"}
                  </button>
                </form>
              ) : null}
            </div>

            <div className="mt-4 rounded-3xl border border-line bg-white p-5">
              {detail.interview ? (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-2xl border border-line bg-panel px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Interview status
                      </p>
                      <div className="mt-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] ${getInterviewStatusClasses(detail.interview.interview_status)}`}
                        >
                          {getInterviewStatusLabel(detail.interview.interview_status)}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-line bg-panel px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Confirmed slot
                      </p>
                      <p className="mt-2 text-sm text-slate-800">
                        {confirmedHold
                          ? formatScheduleWindow(confirmedHold.slot_start, confirmedHold.slot_end)
                          : "Not confirmed yet"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-line bg-panel px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Active holds
                      </p>
                      <p className="mt-2 text-sm text-slate-800">{activeHolds.length}</p>
                    </div>
                    <div className="rounded-2xl border border-line bg-panel px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Calendar event
                      </p>
                      <p className="mt-2 break-all text-sm text-slate-800">
                        {detail.interview.calendar_event_id ?? "Not created yet"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-line bg-panel px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Expired holds
                      </p>
                      <p className="mt-2 text-sm text-slate-800">{expiredHoldCount}</p>
                    </div>
                    <div className="rounded-2xl border border-line bg-panel px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Meeting link
                      </p>
                      {detail.interview.meeting_link ? (
                        <a
                          href={detail.interview.meeting_link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block break-all text-sm font-medium text-accent hover:text-accentDark"
                        >
                          Open Google Meet
                        </a>
                      ) : (
                        <p className="mt-2 text-sm text-slate-800">Not available yet</p>
                      )}
                    </div>
                  </div>

                  {selectionLink ? (
                    <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Candidate scheduling link
                      </p>
                      <Link
                        href={selectionLink}
                        className="mt-2 inline-block break-all text-sm font-medium text-accent hover:text-accentDark"
                      >
                        {selectionLink}
                      </Link>
                    </div>
                  ) : null}

                  {detail.calendarHolds.length > 0 ? (
                    <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Reserved slot history
                      </p>
                      <div className="mt-4 space-y-3">
                        {detail.calendarHolds.map((hold) => (
                          <div
                            key={hold.id}
                            className="rounded-2xl border border-line bg-white px-4 py-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] ${getHoldStatusClasses(hold.hold_status)}`}
                              >
                                {getHoldStatusLabel(hold.hold_status)}
                              </span>
                              <span className="text-xs uppercase tracking-[0.12em] text-slate-500">
                                {hold.interviewer_name}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-700">
                              {formatScheduleWindow(hold.slot_start, hold.slot_end)}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">
                              Expires {formatDateTime(hold.expires_at)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      No interview options have been offered yet.
                    </p>
                  )}

                  {detail.interview.calendar_warning ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-amber-700">
                        Calendar follow-up needed
                      </p>
                      <p className="mt-2 text-sm leading-6 text-amber-800">
                        {detail.interview.calendar_warning}
                      </p>
                    </div>
                  ) : null}

                  {detail.interview.scheduling_note ? (
                    <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Latest scheduling note
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {detail.interview.scheduling_note}
                      </p>
                    </div>
                  ) : null}

                  {isRescheduleRequested ? (
                    <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                            Reschedule request
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            The candidate asked for a new set of interview times. Admin can regenerate candidate-safe replacements, review them, and then send the refreshed scheduling link.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          <form action={regenerateRescheduleSuggestionsAction.bind(null, detail.candidate.id)}>
                            <button
                              type="submit"
                              className="inline-flex rounded-full border border-line px-5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:text-slate-900"
                            >
                              Regenerate suggestions
                            </button>
                          </form>
                          <form action={approveRescheduleSlotsAction.bind(null, detail.candidate.id)}>
                            <button
                              type="submit"
                              className="inline-flex rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accentDark"
                            >
                              Approve and send new slots
                            </button>
                          </form>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-line bg-white px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                            Candidate note
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            {detail.interview.scheduling_note ?? "No note provided"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-line bg-white px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                            AI preference summary
                          </p>
                          {detail.interview.reschedule_preferences ? (
                            <div className="mt-2 space-y-2 text-sm text-slate-700">
                              <p>{detail.interview.reschedule_preferences.notes_summary}</p>
                              <p>
                                Preferred time of day:{" "}
                                {detail.interview.reschedule_preferences.preferred_time_of_day ?? "Not specified"}
                              </p>
                              <p>
                                Preferred days:{" "}
                                {detail.interview.reschedule_preferences.preferred_days.join(", ") || "Not specified"}
                              </p>
                              <p>
                                Avoid days:{" "}
                                {detail.interview.reschedule_preferences.avoid_days.join(", ") || "Not specified"}
                              </p>
                              <p>
                                Avoid times:{" "}
                                {detail.interview.reschedule_preferences.avoid_time_ranges.join(", ") || "Not specified"}
                              </p>
                              <p>
                                Earliest date:{" "}
                                {detail.interview.reschedule_preferences.earliest_date ?? "Not specified"}
                              </p>
                            </div>
                          ) : (
                            <p className="mt-2 text-sm text-slate-500">
                              AI could not confidently extract structured timing preferences, so admins should use the original note directly.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 rounded-2xl border border-line bg-white px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                          Proposed replacement slots
                        </p>
                        {activeHolds.length > 0 ? (
                          <div className="mt-4 space-y-3">
                            {activeHolds.map((hold) => (
                              <div
                                key={hold.id}
                                className="rounded-2xl border border-line bg-panel px-4 py-3"
                              >
                                <p className="text-sm font-medium text-slate-900">
                                  {formatScheduleWindow(hold.slot_start, hold.slot_end)}
                                </p>
                                <p className="mt-1 text-sm text-slate-600">
                                  {hold.interviewer_name} · {hold.interviewer_email}
                                </p>
                                <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-500">
                                  Reserved until {formatDateTime(hold.expires_at)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-slate-500">
                            No replacement slots have been generated yet. Regenerate suggestions to prepare a fresh held set before sending.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {expiredHoldCount > 0 && activeHolds.length === 0 && !confirmedHold ? (
                    <p className="text-sm text-slate-500">
                      The previous interview options expired without a confirmed selection. You can regenerate a fresh set of holds and follow up manually.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Scheduling starts once a shortlisted candidate is ready for interview options.
                </p>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-rose-900">Danger zone</h2>
            <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50 p-5">
              <p className="text-sm leading-6 text-rose-900">
                This prototype-only QA utility permanently deletes this candidate, the
                application row that powers duplicate protection, downstream screening,
                enrichment, scheduling records, audit history, and the uploaded resume file.
              </p>
              <form
                action={hardDeleteCandidateAction.bind(null, detail.candidate.id)}
                className="mt-5 flex flex-col gap-3 md:flex-row md:items-end"
              >
                <label className="flex-1">
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-rose-700">
                    Type DELETE to confirm
                  </span>
                  <input
                    name="confirmation"
                    className="mt-2 w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-900 outline-none focus:border-rose-400"
                    placeholder="DELETE"
                    autoComplete="off"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex rounded-full bg-rose-600 px-5 py-3 text-sm font-medium text-white hover:bg-rose-700"
                >
                  Delete test candidate
                </button>
              </form>
            </div>
          </section>

          <section>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">AI screening result</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Assistant-generated screening grounded only in the uploaded resume and this role.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-3xl border border-line bg-white p-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-line bg-panel px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">AI score</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {formatAiScore(detail.candidate.ai_score)}
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-panel px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                    Shortlist recommendation
                  </p>
                  <p className="mt-2 text-sm text-slate-800">
                    {detail.screeningResult === null
                      ? "Pending screening"
                      : detail.screeningResult.shortlist_recommendation
                        ? "Recommend shortlist"
                        : "Do not recommend shortlist"}
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-panel px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                    Threshold check
                  </p>
                  <p className="mt-2 text-sm text-slate-800">
                    {formatShortlistDecision(
                      detail.candidate.ai_score,
                      detail.candidate.shortlist_threshold
                    )}
                  </p>
                </div>
                <div className="rounded-2xl border border-line bg-panel px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Model</p>
                  <p className="mt-2 text-sm text-slate-800">
                    {detail.screeningResult?.model_name ?? "Not run yet"}
                  </p>
                </div>
              </div>

              {detail.screeningResult ? (
                <div className="mt-6 space-y-6 border-t border-line pt-6">
                  <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      Screening rationale
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {detail.screeningResult.rationale}
                    </p>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Strengths
                      </p>
                      <ul className="mt-3 space-y-2">
                        {detail.screeningResult.strengths.map((item) => (
                          <li key={item} className="text-sm text-slate-700">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Gaps</p>
                      <ul className="mt-3 space-y-2">
                        {detail.screeningResult.gaps.map((item) => (
                          <li key={item} className="text-sm text-slate-700">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                          Screening metadata
                        </p>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                              Years of experience
                            </p>
                            <p className="mt-2 text-sm text-slate-700">
                              {detail.screeningResult.years_experience ?? "Not extracted"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                              Shortlist threshold
                            </p>
                            <p className="mt-2 text-sm text-slate-700">
                              {detail.candidate.shortlist_threshold}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                              Admin override
                            </p>
                            <p className="mt-2 text-sm text-slate-700">
                              {detail.candidate.admin_override ? "Enabled" : "Not enabled"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                              Override note
                            </p>
                            <p className="mt-2 text-sm text-slate-700">
                              {detail.candidate.admin_override_note ?? "No note recorded"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                          Extracted skills
                        </p>
                        <p className="mt-3 text-sm text-slate-700">
                          {detail.screeningResult.extracted_skills.join(", ") || "None extracted"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                          Key achievements
                        </p>
                        <ul className="mt-3 space-y-2">
                          {detail.screeningResult.key_achievements.length > 0 ? (
                            detail.screeningResult.key_achievements.map((item) => (
                              <li key={item} className="text-sm text-slate-700">
                                {item}
                              </li>
                            ))
                          ) : (
                            <li className="text-sm text-slate-500">No achievements extracted</li>
                          )}
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                          Education
                        </p>
                        {detail.screeningResult.education.length > 0 ? (
                          <ul className="mt-3 space-y-3">
                            {detail.screeningResult.education.map(renderEducationItem)}
                          </ul>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500">No education extracted</p>
                        )}
                      </div>

                      <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                          Past employers
                        </p>
                        {detail.screeningResult.past_employers.length > 0 ? (
                          <ul className="mt-3 space-y-3">
                            {detail.screeningResult.past_employers.map(renderEmployerItem)}
                          </ul>
                        ) : (
                          <p className="mt-3 text-sm text-slate-500">No employers extracted</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-6 border-t border-line pt-6 text-sm text-slate-500">
                  Run AI screening to generate structured resume evidence, a fit score,
                  recruiter-friendly rationale, strengths, and gaps for this candidate.
                </p>
              )}
            </div>
          </section>

          <section>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Profile enrichment</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Supplemental online research generated only for shortlisted candidates using submitted profile links.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-3xl border border-line bg-white p-5">
              {detail.researchProfile ? (
                <div className="space-y-6">
                  <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
                    <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Candidate brief
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {detail.researchProfile.candidate_brief}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Enrichment confidence
                      </p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">
                        {detail.researchProfile.confidence_score}
                        <span className="ml-2 text-sm font-medium text-slate-500">
                          {getConfidenceLabel(detail.researchProfile.confidence_score)}
                        </span>
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {getConfidenceDescription(detail.researchProfile.confidence_score)}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        LinkedIn summary
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] ${getLinkedInSourceBadgeClasses(detail.researchProfile.linkedin_source_status)}`}
                        >
                          {getLinkedInSourceLabel(detail.researchProfile.linkedin_source_status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {detail.researchProfile.linkedin_summary ??
                          "Automated LinkedIn enrichment could not gather enough public evidence. The submitted LinkedIn URL is still available for manual review."}
                      </p>
                      {detail.researchProfile.linkedin_source_note ? (
                        <p className="mt-3 text-sm leading-6 text-slate-500">
                          {detail.researchProfile.linkedin_source_note}
                        </p>
                      ) : null}
                      <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-500">
                        Source: {detail.researchProfile.linkedin_url_used ?? "Not provided"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        GitHub summary
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {detail.researchProfile.github_summary ?? "GitHub enrichment was unavailable."}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-500">
                        Source: {detail.researchProfile.github_url_used ?? "Not provided"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        Portfolio summary
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {detail.researchProfile.portfolio_summary ?? "Portfolio enrichment was unavailable."}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-500">
                        Source: {detail.researchProfile.portfolio_url_used ?? "Not provided"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                        X / Twitter summary
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {detail.researchProfile.x_summary ?? "X/Twitter was not included in this MVP."}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.12em] text-slate-500">
                        Source: {detail.researchProfile.x_url_used ?? "Not used"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-line bg-panel px-5 py-4">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      Discrepancy flags
                    </p>
                    {detail.researchProfile.discrepancy_flags.length > 0 ? (
                      <ul className="mt-3 space-y-3">
                        {detail.researchProfile.discrepancy_flags.map((item) => (
                          <li
                            key={`${item.type}-${item.description}`}
                            className="rounded-2xl border border-line bg-white px-4 py-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] ${getDiscrepancySeverityClasses(item.severity)}`}
                              >
                                {item.severity}
                              </span>
                              <span className="text-xs uppercase tracking-[0.12em] text-slate-500">
                                {item.type.replaceAll("_", " ")}
                              </span>
                              {item.source ? (
                                <span className="text-xs uppercase tracking-[0.12em] text-slate-400">
                                  {item.source}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-700">
                              {item.description}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">
                        No clear discrepancies were identified from the available sources.
                      </p>
                    )}
                  </div>
                </div>
              ) : canRunEnrichment ? (
                <p className="text-sm text-slate-500">
                  Run profile enrichment to generate the candidate brief, conservative discrepancy review, and source summaries from the submitted links.
                </p>
              ) : (
                <p className="text-sm text-slate-500">
                  Profile enrichment is gated to shortlisted candidates so the system only spends research effort on candidates already in the interview-worthy path.
                </p>
              )}
            </div>
          </section>

          <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-8">
              <section>
                <h2 className="text-lg font-semibold text-slate-900">Profile links</h2>
                <div className="mt-4 grid gap-4 rounded-3xl border border-line bg-white p-5 md:grid-cols-3">
                  <OptionalLink label="LinkedIn" href={detail.candidate.linkedin_url} />
                  <OptionalLink label="Portfolio" href={detail.candidate.portfolio_url} />
                  <OptionalLink label="GitHub" href={detail.candidate.github_url} />
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">Application record</h2>
                <div className="mt-4 grid gap-4 rounded-3xl border border-line bg-white p-5 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      Application ID
                    </p>
                    <p className="mt-2 break-all text-sm text-slate-800">{detail.application.id}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      Candidate ID
                    </p>
                    <p className="mt-2 break-all text-sm text-slate-800">{detail.candidate.id}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      Submitted at
                    </p>
                    <p className="mt-2 text-sm text-slate-800">
                      {formatDateTime(detail.application.submitted_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      Resume file path
                    </p>
                    <p className="mt-2 break-all text-sm text-slate-800">
                      {detail.application.resume_file_path}
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-8">
              <section>
                <h2 className="text-lg font-semibold text-slate-900">Admin override</h2>
                <div className="mt-4 rounded-3xl border border-line bg-white p-5">
                  <p className="text-sm text-slate-600">
                    Use this when a human reviewer wants to override the shortlist
                    outcome recommended by the AI screening result.
                  </p>
                  <form
                    action={overrideCandidateShortlistAction.bind(null, detail.candidate.id)}
                    className="mt-5 space-y-4"
                  >
                    <div>
                      <label
                        htmlFor="decision"
                        className="mb-2 block text-sm font-medium text-slate-800"
                      >
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
                      <label
                        htmlFor="note"
                        className="mb-2 block text-sm font-medium text-slate-800"
                      >
                        Override note
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
                      className="inline-flex rounded-full bg-accent px-5 py-3 text-sm font-medium text-white hover:bg-accentDark"
                    >
                      Save override
                    </button>
                  </form>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-semibold text-slate-900">
                  Candidate activity
                </h2>
                <div className="mt-4 rounded-3xl border border-line bg-white p-5">
                  {detail.auditLogs.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No workflow activity recorded yet.
                    </p>
                  ) : (
                    <ol className="space-y-4">
                      {detail.auditLogs.map((log) => (
                        <li key={log.id} className="border-l-2 border-line pl-4">
                          <p className="text-sm font-medium text-slate-900">{log.action_type}</p>
                          <p className="mt-1 text-sm text-slate-600">
                            {log.action_detail ?? "No detail recorded"}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-500">
                            {log.actor} · {formatDateTime(log.created_at)}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
