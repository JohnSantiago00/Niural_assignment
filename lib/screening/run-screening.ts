/**
 * End-to-end Phase C1 screening workflow. This is where deterministic business
 * logic controls candidate state after the AI response is validated.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { downloadResumeFile } from "@/lib/supabase/storage";
import { screenCandidateWithAi } from "@/lib/gemini/screen-candidate";
import { extractResumeText } from "@/lib/screening/extract-resume-text";
import type { ScreeningOutput } from "@/lib/screening/schema";
import type { RoleRecord } from "@/types/database";

type ScreeningWorkflowResult = {
  fitScore: number;
  shortlistRecommendation: boolean;
  candidateStatus: string;
};

type CandidateContext = {
  candidateId: string;
  applicationId: string;
  roleId: string;
  currentStatus: string;
  shortlistThreshold: number;
  adminOverride: boolean;
  resumeFilePath: string;
  role: RoleRecord;
};

async function getCandidateContext(candidateId: string): Promise<CandidateContext> {
  const supabase = createSupabaseAdminClient();
  const { data: candidate, error: candidateError } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .maybeSingle();

  if (candidateError || !candidate) {
    throw new Error(`Failed to load candidate for screening: ${candidateError?.message ?? "Candidate not found"}`);
  }

  const [{ data: application, error: applicationError }, { data: role, error: roleError }] =
    await Promise.all([
      supabase
        .from("applications")
        .select("*")
        .eq("id", candidate.application_id)
        .maybeSingle(),
      supabase.from("roles").select("*").eq("id", candidate.role_id).maybeSingle()
    ]);

  if (applicationError || !application) {
    throw new Error(
      `Failed to load application for screening: ${applicationError?.message ?? "Application not found"}`
    );
  }

  if (roleError || !role) {
    throw new Error(`Failed to load role for screening: ${roleError?.message ?? "Role not found"}`);
  }

  return {
    candidateId: candidate.id,
    applicationId: candidate.application_id,
    roleId: candidate.role_id,
    currentStatus: candidate.current_status,
    shortlistThreshold: candidate.shortlist_threshold,
    adminOverride: candidate.admin_override,
    resumeFilePath: application.resume_file_path,
    role
  };
}

function resolveCandidateStatus(
  screening: ScreeningOutput,
  shortlistThreshold: number,
  adminOverride: boolean
) {
  if (adminOverride) {
    return null;
  }

  return screening.fit_score >= shortlistThreshold ? "shortlisted" : "screened";
}

/**
 * Runs manual AI screening for one candidate and persists the latest screening
 * result. If an admin override is active, the score still updates but the
 * manually chosen workflow status is preserved.
 */
export async function runCandidateScreening(
  candidateId: string
): Promise<ScreeningWorkflowResult> {
  const supabase = createSupabaseAdminClient();
  const context = await getCandidateContext(candidateId);
  const resumeFile = await downloadResumeFile(context.resumeFilePath);
  const parsedResumeText = await extractResumeText(context.resumeFilePath, resumeFile);
  const { screening, modelName } = await screenCandidateWithAi({
    role: context.role,
    resumeText: parsedResumeText
  });

  const nextStatus = resolveCandidateStatus(
    screening,
    context.shortlistThreshold,
    context.adminOverride
  );

  const { error: screeningError } = await supabase.from("screening_results").upsert(
    {
      candidate_id: context.candidateId,
      parsed_resume_text: parsedResumeText,
      extracted_skills: screening.extracted_skills,
      years_experience: screening.years_experience,
      education: screening.education,
      past_employers: screening.past_employers,
      key_achievements: screening.key_achievements,
      strengths: screening.strengths,
      gaps: screening.gaps,
      fit_score: screening.fit_score,
      rationale: screening.rationale,
      shortlist_recommendation: screening.shortlist_recommendation,
      model_name: modelName
    },
    {
      onConflict: "candidate_id"
    }
  );

  if (screeningError) {
    throw new Error(`Failed to save screening result: ${screeningError.message}`);
  }

  const candidateUpdate: {
    ai_score: number;
    current_status?: string;
  } = {
    ai_score: screening.fit_score
  };

  if (nextStatus) {
    candidateUpdate.current_status = nextStatus;
  }

  const { error: candidateUpdateError } = await supabase
    .from("candidates")
    .update(candidateUpdate)
    .eq("id", context.candidateId);

  if (candidateUpdateError) {
    throw new Error(`Failed to update candidate screening state: ${candidateUpdateError.message}`);
  }

  const activityDetail =
    nextStatus && !context.adminOverride
      ? `AI screening completed with score ${screening.fit_score}. Candidate status set to ${nextStatus}.`
      : `AI screening completed with score ${screening.fit_score}. Admin override preserved the current status.`;

  const { error: auditLogError } = await supabase.from("audit_logs").insert({
    candidate_id: context.candidateId,
    action_type: "ai_screening_completed",
    action_detail: activityDetail,
    actor: "system"
  });

  if (auditLogError) {
    console.error("Failed to insert screening audit log", auditLogError);
  }

  return {
    fitScore: screening.fit_score,
    shortlistRecommendation: screening.shortlist_recommendation,
    candidateStatus: nextStatus ?? context.currentStatus
  };
}
