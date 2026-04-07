/**
 * Prototype-only hard delete utility for QA resets. This removes the candidate,
 * their application, downstream AI/scheduling artifacts, audit history, and
 * stored resume so the same email can reapply to the same role.
 */
import { deleteResumeFile } from "@/lib/supabase/storage";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { ApplicationRecord, CandidateRecord } from "@/types/database";

async function deleteRows(
  table:
    | "calendar_holds"
    | "interview_feedback"
    | "interview_transcripts"
    | "interviews"
    | "offers"
    | "slack_onboarding"
    | "research_profiles"
    | "screening_results"
    | "audit_logs"
    | "candidates"
    | "applications",
  column: string,
  value: string
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from(table).delete().eq(column, value);

  if (error) {
    throw new Error(`Failed to delete ${table}: ${error.message}`);
  }
}

export async function hardDeleteCandidate(candidateId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .maybeSingle<CandidateRecord>();

  if (candidateError || !candidate) {
    throw new Error(`Failed to load candidate for deletion: ${candidateError?.message ?? "Candidate not found"}`);
  }

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .select("*")
    .eq("id", candidate.application_id)
    .maybeSingle<ApplicationRecord>();

  if (applicationError || !application) {
    throw new Error(`Failed to load application for deletion: ${applicationError?.message ?? "Application not found"}`);
  }

  // Storage cleanup happens before DB deletion so a failed resume removal does
  // not leave an orphaned private file after the relational reset succeeds.
  await deleteResumeFile(application.resume_file_path);

  // The schema has cascades, but explicit child cleanup keeps this QA reset
  // obvious and robust as the prototype grows new candidate-linked artifacts.
  await deleteRows("calendar_holds", "candidate_id", candidate.id);
  await deleteRows("interview_feedback", "candidate_id", candidate.id);
  await deleteRows("interview_transcripts", "candidate_id", candidate.id);
  await deleteRows("interviews", "candidate_id", candidate.id);
  await deleteRows("slack_onboarding", "candidate_id", candidate.id);
  await deleteRows("offers", "candidate_id", candidate.id);
  await deleteRows("research_profiles", "candidate_id", candidate.id);
  await deleteRows("screening_results", "candidate_id", candidate.id);
  await deleteRows("audit_logs", "candidate_id", candidate.id);
  await deleteRows("candidates", "id", candidate.id);

  // This row owns the duplicate-application constraint, so deleting it is what
  // lets the same email reapply for the same role during QA.
  await deleteRows("applications", "id", application.id);

  return {
    candidateName: candidate.full_name,
    candidateEmail: candidate.email,
    roleId: candidate.role_id
  };
}
