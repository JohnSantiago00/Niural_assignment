/**
 * Table view for the admin dashboard candidate list.
 */
import Link from "next/link";
import { ButtonLink, SurfaceCard } from "@/components/public-ui";
import { StatusBadge } from "@/components/status-badge";
import type { CandidateDashboardRow } from "@/types/admin";

type AdminCandidateTableProps = {
  rows: CandidateDashboardRow[];
};

function formatSubmittedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatAiScore(value: number | null) {
  return value === null ? "Not scored" : value.toFixed(1);
}

export function AdminCandidateTable({ rows }: AdminCandidateTableProps) {
  if (rows.length === 0) {
    return (
      <SurfaceCard className="border-dashed p-10 text-center">
        <p className="text-lg font-semibold tracking-[-0.02em] text-ink">
          No candidates match these filters.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Adjust the filters or wait for new applications to arrive from the public portal.
        </p>
        <ButtonLink href="/admin" variant="secondary" className="mt-6">
          Reset filters
        </ButtonLink>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="border-b border-line/70 bg-hero/60">
            <tr className="text-left text-xs uppercase tracking-[0.14em] text-slate-500">
              <th className="px-6 py-4 font-bold">Candidate</th>
              <th className="px-6 py-4 font-bold">Role</th>
              <th className="px-6 py-4 font-bold">Submitted</th>
              <th className="px-6 py-4 font-bold">Score</th>
              <th className="px-6 py-4 font-bold">Status</th>
              <th className="px-6 py-4 font-bold">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70 bg-white/70">
            {rows.map((row) => (
              <tr
                key={row.candidateId}
                className="group text-sm text-slate-700 transition hover:bg-hero/70"
              >
                <td className="px-6 py-5">
                  <Link
                    href={`/admin/candidates/${row.candidateId}`}
                    className="font-semibold tracking-[-0.01em] text-ink transition group-hover:text-accent"
                  >
                    {row.candidateName}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">{row.email}</p>
                </td>
                <td className="px-6 py-5">
                  <Link
                    href={`/admin/candidates/${row.candidateId}`}
                    className="font-medium text-slate-900 transition group-hover:text-accent"
                  >
                    {row.roleTitle}
                  </Link>
                </td>
                <td className="px-6 py-5 text-slate-600">{formatSubmittedAt(row.submittedAt)}</td>
                <td className="px-6 py-5">
                  <span className={row.aiScore === null ? "text-slate-400" : "font-semibold text-ink"}>
                    {formatAiScore(row.aiScore)}
                  </span>
                </td>
                <td className="px-6 py-5">
                  <StatusBadge status={row.currentStatus} />
                </td>
                <td className="px-6 py-5">
                  <ButtonLink href={`/admin/candidates/${row.candidateId}`} variant="secondary" size="sm">
                    View profile
                  </ButtonLink>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SurfaceCard>
  );
}
