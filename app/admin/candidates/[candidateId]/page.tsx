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
  getCandidateStatusLabel,
  type CandidateWorkflowStatus
} from "@/lib/utils/candidate-status";

type CandidateDetailPageProps = {
  params: Promise<{
    candidateId: string;
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
  params
}: CandidateDetailPageProps) {
  await requireAdminUser();
  const { candidateId } = await params;
  const detail = await getCandidateDetail(candidateId);

  if (!detail) {
    notFound();
  }

  const status = detail.candidate.current_status as CandidateWorkflowStatus;

  return (
    <section className="mx-auto max-w-6xl px-6 py-14">
      <Link href="/admin" className="text-sm font-medium text-accent hover:text-accentDark">
        Back to dashboard
      </Link>

      <div className="mt-6 rounded-[2rem] border border-line bg-panel p-8 shadow-card">
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
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold text-slate-900">Candidate summary</h2>
              <div className="mt-4 grid gap-4 rounded-3xl border border-line bg-white p-5 md:grid-cols-2">
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
              <h2 className="text-lg font-semibold text-slate-900">Screening readiness</h2>
              <div className="mt-4 rounded-3xl border border-line bg-white p-5">
                <div className="space-y-4 text-sm text-slate-700">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      AI score
                    </p>
                    <p className="mt-2">{formatAiScore(detail.candidate.ai_score)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      Screening summary
                    </p>
                    <p className="mt-2 text-slate-500">
                      Reserved for Phase C AI screening output.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      Strengths
                    </p>
                    <p className="mt-2 text-slate-500">
                      Reserved for structured strengths once screening is added.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Gaps</p>
                    <p className="mt-2 text-slate-500">
                      Reserved for structured gaps once screening is added.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      Shortlist threshold
                    </p>
                    <p className="mt-2">{detail.candidate.shortlist_threshold}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      Admin override
                    </p>
                    <p className="mt-2">
                      {detail.candidate.admin_override ? "Enabled" : "Not enabled"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      Shortlist decision
                    </p>
                    <p className="mt-2 text-slate-500">
                      {detail.candidate.ai_score === null
                        ? "Pending screening"
                        : detail.candidate.ai_score >= detail.candidate.shortlist_threshold
                          ? "Meets threshold"
                          : "Below threshold"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      Override note
                    </p>
                    <p className="mt-2">
                      {detail.candidate.admin_override_note ?? "No note recorded"}
                    </p>
                  </div>
                </div>
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
    </section>
  );
}
