/**
 * Table view for the Phase B admin dashboard candidate list.
 */
import Link from "next/link";
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
      <div className="rounded-[2rem] border border-dashed border-line bg-panel p-10 text-center shadow-card">
        <p className="text-lg font-medium text-slate-900">No candidates match these filters.</p>
        <p className="mt-2 text-sm text-slate-600">
          Adjust the filters or wait for new applications to arrive from the public portal.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-line bg-panel shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-stone-50">
            <tr className="text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <th className="px-5 py-4 font-medium">Candidate</th>
              <th className="px-5 py-4 font-medium">Role</th>
              <th className="px-5 py-4 font-medium">Submitted</th>
              <th className="px-5 py-4 font-medium">AI Score</th>
              <th className="px-5 py-4 font-medium">Status</th>
              <th className="px-5 py-4 font-medium">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white">
            {rows.map((row) => (
              <tr key={row.candidateId} className="text-sm text-slate-700">
                <td className="px-5 py-4">
                  <Link
                    href={`/admin/candidates/${row.candidateId}`}
                    className="font-medium text-slate-900 hover:text-accent"
                  >
                    {row.candidateName}
                  </Link>
                </td>
                <td className="px-5 py-4">{row.roleTitle}</td>
                <td className="px-5 py-4">{formatSubmittedAt(row.submittedAt)}</td>
                <td className="px-5 py-4">
                  <span className={row.aiScore === null ? "text-slate-400" : "text-slate-900"}>
                    {formatAiScore(row.aiScore)}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <StatusBadge status={row.currentStatus} />
                </td>
                <td className="px-5 py-4">
                  <a href={`mailto:${row.email}`} className="hover:text-accent">
                    {row.email}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
