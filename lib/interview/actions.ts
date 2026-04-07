"use server";

/**
 * Admin-only Phase 04 actions. Interview completion can be simulated for demo
 * purposes, while feedback stays deterministic and can only be saved after an
 * interview has completed.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requireAdminUser } from "@/lib/auth/authorization";
import { summarizeInterviewTranscript } from "@/lib/gemini/summarize-interview";
import { buildSimulatedInterviewTranscript } from "@/lib/interview/simulate-interview";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type {
  CandidateRecord,
  InterviewRecord,
  ResearchProfileRecord,
  RoleRecord,
  ScreeningResultRecord
} from "@/types/database";

function candidatePath(candidateId: string) {
  return `/admin/candidates/${candidateId}`;
}

async function writeAuditLog(candidateId: string, actionType: string, actionDetail: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("audit_logs").insert({
    candidate_id: candidateId,
    action_type: actionType,
    action_detail: actionDetail,
    actor: "admin"
  });

  if (error) {
    console.error("Failed to write interview audit log", error);
  }
}

async function getInterviewContext(candidateId: string) {
  const supabase = createSupabaseAdminClient();
  const [
    { data: candidate, error: candidateError },
    { data: interview, error: interviewError }
  ] = await Promise.all([
    supabase.from("candidates").select("*").eq("id", candidateId).maybeSingle<CandidateRecord>(),
    supabase.from("interviews").select("*").eq("candidate_id", candidateId).maybeSingle<InterviewRecord>()
  ]);

  if (candidateError || !candidate) {
    throw new Error(`Failed to load candidate for interview action: ${candidateError?.message ?? "Candidate not found"}`);
  }

  if (interviewError || !interview) {
    throw new Error(`Failed to load interview for interview action: ${interviewError?.message ?? "Interview not found"}`);
  }

  return { candidate, interview };
}

export async function simulateInterviewCompleteAction(candidateId: string) {
  await requireAdminUser();
  const supabase = createSupabaseAdminClient();

  try {
    const { candidate, interview } = await getInterviewContext(candidateId);

    if (interview.interview_status !== "scheduled") {
      throw new Error("Interview completion can be simulated only after an interview is scheduled.");
    }

    const [
      { data: role, error: roleError },
      { data: screeningResult },
      { data: researchProfile }
    ] = await Promise.all([
      supabase.from("roles").select("*").eq("id", candidate.role_id).maybeSingle<RoleRecord>(),
      supabase
        .from("screening_results")
        .select("*")
        .eq("candidate_id", candidate.id)
        .maybeSingle<ScreeningResultRecord>(),
      supabase
        .from("research_profiles")
        .select("*")
        .eq("candidate_id", candidate.id)
        .maybeSingle<ResearchProfileRecord>()
    ]);

    if (roleError || !role) {
      throw new Error(`Failed to load role for simulated interview: ${roleError?.message ?? "Role not found"}`);
    }

    const transcriptText = buildSimulatedInterviewTranscript({
      candidate,
      role,
      screeningResult: screeningResult ?? null,
      researchProfile: researchProfile ?? null
    });
    const { summary, modelName } = await summarizeInterviewTranscript({
      candidateName: candidate.full_name,
      roleTitle: role.title,
      transcriptText
    });
    const completedAt = new Date().toISOString();

    const { error: transcriptError } = await supabase.from("interview_transcripts").upsert(
      {
        candidate_id: candidate.id,
        interview_id: interview.id,
        transcript_text: transcriptText,
        transcript_source: "simulated",
        overall_assessment: summary.overall_assessment,
        strengths_observed: summary.strengths_observed,
        concerns_observed: summary.concerns_observed,
        key_topics_discussed: summary.key_topics_discussed,
        recommended_follow_up: summary.recommended_follow_up,
        concise_summary: summary.concise_summary,
        model_name: modelName,
        completed_at: completedAt
      },
      { onConflict: "interview_id" }
    );

    if (transcriptError) {
      throw new Error(`Failed to store simulated interview transcript: ${transcriptError.message}`);
    }

    const [{ error: interviewUpdateError }, { error: candidateUpdateError }] =
      await Promise.all([
        supabase
          .from("interviews")
          .update({ interview_status: "completed" })
          .eq("id", interview.id),
        supabase
          .from("candidates")
          .update({ current_status: "interview_completed" })
          .eq("id", candidate.id)
      ]);

    if (interviewUpdateError) {
      throw new Error(`Failed to mark interview complete: ${interviewUpdateError.message}`);
    }

    if (candidateUpdateError) {
      throw new Error(`Failed to update candidate status after interview: ${candidateUpdateError.message}`);
    }

    await writeAuditLog(
      candidate.id,
      "interview_simulated_completed",
      "Admin simulated interview completion and generated an AI interview summary from a demo transcript."
    );

    revalidatePath(candidatePath(candidate.id));
    redirect(`${candidatePath(candidate.id)}?interview=completed`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Unable to simulate interview completion.";
    redirect(`${candidatePath(candidateId)}?interviewError=${encodeURIComponent(message)}`);
  }
}

export async function saveInterviewFeedbackAction(candidateId: string, formData: FormData) {
  await requireAdminUser();
  const supabase = createSupabaseAdminClient();
  const rating = Number(formData.get("rating"));
  const comments = String(formData.get("comments") ?? "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    redirect(`${candidatePath(candidateId)}?feedbackError=${encodeURIComponent("Rating must be between 1 and 5.")}`);
  }

  if (comments.length < 5) {
    redirect(`${candidatePath(candidateId)}?feedbackError=${encodeURIComponent("Feedback comments must be at least 5 characters.")}`);
  }

  try {
    const { candidate, interview } = await getInterviewContext(candidateId);

    if (interview.interview_status !== "completed") {
      throw new Error("Feedback can be submitted only after the interview is completed.");
    }

    // One latest feedback record keeps the MVP simple. Re-submission updates
    // the same interview feedback row instead of creating committee workflows.
    const { error } = await supabase.from("interview_feedback").upsert(
      {
        candidate_id: candidate.id,
        interview_id: interview.id,
        rating,
        comments,
        actor: "admin",
        submitted_at: new Date().toISOString()
      },
      { onConflict: "interview_id" }
    );

    if (error) {
      throw new Error(`Failed to save interview feedback: ${error.message}`);
    }

    await writeAuditLog(
      candidate.id,
      "interview_feedback_saved",
      `Interview feedback saved with rating ${rating}/5.`
    );

    revalidatePath(candidatePath(candidate.id));
    redirect(`${candidatePath(candidate.id)}?feedback=saved`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Unable to save interview feedback.";
    redirect(`${candidatePath(candidateId)}?feedbackError=${encodeURIComponent(message)}`);
  }
}
