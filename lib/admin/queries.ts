/**
 * Read-only query helpers for the Phase B admin dashboard and candidate detail
 * pages. The helpers fetch raw records from Supabase and assemble small,
 * explicit view models for the UI.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getCandidateSchedulingDetail } from "@/lib/scheduling/queries";
import { isUuid } from "@/lib/utils/uuid";
import {
  candidateWorkflowStatuses,
  isCandidateWorkflowStatus,
  type CandidateWorkflowStatus
} from "@/lib/utils/candidate-status";
import type {
  CandidateDashboardFilters,
  CandidateDashboardRow,
  CandidateDetailView
} from "@/types/admin";
import type {
  ApplicationRecord,
  CandidateRecord,
  InterviewFeedbackRecord,
  InterviewTranscriptRecord,
  ResearchProfileRecord,
  RoleRecord,
  ScreeningResultRecord
} from "@/types/database";

function normalizeStatus(value: string): CandidateWorkflowStatus {
  return isCandidateWorkflowStatus(value) ? value : "applied";
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Returns the roles needed for filter dropdowns and row labels inside the admin
 * UI. Unlike the public careers page, the admin view can see any role status.
 */
export async function getAdminRoles(): Promise<RoleRecord[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load admin roles: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Fetches candidate rows for the dashboard and joins related application/role
 * data in memory. This keeps the query logic readable without introducing more
 * complex abstractions for a small Phase B surface area.
 */
export async function getCandidateDashboardRows(
  filters: CandidateDashboardFilters
): Promise<CandidateDashboardRow[]> {
  const supabase = createSupabaseAdminClient();
  let candidateQuery = supabase.from("candidates").select("*");

  if (filters.roleId) {
    candidateQuery = candidateQuery.eq("role_id", filters.roleId);
  }

  if (filters.status) {
    candidateQuery = candidateQuery.eq("current_status", filters.status);
  }

  if (filters.from) {
    candidateQuery = candidateQuery.gte("created_at", `${filters.from}T00:00:00.000Z`);
  }

  if (filters.to) {
    candidateQuery = candidateQuery.lte("created_at", `${filters.to}T23:59:59.999Z`);
  }

  candidateQuery = candidateQuery.order("created_at", {
    ascending: filters.sort === "oldest"
  });

  const { data: candidates, error: candidateError } = await candidateQuery;

  if (candidateError) {
    throw new Error(`Failed to load candidates: ${candidateError.message}`);
  }

  if (!candidates || candidates.length === 0) {
    return [];
  }

  const roleIds = [...new Set(candidates.map((candidate) => candidate.role_id))];
  const applicationIds = [...new Set(candidates.map((candidate) => candidate.application_id))];

  const [{ data: roles, error: roleError }, { data: applications, error: applicationError }] =
    await Promise.all([
      supabase.from("roles").select("*").in("id", roleIds),
      supabase.from("applications").select("*").in("id", applicationIds)
    ]);

  if (roleError) {
    throw new Error(`Failed to load roles for dashboard: ${roleError.message}`);
  }

  if (applicationError) {
    throw new Error(
      `Failed to load applications for dashboard: ${applicationError.message}`
    );
  }

  const roleMap = new Map((roles ?? []).map((role) => [role.id, role]));
  const applicationMap = new Map(
    (applications ?? []).map((application) => [application.id, application])
  );

  return candidates
    .map((candidate) => {
      const role = roleMap.get(candidate.role_id);
      const application = applicationMap.get(candidate.application_id);

      if (!role || !application) {
        return null;
      }

      return {
        candidateId: candidate.id,
        candidateName: candidate.full_name,
        email: candidate.email,
        roleId: role.id,
        roleTitle: role.title,
        submittedAt: application.submitted_at,
        aiScore: candidate.ai_score,
        currentStatus: normalizeStatus(candidate.current_status)
      } satisfies CandidateDashboardRow;
    })
    .filter((row): row is CandidateDashboardRow => row !== null);
}

/**
 * Fetches the full detail view for a single candidate, including the related
 * application, role, and audit log history.
 */
export async function getCandidateDetail(
  candidateId: string
): Promise<CandidateDetailView | null> {
  if (!isUuid(candidateId)) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .maybeSingle();

  if (candidateError) {
    throw new Error(`Failed to load candidate: ${candidateError.message}`);
  }

  if (!candidate) {
    return null;
  }

  const [
    { data: application, error: applicationError },
    { data: role, error: roleError },
    { data: auditLogs, error: auditError },
    screeningResultResult,
    researchProfileResult,
    schedulingDetailResult,
    interviewTranscriptResult,
    interviewFeedbackResult
  ] = await Promise.all([
    supabase
      .from("applications")
      .select("*")
      .eq("id", candidate.application_id)
      .maybeSingle<ApplicationRecord>(),
    supabase.from("roles").select("*").eq("id", candidate.role_id).maybeSingle<RoleRecord>(),
    supabase
      .from("audit_logs")
      .select("*")
      .eq("candidate_id", candidate.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("screening_results")
      .select("*")
      .eq("candidate_id", candidate.id)
      .maybeSingle<ScreeningResultRecord>(),
    supabase
      .from("research_profiles")
      .select("*")
      .eq("candidate_id", candidate.id)
      .maybeSingle<ResearchProfileRecord>(),
    getCandidateSchedulingDetail(candidate.id),
    supabase
      .from("interview_transcripts")
      .select("*")
      .eq("candidate_id", candidate.id)
      .maybeSingle<InterviewTranscriptRecord>(),
    supabase
      .from("interview_feedback")
      .select("*")
      .eq("candidate_id", candidate.id)
      .maybeSingle<InterviewFeedbackRecord>()
  ]);

  if (applicationError) {
    throw new Error(`Failed to load candidate application: ${applicationError.message}`);
  }

  if (roleError) {
    throw new Error(`Failed to load candidate role: ${roleError.message}`);
  }

  if (auditError) {
    throw new Error(`Failed to load candidate audit logs: ${auditError.message}`);
  }

  const screeningError = screeningResultResult.error;
  const screeningResult = screeningResultResult.data ?? null;
  const researchProfileError = researchProfileResult.error;
  const researchProfile = researchProfileResult.data ?? null;
  const schedulingDetail = schedulingDetailResult;
  const interviewTranscriptError = interviewTranscriptResult.error;
  const interviewTranscript = interviewTranscriptResult.data ?? null;
  const interviewFeedbackError = interviewFeedbackResult.error;
  const interviewFeedback = interviewFeedbackResult.data ?? null;

  if (screeningError) {
    console.error("Failed to load candidate screening result", screeningError);
  }

  if (researchProfileError) {
    console.error("Failed to load candidate research profile", researchProfileError);
  }

  if (interviewTranscriptError) {
    console.error("Failed to load candidate interview transcript", interviewTranscriptError);
  }

  if (interviewFeedbackError) {
    console.error("Failed to load candidate interview feedback", interviewFeedbackError);
  }

  if (!application || !role) {
    return null;
  }

  return {
    candidate: {
      ...candidate,
      current_status: normalizeStatus(candidate.current_status)
    } as CandidateRecord,
    application,
    role,
    auditLogs: auditLogs ?? [],
    interview: schedulingDetail.interview,
    calendarHolds: schedulingDetail.calendarHolds,
    interviewTranscript: interviewTranscript ?? null,
    interviewFeedback: interviewFeedback ?? null,
    screeningResult: screeningResult ?? null,
    researchProfile: researchProfile ?? null
  };
}

/**
 * Keeps filter parsing close to the admin query layer so both page and query
 * logic share the same rules for accepted status/sort values.
 */
export function parseCandidateDashboardFilters(input: {
  roleId?: string;
  status?: string;
  from?: string;
  to?: string;
  sort?: string;
}): CandidateDashboardFilters {
  const filters: CandidateDashboardFilters = {};

  if (input.roleId && isUuid(input.roleId)) {
    filters.roleId = input.roleId;
  }

  if (input.status && candidateWorkflowStatuses.includes(input.status as CandidateWorkflowStatus)) {
    filters.status = input.status as CandidateWorkflowStatus;
  }

  if (input.from && isIsoDate(input.from)) {
    filters.from = input.from;
  }

  if (input.to && isIsoDate(input.to)) {
    filters.to = input.to;
  }

  filters.sort = input.sort === "oldest" ? "oldest" : "newest";

  return filters;
}
