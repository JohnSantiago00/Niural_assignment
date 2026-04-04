/**
 * Canonical workflow states for candidate lifecycle rendering. Phase B does not
 * implement every transition yet, but using explicit states now makes the admin
 * UI ready for later phases without changing the presentation model.
 */

export const candidateWorkflowStatuses = [
  "applied",
  "screened",
  "shortlisted",
  "interview_pending",
  "interview_scheduled",
  "interview_completed",
  "offer_drafted",
  "offer_sent",
  "offer_signed",
  "onboarded",
  "rejected"
] as const;

export type CandidateWorkflowStatus = (typeof candidateWorkflowStatuses)[number];

export function isCandidateWorkflowStatus(
  value: string
): value is CandidateWorkflowStatus {
  return candidateWorkflowStatuses.includes(value as CandidateWorkflowStatus);
}

export function getCandidateStatusLabel(status: CandidateWorkflowStatus) {
  return (
    {
      applied: "Applied",
      screened: "Screened",
      shortlisted: "Shortlisted",
      interview_pending: "Interview Pending",
      interview_scheduled: "Interview Scheduled",
      interview_completed: "Interview Completed",
      offer_drafted: "Offer Drafted",
      offer_sent: "Offer Sent",
      offer_signed: "Offer Signed",
      onboarded: "Onboarded",
      rejected: "Rejected"
    } satisfies Record<CandidateWorkflowStatus, string>
  )[status];
}

export function getCandidateStatusClasses(status: CandidateWorkflowStatus) {
  return (
    {
      applied: "border-slate-200 bg-slate-100 text-slate-700",
      screened: "border-sky-200 bg-sky-100 text-sky-700",
      shortlisted: "border-indigo-200 bg-indigo-100 text-indigo-700",
      interview_pending: "border-amber-200 bg-amber-100 text-amber-700",
      interview_scheduled: "border-orange-200 bg-orange-100 text-orange-700",
      interview_completed: "border-violet-200 bg-violet-100 text-violet-700",
      offer_drafted: "border-cyan-200 bg-cyan-100 text-cyan-700",
      offer_sent: "border-blue-200 bg-blue-100 text-blue-700",
      offer_signed: "border-emerald-200 bg-emerald-100 text-emerald-700",
      onboarded: "border-teal-200 bg-teal-100 text-teal-700",
      rejected: "border-rose-200 bg-rose-100 text-rose-700"
    } satisfies Record<CandidateWorkflowStatus, string>
  )[status];
}

