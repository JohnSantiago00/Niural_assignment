/**
 * Internal candidate profile page. This is the Phase B "single place to review
 * a candidate" view that assembles the candidate, role, application, and audit
 * history together, with a dedicated section that Phase C AI screening can plug
 * into cleanly later.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { getCandidateDetail } from "@/lib/admin/queries";
import { requireAdminUser } from "@/lib/auth/authorization";
import {
  overrideCandidateShortlistAction,
  runCandidateScreeningAction
} from "@/lib/screening/actions";
import { runCandidateEnrichmentAction } from "@/lib/enrichment/actions";
import { isCandidateEligibleForEnrichment } from "@/lib/enrichment/run-enrichment";
import {
  getCandidateStatusLabel,
  type CandidateWorkflowStatus
} from "@/lib/utils/candidate-status";
import type {
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
