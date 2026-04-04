/**
 * Shared status badge for the internal candidate workflow states.
 */
import { cn } from "@/lib/utils/cn";
import {
  getCandidateStatusClasses,
  getCandidateStatusLabel,
  type CandidateWorkflowStatus
} from "@/lib/utils/candidate-status";

type StatusBadgeProps = {
  status: CandidateWorkflowStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
        getCandidateStatusClasses(status)
      )}
    >
      {getCandidateStatusLabel(status)}
    </span>
  );
}

