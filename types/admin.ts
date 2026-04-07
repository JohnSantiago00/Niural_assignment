/**
 * Shared view-model types for the internal Phase B admin experience.
 */
import type {
  ApplicationRecord,
  AuditLogRecord,
  CalendarHoldRecord,
  CandidateRecord,
  InterviewRecord,
  ResearchProfileRecord,
  RoleRecord,
  ScreeningResultRecord
} from "@/types/database";
import type { CandidateWorkflowStatus } from "@/lib/utils/candidate-status";

export type CandidateDashboardFilters = {
  roleId?: string;
  status?: CandidateWorkflowStatus;
  from?: string;
  to?: string;
  sort?: "newest" | "oldest";
};

export type CandidateDashboardRow = {
  candidateId: string;
  candidateName: string;
  email: string;
  roleId: string;
  roleTitle: string;
  submittedAt: string;
  aiScore: number | null;
  currentStatus: CandidateWorkflowStatus;
};

export type CandidateDetailView = {
  candidate: CandidateRecord;
  application: ApplicationRecord;
  role: RoleRecord;
  auditLogs: AuditLogRecord[];
  interview: InterviewRecord | null;
  calendarHolds: CalendarHoldRecord[];
  screeningResult: ScreeningResultRecord | null;
  researchProfile: ResearchProfileRecord | null;
};
