/**
 * Shared view-model types for the internal Phase B admin experience.
 */
import type {
  ApplicationRecord,
  AuditLogRecord,
  CalendarHoldRecord,
  CandidateRecord,
  InterviewFeedbackRecord,
  InterviewRecord,
  InterviewTranscriptRecord,
  OfferRecord,
  ResearchProfileRecord,
  RoleRecord,
  ScreeningResultRecord,
  SlackOnboardingRecord
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
  interviewTranscript: InterviewTranscriptRecord | null;
  interviewFeedback: InterviewFeedbackRecord | null;
  offer: OfferRecord | null;
  slackOnboarding: SlackOnboardingRecord | null;
  screeningResult: ScreeningResultRecord | null;
  researchProfile: ResearchProfileRecord | null;
};
